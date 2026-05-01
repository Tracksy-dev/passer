import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { registerProcess, unregisterProcess } from "../_process-registry";

type RequestBody = {
  videoUrl?: string | null;
  matchId?: string;
};

type SmashPoint = {
  timestamp_seconds: number;
  label: "smash";
  note: string;
  /** Per-detection confidence [0–1] from the improved detector. Absent on old cached results. */
  confidence?: number;
};

type SmashPayload = {
  success: true;
  matchId?: string;
  cached: boolean;
  smashRaw: string[];
  smashSeconds: number[];
  smashProjectPoints: SmashPoint[];
};

type ProgressEvent = {
  type?: string;
  status?: string;
  message?: string;
  progress?: number;
  processed_frames?: number;
  total_frames?: number;
};

const AI_DEV_DIR = path.join(process.cwd(), "app", "Ai-Dev");
const CACHE_DIR = path.join(AI_DEV_DIR, "runs", "cache");
const JOB_OUTPUT_DIR = path.join(AI_DEV_DIR, "runs", "jobs");
const ACTIVE_STATUSES = ["queued", "downloading", "loading_model", "processing", "finalizing"];

/**
 * Detector version switching.
 * Set SMASH_DETECTOR_VERSION in .env.local to switch without a code change.
 * Defaults to "v6_improved" (normalised thresholds + airborne gate).
 * Use "v6" to revert to the original ModelV6.py for A/B comparison.
 */
const DETECTOR_VERSION = process.env.SMASH_DETECTOR_VERSION ?? "v6_improved";
const SCRIPT_MAP: Record<string, string> = {
  v6:          path.join(AI_DEV_DIR, "ModelV6.py"),
  v6_improved: path.join(AI_DEV_DIR, "ModelV6Improved.py"),
  // v7_hybrid: path.join(AI_DEV_DIR, "ModelV7HybridScaffold.py"),  // Option B (scaffold only)
};
const SCRIPT_PATH = SCRIPT_MAP[DETECTOR_VERSION] ?? SCRIPT_MAP["v6_improved"];

/**
 * Events within this window are merged into a single smash point by the API
 * dedup pass.  Raised to 1.0 s to match the detector-side GLOBAL_MIN_GAP_SEC
 * and CLUSTER_WINDOW_SEC constants, giving a consistent 1.0 s minimum gap
 * end-to-end.  The detector already enforces this on its side; the API pass
 * is a second line of defence for cached results produced by older detector
 * versions that lacked the global gate.
 *
 * Boundary: gap <= DEDUP_WINDOW_SEC → merged; gap > DEDUP_WINDOW_SEC → separate.
 */
const DEDUP_WINDOW_SEC = 1.0;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

function buildCacheKey(videoUrl: string, matchId?: string): string {
  // Include detector version so different versions never share a cached result.
  return createHash("sha1")
    .update(`${videoUrl}::${matchId ?? ""}::${DETECTOR_VERSION}`)
    .digest("hex");
}

function parseSmashTime(raw: string): number | null {
  const parts = raw.trim().split(".");
  if (parts.length !== 3) return null;

  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  const centiseconds = Number(parts[2]);

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(centiseconds)
  ) {
    return null;
  }

  const total = minutes * 60 + seconds + centiseconds / 100;
  return Number(total.toFixed(2));
}

type MergedEntry = { raw: string; sec: number; conf: number };

/**
 * Pure temporal-merge helper (also tested in smash-dedup.test.ts).
 *
 * Scans left-to-right over a pre-sorted ascending list.  Any event within
 * windowSec of the current cluster's representative is merged; the
 * highest-confidence event wins and becomes the new anchor (sliding window).
 *
 * Boundary: gap <= windowSec → merged (dropped); gap > windowSec → separate.
 */
export function mergeByMinGap(events: MergedEntry[], windowSec: number): MergedEntry[] {
  const merged: MergedEntry[] = [];
  for (const e of events) {
    const last = merged[merged.length - 1];
    if (last !== undefined && e.sec - last.sec <= windowSec) {
      if (e.conf > last.conf) {
        merged[merged.length - 1] = e;
      }
    } else {
      merged.push(e);
    }
  }
  return merged;
}

