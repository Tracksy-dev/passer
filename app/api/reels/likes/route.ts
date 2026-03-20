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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? "";

  const reelIds = [...new Set(idsParam.split(",").map((id) => id.trim()))]
    .filter(Boolean)
    .slice(0, 100);

  if (reelIds.length === 0) {
    return NextResponse.json(
      { error: "ids query param is required" },
      { status: 400 },
    );
  }

  const supabase = await getSupabase();

  const { data: likesRows, error: likesErr } = await supabase
    .from("reel_likes")
    .select("reel_id")
    .in("reel_id", reelIds);

  if (likesErr) {
    return NextResponse.json({ error: likesErr.message }, { status: 400 });
  }

  const counts: Record<string, number> = Object.fromEntries(
    reelIds.map((id) => [id, 0]),
  );

  for (const row of likesRows ?? []) {
    counts[row.reel_id] = (counts[row.reel_id] ?? 0) + 1;
  }

  let likedIds: string[] = [];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userLikes, error: userLikesErr } = await supabase
      .from("reel_likes")
      .select("reel_id")
      .eq("user_id", user.id)
      .in("reel_id", reelIds);

    if (!userLikesErr) {
      likedIds = (userLikes ?? []).map((row) => row.reel_id);
    }
  }

  return NextResponse.json({ counts, likedIds });
}
