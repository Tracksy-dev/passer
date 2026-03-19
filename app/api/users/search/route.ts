import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Search profiles by username or display_name (case-insensitive)
  const pattern = `%${query}%`;
  const { data: profiles, error: searchErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, team, position")
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(20);

  if (searchErr) {
    return NextResponse.json({ error: searchErr.message }, { status: 400 });
  }

  // Get reel counts and follower counts for each result
  const userIds = profiles.map((p) => p.id);

  // Fetch reel counts
  const reelCountMap: Record<string, number> = {};
  if (userIds.length > 0) {
    for (const uid of userIds) {
      const { count } = await supabase
        .from("reel_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "complete")
        .eq("is_public", true);
      reelCountMap[uid] = count ?? 0;
    }
  }

  // Fetch follower counts
  const followerCountMap: Record<string, number> = {};
  if (userIds.length > 0) {
    for (const uid of userIds) {
      const { count } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", uid);
      followerCountMap[uid] = count ?? 0;
    }
  }

  const results = profiles.map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    team: p.team,
    position: p.position,
    public_reels: reelCountMap[p.id] ?? 0,
    followers: followerCountMap[p.id] ?? 0,
  }));

  return NextResponse.json({ results });
}