/**
 * Build the SmashPayload from raw detector output.
 *
 * Deduplication strategy:
 *   • Parse every raw timestamp string to seconds.
 *   • Sort by time.
 *   • Merge events within a DEDUP_WINDOW_SEC (1.0 s) sliding window, keeping
 *     the highest-confidence representative so the best timestamp survives.
 *
 * This collapses clusters like "7.03, 7.16, 7.23" (same smash detected on
 * multiple players) into one event while preserving genuinely separate rallies.
 * It also acts as a second-pass guard for cached results from older detector
 * versions that lacked the detector-side global refractory gate.
 *
 * confidenceMap is keyed by the raw timestamp string (e.g. "1.23.40") and is
 * absent on results produced by the original ModelV6.py — that is fine because
 * SmashPoint.confidence is optional.
 */
function buildSmashPayload(
  rawSmash: string[],
  confidenceMap: Record<string, number>,
  matchId?: string,
): SmashPayload {
  // 1. Parse, drop unparseable entries
  const parsed: MergedEntry[] = [];
  for (const raw of rawSmash) {
    const sec = parseSmashTime(raw);
    if (sec !== null) parsed.push({ raw, sec, conf: confidenceMap[raw] ?? 0 });
  }

  // 2. Sort ascending
  parsed.sort((a, b) => a.sec - b.sec);

  // 3. Temporal dedup: sliding window of DEDUP_WINDOW_SEC
  const merged = mergeByMinGap(parsed, DEDUP_WINDOW_SEC);

  const smashSeconds        = merged.map((e) => e.sec);
  const smashRaw            = merged.map((e) => e.raw);
  const smashProjectPoints: SmashPoint[] = merged.map((e) => {
    const point: SmashPoint = {
      timestamp_seconds: e.sec,
      label: "smash",
      note: "AI detected smash",
    };
    // Only attach confidence when we have a real value (absent on old V6 results)
    if (e.conf > 0) point.confidence = e.conf;
    return point;
  });

  return {
    success: true,
    matchId,
    cached: false,
    smashRaw,
    smashSeconds,
    smashProjectPoints,
  };
}

/**
 * Read smash detection output from the Python script.
 * Returns the raw timestamp list and an optional confidence map.
 * Works with both ModelV6.py (no smash_confidence key) and
 * ModelV6Improved.py (includes smash_confidence).
 */
