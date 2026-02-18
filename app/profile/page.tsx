"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import {
  Settings,
  X,
  CheckCircle2,
  Grid3X3,
  Film,
  Play,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

type ReelItem = {
  id: string;
  title: string | null;
  output_url: string | null;
  created_at: string;
  is_public: boolean;
};

const VOLLEYBALL_POSITIONS = [
  "Setter",
  "Outside Hitter",
  "Middle Blocker",
  "Opposite Hitter",
  "Libero",
  "Defensive Specialist",
];

export default function ProfilePage() {
  const router = useRouter();
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string>("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [user, setUser] = useState<{
    id: string;
    email?: string;
    user_metadata?: Record<string, string>;
  } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // Profile display values
  const [profile, setProfile] = useState({
    username: "",
    display_name: "",
    bio: "",
    team: "",
    position: "",
  });

  // Edit form values
  const [editUsername, setEditUsername] = useState<string>("");
  const [editDisplayName, setEditDisplayName] = useState<string>("");
  const [editBio, setEditBio] = useState<string>("");
  const [editTeam, setEditTeam] = useState<string>("");
  const [editPosition, setEditPosition] = useState<string>("");

  const [reelsCount, setReelsCount] = useState(0);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [selectedReel, setSelectedReel] = useState<ReelItem | null>(null);
  const [togglingReelId, setTogglingReelId] = useState<string | null>(null);

  const toggleReelPrivacy = async (
    reelId: string,
    currentlyPublic: boolean,
  ) => {
    try {
      setTogglingReelId(reelId);
      const { error } = await supabase
        .from("reel_jobs")
        .update({ is_public: !currentlyPublic })
        .eq("id", reelId);
      if (error) throw error;
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId ? { ...r, is_public: !currentlyPublic } : r,
        ),
      );
    } catch (e) {
      console.error("Failed to toggle privacy:", e);
    } finally {
      setTogglingReelId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        router.push("/login");
        return;
      }
      const u = data.session?.user;
      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);
      setAvatarUrl(u.user_metadata?.avatar_url ?? "");

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, display_name, bio, team, position")
        .eq("id", u.id)
        .single();

      if (profileData) {
        setProfile({
          username: profileData.username || "",
          display_name: profileData.display_name || "",
          bio: profileData.bio || "",
          team: profileData.team || "",
          position: profileData.position || "",
        });
      }

      // Load completed reels
      const { data: reelData, count: reelCount } = await supabase
        .from("reel_jobs")
        .select("id, title, output_url, created_at, is_public", {
          count: "exact",
        })
        .eq("user_id", u.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false });

      setReels(reelData ?? []);
      setReelsCount(reelCount ?? reelData?.length ?? 0);

      setLoading(false);
    };
    load();
  }, [router]);

  const validateUsername = (value: string): string | null => {
    if (!value) return "Username is required.";
    if (value.length < 3) return "Username must be at least 3 characters.";
    if (value.length > 20) return "Username must be 20 characters or less.";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return "Username can only contain letters, numbers, and underscores.";
    }
    return null;
  };

  const openProfileEdit = () => {
    setEditUsername(profile.username);
    setEditDisplayName(profile.display_name);
    setEditBio(profile.bio);
    setEditTeam(profile.team);
    setEditPosition(profile.position);
    setProfileError("");
    setProfileSuccess(false);
    setIsProfileEditOpen(true);
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess(false);

    const usernameError = validateUsername(editUsername);
    if (usernameError) {
      setProfileError(usernameError);
      return;
    }
    if (!editDisplayName.trim()) {
      setProfileError("Display name is required.");
      return;
    }
    if (editBio.length > 200) {
      setProfileError("Bio must be 200 characters or less.");
      return;
    }

    setSavingProfile(true);
    try {
      if (!user) throw new Error("No user logged in");

      if (editUsername !== profile.username) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", editUsername)
          .single();

        if (existingUser && existingUser.id !== user.id) {
          setProfileError("Username is already taken.");
          setSavingProfile(false);
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: editUsername.trim(),
          display_name: editDisplayName.trim(),
          bio: editBio.trim(),
          team: editTeam.trim(),
          position: editPosition || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({
        username: editUsername.trim(),
        display_name: editDisplayName.trim(),
        bio: editBio.trim(),
        team: editTeam.trim(),
        position: editPosition || "",
      });

      setProfileSuccess(true);
      setTimeout(() => {
        setIsProfileEditOpen(false);
        setProfileSuccess(false);
        setProfileError("");
      }, 1500);
    } catch (err) {
      console.error(err);
      const error = err as Error;
      setProfileError(error.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="profile" />
        <main className="flex-1 bg-white flex items-center justify-center">
          <p className="text-gray-500">Loading profile...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteHeader showNav={true} activePage="profile" />

      <main className="flex-1">
        {/* ─── Profile Header ─── */}
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-6">
          <div className="flex items-start gap-12 md:gap-20">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-[150px] h-[150px] rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Profile"
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-lg">No photo</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2">
              {/* Username + buttons */}
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-xl font-normal text-gray-900">
                  {profile.username || "username"}
                </h1>
                <Button
                  onClick={openProfileEdit}
                  variant="outline"
                  className="h-8 px-4 text-sm font-semibold bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200 rounded-lg"
                >
                  Edit profile
                </Button>
                <button
                  onClick={() => router.push("/settings")}
                  className="p-1 text-gray-700 hover:text-gray-900"
                  aria-label="Settings"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-8 mt-5">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">
                    {reelsCount}
                  </span>
                  <span className="text-gray-600">reels</span>
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

              {/* Name, position, team, bio */}
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

        {/* ─── Tab bar ─── */}
        <div className="border-t border-gray-200 max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <button className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-900 border-t border-gray-900 -mt-px">
              <Grid3X3 className="w-3.5 h-3.5" />
              Reels
            </button>
          </div>
        </div>

        {/* ─── Reels Grid ─── */}
        <div className="max-w-4xl mx-auto px-6 pb-12">
          {reels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4">
                <Film className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                No reels yet
              </h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Upload a match and generate a highlight reel to see it here.
              </p>
              <Button
                onClick={() => router.push("/upload-page")}
                className="mt-6 bg-[#0047AB] hover:bg-[#003580] text-white"
              >
                Upload a match
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 mt-1">
              {reels.map((reel) => (
                <div
                  key={reel.id}
                  className="aspect-square bg-gray-100 relative group cursor-pointer overflow-hidden"
                  onClick={() => setSelectedReel(reel)}
                >
                  {reel.output_url ? (
                    <video
                      src={reel.output_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  {/* Privacy toggle */}
                  <button
                    className="absolute top-2 left-2 z-10 p-1 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                    title={
                      reel.is_public
                        ? "Public — click to make private"
                        : "Private — click to make public"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReelPrivacy(reel.id, reel.is_public);
                    }}
                    disabled={togglingReelId === reel.id}
                  >
                    {togglingReelId === reel.id ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : reel.is_public ? (
                      <Eye className="w-4 h-4 text-white" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-white" />
                    )}
                  </button>
                  {/* Play icon */}
                  <div className="absolute top-2 right-2">
                    <Play className="w-4 h-4 text-white drop-shadow-md fill-white" />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium px-2 text-center truncate">
                      {reel.title || "Highlight Reel"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── Reel Player Dialog ─── */}
      <Dialog.Root
        open={!!selectedReel}
        onOpenChange={(open) => {
          if (!open) setSelectedReel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black shadow-2xl overflow-hidden">
            <Dialog.Title className="sr-only">
              {selectedReel?.title || "Highlight Reel"}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Playing highlight reel video
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </Dialog.Close>
            {selectedReel?.output_url && (
              <video
                key={selectedReel.id}
                src={selectedReel.output_url}
                controls
                autoPlay
                className="w-full max-h-[80vh]"
              />
            )}
            <div className="px-4 py-3 bg-gray-900">
              <p className="text-white text-sm font-medium">
                {selectedReel?.title || "Highlight Reel"}
              </p>
              {selectedReel?.created_at && (
                <p className="text-gray-400 text-xs mt-0.5">
                  {new Date(selectedReel.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ─── Edit Profile Dialog ─── */}
      <Dialog.Root
        open={isProfileEditOpen}
        onOpenChange={(open) => {
          setIsProfileEditOpen(open);
          if (!open) {
            setProfileError("");
            setProfileSuccess(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg border border-gray-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Edit profile
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-600 mt-1">
                  Update your profile information and volleyball details.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              </Dialog.Close>
            </div>

            {profileSuccess ? (
              <div className="mt-6 flex flex-col items-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  Profile updated!
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Your profile has been saved successfully.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="username"
                      className="text-sm font-medium text-gray-900"
                    >
                      Username <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        @
                      </span>
                      <Input
                        id="username"
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="yourusername"
                        className="h-11 bg-gray-50 border-gray-200 pl-8"
                        maxLength={20}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Letters, numbers, and underscores only. Min 3 characters.
                    </p>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="display-name"
                      className="text-sm font-medium text-gray-900"
                    >
                      Display name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="display-name"
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="h-11 bg-gray-50 border-gray-200"
                    />
                  </div>

                  {/* Bio */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="bio"
                        className="text-sm font-medium text-gray-900"
                      >
                        Bio
                      </Label>
                      <span className="text-xs text-gray-500">
                        {editBio.length}/200
                      </span>
                    </div>
                    <textarea
                      id="bio"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="w-full min-h-[80px] px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      maxLength={200}
                    />
                  </div>

                  {/* Team */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="team"
                      className="text-sm font-medium text-gray-900"
                    >
                      Team affiliation
                    </Label>
                    <Input
                      id="team"
                      type="text"
                      value={editTeam}
                      onChange={(e) => setEditTeam(e.target.value)}
                      placeholder="Your team or club name"
                      className="h-11 bg-gray-50 border-gray-200"
                    />
                  </div>

                  {/* Position */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="position"
                      className="text-sm font-medium text-gray-900"
                    >
                      Position played
                    </Label>
                    <select
                      id="position"
                      value={editPosition}
                      onChange={(e) => setEditPosition(e.target.value)}
                      className="w-full h-11 px-3 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a position</option>
                      {VOLLEYBALL_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  {profileError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                      {profileError}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      disabled={savingProfile}
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    disabled={savingProfile}
                    className="bg-[#0047AB] hover:bg-[#003580] text-white"
                    onClick={handleSaveProfile}
                  >
                    {savingProfile ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SiteFooter />
    </div>
  );
}
