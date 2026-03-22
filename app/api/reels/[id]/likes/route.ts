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
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}

async function getReelLikeCount(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  reelId: string,
) {
  const { count } = await supabase
    .from("reel_likes")
    .select("id", { count: "exact", head: true })
    .eq("reel_id", reelId);

  return count ?? 0;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reelId } = await params;
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: reel, error: reelErr } = await supabase
    .from("reel_jobs")
    .select("id, user_id")
    .eq("id", reelId)
    .single();

  if (reelErr || !reel) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  const { error: insertErr } = await supabase.from("reel_likes").insert({
    reel_id: reelId,
    user_id: user.id,
  });

  if (insertErr && insertErr.code !== "23505") {
    if (insertErr.code === "23503") {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }

    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  const insertedNewLike = !insertErr;

  // Only notify on new likes, and never notify for self-action.
  if (insertedNewLike && reel.user_id !== user.id) {
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: reel.user_id,
      actor_id: user.id,
      type: "reel_liked",
      reel_id: reelId,
    });

    if (notifErr) {
      console.error("Failed to create like notification:", notifErr.message);
    }
  }

  const count = await getReelLikeCount(supabase, reelId);
  return NextResponse.json({ liked: true, count });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reelId } = await params;
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: deleteErr } = await supabase
    .from("reel_likes")
    .delete()
    .eq("reel_id", reelId)
    .eq("user_id", user.id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  const count = await getReelLikeCount(supabase, reelId);
  return NextResponse.json({ liked: false, count });
}