async function readSmashOutput(
  filePath: string,
): Promise<{ smashList: string[]; confidenceMap: Record<string, number> }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { smash?: unknown; smash_confidence?: unknown };

  const smashList = Array.isArray(parsed.smash)
    ? parsed.smash.filter((v): v is string => typeof v === "string")
    : [];

  // smash_confidence is an optional map keyed by the raw timestamp string.
  // Absent in V6 output — treat missing/malformed as empty.
  const confidenceMap: Record<string, number> =
    parsed.smash_confidence !== null &&
    typeof parsed.smash_confidence === "object" &&
    !Array.isArray(parsed.smash_confidence)
      ? (parsed.smash_confidence as Record<string, number>)
      : {};

  return { smashList, confidenceMap };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const videoUrl = body.videoUrl ?? null;
    const matchId = body.matchId;

    if (!videoUrl || !matchId) {
      return NextResponse.json(
        { success: false, error: "Missing videoUrl or matchId" },
        { status: 400 }
      );
    }

    const supabase = await getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: activeJob } = await supabase
      .from("ai_jobs")
      .select("id, status, message, progress")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .in("status", ACTIVE_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeJob) {
      return NextResponse.json({
        success: true,
        jobId: activeJob.id,
        status: activeJob.status,
        message: activeJob.message,
        progress: activeJob.progress,
        reusedActiveJob: true,
      });
    }

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.mkdir(JOB_OUTPUT_DIR, { recursive: true });

    const cacheKey = buildCacheKey(videoUrl, matchId);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);

    const { data: createdJob, error: createErr } = await supabase
      .from("ai_jobs")
      .insert({
        user_id: user.id,
        match_id: matchId,
        video_url: videoUrl,
        status: "queued",
        progress: 0,
        message: "Queued",
      })
      .select("id")
      .single();

    if (createErr || !createdJob) {
      return NextResponse.json(
        { success: false, error: createErr?.message ?? "Failed to create AI job" },
        { status: 500 }
      );
    }

    const jobId = createdJob.id as string;

    try {
      const cachedRaw = await fs.readFile(cachePath, "utf-8");
      const cached = JSON.parse(cachedRaw) as SmashPayload;

      await supabase
        .from("ai_jobs")
        .update({
          status: "completed",
          progress: 100,
          message: "Completed",
          result_json: { ...cached, cached: true },
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("user_id", user.id);

      return NextResponse.json({
        success: true,
        jobId,
        status: "completed",
        result_json: { ...cached, cached: true },
        cached: true,
      });
    } catch {
      // Cache miss, run model.
    }

    const jobOutputJsonPath = path.join(JOB_OUTPUT_DIR, `${jobId}.json`);

    const pyProcess = spawn(
      "python3",
      [SCRIPT_PATH, videoUrl, "--output-json", jobOutputJsonPath],
      {
        cwd: process.cwd(),
        env: process.env,
      }
    );
    registerProcess(jobId, pyProcess);

    let stderr = "";
    let stdoutBuffer = "";

    const updateJob = async (patch: Record<string, unknown>) => {
      await supabase
        .from("ai_jobs")
        .update(patch)
        .eq("id", jobId)
        .eq("user_id", user.id);
    };

    const handleProgressEvent = async (event: ProgressEvent) => {
      if (event.type !== "progress" || !event.status) return;

      await updateJob({
        status: event.status,
        progress: typeof event.progress === "number" ? event.progress : undefined,
        message: event.message ?? null,
        processed_frames:
          typeof event.processed_frames === "number" ? event.processed_frames : null,
        total_frames: typeof event.total_frames === "number" ? event.total_frames : null,
      });
    };

    pyProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;

        try {
          const evt = JSON.parse(trimmed) as ProgressEvent;
          void handleProgressEvent(evt);
        } catch {
          // Ignore non-JSON logs.
        }
      }
    });

    pyProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    pyProcess.on("error", (err: Error) => {
      void updateJob({
        status: "failed",
        progress: 100,
        message: "Failed",
        error_text: err.message,
        finished_at: new Date().toISOString(),
      });
    });

    pyProcess.on("close", (code: number | null) => {
      unregisterProcess(jobId);
      void (async () => {
        // Skip writing results if the job was cancelled before the process finished.
        const { data: currentJob } = await supabase
          .from("ai_jobs")
          .select("status")
          .eq("id", jobId)
          .single();
        if (currentJob?.status === "cancelled") return;

        if (code !== 0) {
          await updateJob({
            status: "failed",
            progress: 100,
            message: "Failed",
            error_text: stderr.trim() || `Python exited with code ${code ?? "unknown"}`,
            finished_at: new Date().toISOString(),
          });
          return;
        }

        try {
          const { smashList, confidenceMap } = await readSmashOutput(jobOutputJsonPath);
          const payload = buildSmashPayload(smashList, confidenceMap, matchId);
          await fs.writeFile(cachePath, JSON.stringify(payload), "utf-8");

          await updateJob({
            status: "completed",
            progress: 100,
            message: "Completed",
            result_json: payload,
            error_text: null,
            finished_at: new Date().toISOString(),
          });
        } catch (err) {
          await updateJob({
            status: "failed",
            progress: 100,
            message: "Failed",
            error_text:
              err instanceof Error ? err.message : "Failed to parse AI output JSON",
            finished_at: new Date().toISOString(),
          });
        }
      })();
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: "queued",
      message: "Queued",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start AI job",
      },
      { status: 500 }
    );
  }
}
