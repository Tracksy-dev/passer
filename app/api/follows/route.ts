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

async function getCounts(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string
) {
  const [{ count: followerCount }, { count: followingCount }] =
    await Promise.all([
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);

  return {
    follower_count: followerCount ?? 0,
    following_count: followingCount ?? 0,
  };
}

// POST /api/follows — follow a user
export async function POST(req: Request) {
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const followingId: unknown = body.following_id;

  if (!followingId || typeof followingId !== "string") {
    return NextResponse.json(
      { error: "following_id is required" },
      { status: 400 }
    );
  }

  // Prevent self-follow
  if (followingId === user.id) {
    return NextResponse.json(
      { error: "You cannot follow yourself" },
      { status: 400 }
    );
  }

  // Check target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", followingId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Insert follow — unique constraint handles duplicates
  const { error: insertErr } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (insertErr) {
    // Duplicate follow (unique constraint violation)
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  // Best-effort notification creation for follow event.
  const { error: notifErr } = await supabase.from("notifications").insert({
    user_id: followingId,
    actor_id: user.id,
    type: "followed_you",
  });

  if (notifErr) {
    console.error("Failed to create follow notification:", notifErr.message);
  }

  // Return updated counts for the target user
  const counts = await getCounts(supabase, followingId);

  return NextResponse.json({
    message: "Followed successfully",
    ...counts,
  });
}

// DELETE /api/follows — unfollow a user
export async function DELETE(req: Request) {
  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const followingId: unknown = body.following_id;

  if (!followingId || typeof followingId !== "string") {
    return NextResponse.json(
      { error: "following_id is required" },
      { status: 400 }
    );
  }

  // Check target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", followingId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete the follow relationship
  const { error: deleteErr } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  // Return updated counts for the target user
  const counts = await getCounts(supabase, followingId);

  return NextResponse.json({
    message: "Unfollowed successfully",
    ...counts,
  });
}
