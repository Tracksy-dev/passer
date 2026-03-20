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
  const limitParam = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 30;

  const supabase = await getSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: notifications, error: listErr }, { count: unreadCount }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select(
          "id, type, reel_id, read_at, created_at, actor:actor_id(id, username, display_name, avatar_url), reel:reel_id(id, title, output_url)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 400 });
  }

  return NextResponse.json({
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
