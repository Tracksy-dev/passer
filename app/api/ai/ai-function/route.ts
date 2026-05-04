import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type MergedEntry = { raw: string; sec: number; conf: number };

const ACTIVE_STATUSES = ["queued", "downloading", "loading_model", "processing", "finalizing"];

const DETECTOR_VERSION = process.env.SMASH_DETECTOR_VERSION ?? "v6_improved";

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL ?? "";
const RENDER_API_SECRET  = process.env.RENDER_API_SECRET  ?? "";

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

/**
 * Temporal dedup used by smash-dedup.test.ts and as a reference implementation.
 * The actual dedup now runs inside the Render Python service (runner.py).
 *
 * Scans left-to-right over a pre-sorted ascending list. Any event within
 * windowSec of the current cluster's representative is merged; the
 * highest-confidence event wins and becomes the new anchor.
 *
 * Boundary: gap <= windowSec → merged; gap > windowSec → separate.
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { videoUrl?: string | null; matchId?: string };
    const videoUrl = body.videoUrl ?? null;
    const matchId  = body.matchId;

    if (!videoUrl || !matchId) {
      return NextResponse.json(
        { success: false, error: "Missing videoUrl or matchId" },
        { status: 400 }
      );
    }

    if (!RENDER_SERVICE_URL) {
      return NextResponse.json(
        { success: false, error: "RENDER_SERVICE_URL is not configured" },
        { status: 500 }
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

    // Reuse an in-flight job for the same match.
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

    // Return a previously completed job for this exact video (acts as cache).
    const { data: cachedJob } = await supabase
      .from("ai_jobs")
      .select("id, result_json")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .eq("video_url", videoUrl)
      .eq("status", "completed")
      .not("result_json", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedJob?.result_json) {
      return NextResponse.json({
        success: true,
        jobId: cachedJob.id,
        status: "completed",
        result_json: { ...(cachedJob.result_json as object), cached: true },
        cached: true,
      });
    }

    // Create a new job record.
    const { data: createdJob, error: createErr } = await supabase
      .from("ai_jobs")
      .insert({
        user_id:    user.id,
        match_id:   matchId,
        video_url:  videoUrl,
        status:     "queued",
        progress:   0,
        message:    "Queued",
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

    // Dispatch to Render — fire-and-forget from Next.js perspective.
    // The Render service updates Supabase directly as it progresses.
    const renderResp = await fetch(`${RENDER_SERVICE_URL}/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(RENDER_API_SECRET ? { Authorization: `Bearer ${RENDER_API_SECRET}` } : {}),
      },
      body: JSON.stringify({
        video_url:        videoUrl,
        job_id:           jobId,
        match_id:         matchId,
        detector_version: DETECTOR_VERSION,
      }),
    });

    if (!renderResp.ok) {
      await supabase
        .from("ai_jobs")
        .update({
          status:      "failed",
          progress:    100,
          message:     "Failed",
          error_text:  `Could not reach detection service (HTTP ${renderResp.status})`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("user_id", user.id);

      return NextResponse.json(
        { success: false, error: "Detection service unavailable" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, jobId, status: "queued", message: "Queued" });
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
