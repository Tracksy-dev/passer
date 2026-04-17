import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type RequestBody = {
  videoUrl?: string | null;
  matchId?: string;
};

type SmashPoint = {
  timestamp_seconds: number;
  label: "smash";
  note: string;
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
const SCRIPT_PATH = path.join(AI_DEV_DIR, "ModelV6.py");
const CACHE_DIR = path.join(AI_DEV_DIR, "runs", "cache");
const JOB_OUTPUT_DIR = path.join(AI_DEV_DIR, "runs", "jobs");
const ACTIVE_STATUSES = ["queued", "downloading", "loading_model", "processing", "finalizing"];

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

function buildCacheKey(videoUrl: string, matchId?: string) {
  return createHash("sha1")
    .update(`${videoUrl}::${matchId ?? ""}`)
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

function buildSmashPayload(rawSmash: string[], matchId?: string): SmashPayload {
  const dedup = new Map<number, string>();

  for (const raw of rawSmash) {
    const sec = parseSmashTime(raw);
    if (sec === null) continue;
    if (!dedup.has(sec)) dedup.set(sec, raw);
  }

  const entries = [...dedup.entries()].sort((a, b) => a[0] - b[0]);
  const smashSeconds = entries.map(([sec]) => sec);
  const smashRaw = entries.map(([, raw]) => raw);
  const smashProjectPoints: SmashPoint[] = smashSeconds.map((timestamp_seconds) => ({
    timestamp_seconds,
    label: "smash",
    note: "AI detected smash",
  }));

  return {
    success: true,
    matchId,
    cached: false,
    smashRaw,
    smashSeconds,
    smashProjectPoints,
  };
}

async function readSmashListFromOutput(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { smash?: unknown };
  return Array.isArray(parsed.smash)
    ? parsed.smash.filter((v): v is string => typeof v === "string")
    : [];
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
      void (async () => {
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
          const smash = await readSmashListFromOutput(jobOutputJsonPath);
          const payload = buildSmashPayload(smash, matchId);
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
