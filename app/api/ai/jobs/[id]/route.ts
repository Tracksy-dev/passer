import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from("ai_jobs")
    .select(
      "id, match_id, status, progress, message, processed_frames, total_frames, result_json, error_text, started_at, updated_at, finished_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, job });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error: fetchErr } = await supabase
    .from("ai_jobs")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 400 });
  }
  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  const terminalStatuses = ["completed", "failed", "cancelled"];
  if (terminalStatuses.includes(job.status)) {
    return NextResponse.json(
      { success: false, error: "Job is already finished" },
      { status: 409 }
    );
  }

  // Mark cancelled in DB first so the close handler skips writing stale results.
  const { error: updateErr } = await supabase
    .from("ai_jobs")
    .update({
      status: "cancelled",
      progress: 100,
      message: "Cancelled by user",
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  // Best-effort signal to the Render service to stop the subprocess.
  const renderUrl    = process.env.RENDER_SERVICE_URL;
  const renderSecret = process.env.RENDER_API_SECRET;
  if (renderUrl) {
    fetch(`${renderUrl}/jobs/${id}`, {
      method: "DELETE",
      headers: renderSecret ? { Authorization: `Bearer ${renderSecret}` } : {},
    }).catch(() => {/* ignore — Supabase status already updated */});
  }

  return NextResponse.json({ success: true });
}
