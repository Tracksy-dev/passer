import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PublicReelsGrid } from "@/components/public-reels-grid";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  team: string | null;
  position: string | null;
  avatar_url: string | null;
};

type PublicReel = {
  id: string;
  title: string | null;
  output_url: string | null;
  created_at: string;
  match_id: string | null;
};

async function getProfile(username: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, team, position, avatar_url")
    .eq("username", username)
    .single();
  return data;
}

async function getPublicReels(userId: string): Promise<PublicReel[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("reel_jobs")
    .select("id, title, output_url, created_at, match_id")
    .eq("user_id", userId)
    .eq("status", "complete")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getMatchInfoMap(
  matchIds: string[],
): Promise<Record<string, { team_name: string; opponent: string }>> {
  if (matchIds.length === 0) return {};
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select("id, team_name, opponent")
    .in("id", matchIds);
  const map: Record<string, { team_name: string; opponent: string }> = {};
  for (const m of data ?? []) {
    map[m.id] = { team_name: m.team_name, opponent: m.opponent };
  }
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return { title: "Profile not found — Passer" };
  }

  const title = `${profile.display_name || profile.username} — Passer`;
  const description = profile.bio
    ? `${profile.bio.slice(0, 155)}${profile.bio.length > 155 ? "…" : ""}`
    : `Check out ${profile.display_name || profile.username}'s volleyball highlights on Passer.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/profile/${profile.username}`,
      siteName: "Passer",
      ...(profile.avatar_url ? { images: [{ url: profile.avatar_url }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

  const publicReels = await getPublicReels(profile.id);
  const matchIds = publicReels
    .map((r) => r.match_id)
    .filter((id): id is string => !!id);
  const matchInfoMap = await getMatchInfoMap(matchIds);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteHeader showNav={false} />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-6">
          <div className="flex items-start gap-12 md:gap-20">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-[150px] h-[150px] rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-lg">
                    {(profile.display_name || profile.username)
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-xl font-normal text-gray-900">
                {profile.username}
              </h1>

              {/* Stats */}
              <div className="flex items-center gap-8 mt-5">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">
                    {publicReels.length}
                  </span>
                  <span className="text-gray-600">
                    {publicReels.length === 1 ? "reel" : "reels"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">0</span>
                  <span className="text-gray-600">followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">0</span>
                  <span className="text-gray-600">following</span>
                </div>
              </div>

              {/* Bio info */}
              <div className="mt-5">
                <p className="font-semibold text-sm text-gray-900">
                  {profile.display_name}
                </p>
                {profile.position && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {profile.position}
                  </p>
                )}
                {profile.team && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    🏐 {profile.team}
                  </p>
                )}
                {profile.bio && (
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Public Reels Grid ─── */}
        <div className="border-t border-gray-200 max-w-4xl mx-auto px-6 pb-12">
          <PublicReelsGrid reels={publicReels} matchInfoMap={matchInfoMap} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
