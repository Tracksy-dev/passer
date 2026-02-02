import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clipBefore = typeof body.clipBefore === "number" ? body.clipBefore : 6;
  const clipAfter = typeof body.clipAfter === "number" ? body.clipAfter : 6;

  const { data: job, error } = await supabase
    .from("reel_jobs")
    .insert({
      match_id: matchId,
      user_id: userRes.user.id,
      status: "queued",
      clip_before: clipBefore,
      clip_after: clipAfter,
    })
    .select("id, status, clip_before, clip_after, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ job });
}
