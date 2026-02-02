"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video-player";

import { ArrowLeft, AlertCircle, Trash2 } from "lucide-react";

type HighlightAction =
  | "spike"
  | "set"
  | "block"
  | "pass"
  | "ace"
  | "save"
  | "other";

type HighlightPoint = {
  id: string;
  timestamp: number; // seconds
  action: HighlightAction;
};

const ACTIONS: HighlightAction[] = [
  "spike",
  "set",
  "block",
  "pass",
  "ace",
  "save",
  "other",
];

const MARK_OFFSET_SECONDS = 7;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MatchHighlightsPage() {
  const params = useParams();
  const router = useRouter();

  const matchId = params.id as string;
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const [match, setMatch] = useState<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    videoUrl: string | null;
  } | null>(null);

  const [points, setPoints] = useState<HighlightPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Segmented control selection (used when you press Mark Highlight)
  const [selectedAction, setSelectedAction] =
    useState<HighlightAction>("spike");

  const [isMarking, setIsMarking] = useState(false);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.timestamp - b.timestamp),
    [points]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setPageError(null);

        // 1) Fetch match
        const { data: matchRow, error: matchErr } = await supabase
          .from("matches")
          .select("id, match_date, opponent, team_name, video_path, video_url")
          .eq("id", matchId)
          .single();

        if (matchErr) throw matchErr;
        if (!matchRow) throw new Error("Match not found");

        // 2) Get playable URL
        let playableUrl: string | null = matchRow.video_url ?? null;

        if (!playableUrl && matchRow.video_path) {
          const { data: signed, error: signedErr } = await supabase.storage
            .from("match-videos")
            .createSignedUrl(matchRow.video_path, 60 * 60);

          if (signedErr) throw signedErr;
          playableUrl = signed.signedUrl;
        }

        setMatch({
          id: matchRow.id,
          homeTeam: matchRow.team_name ?? "Home",
          awayTeam: matchRow.opponent ?? "Away",
          date: matchRow.match_date,
          videoUrl: playableUrl,
        });

        // 3) Load highlights
        const { data: pts, error: ptsErr } = await supabase
          .from("match_points")
          .select("id, timestamp_seconds, label")
          .eq("match_id", matchId)
          .order("timestamp_seconds", { ascending: true });

        if (ptsErr) throw ptsErr;

        setPoints(
          (pts ?? []).map((p) => ({
            id: p.id,
            timestamp: Number(p.timestamp_seconds),
            action: ((p.label as HighlightAction) ?? "other") as HighlightAction,
          }))
        );
      } catch (e) {
        setPageError(e instanceof Error ? e.message : "Failed to load match.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [matchId]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const showOpError = (msg: string) => {
    setOperationError(msg);
    setTimeout(() => setOperationError(null), 4500);
  };

  const handleMarkHighlight = async () => {
    if (isMarking) return;

    const now = playerRef.current?.getCurrentTime() ?? 0;
    const t = Math.max(0, now - MARK_OFFSET_SECONDS);

    // UX: jump back so user sees the moment that was captured
    playerRef.current?.seekTo(t);

    try {
      setIsMarking(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("Not logged in.");

      const { data: inserted, error: insErr } = await supabase
        .from("match_points")
        .insert({
          match_id: matchId,
          user_id: user.id,
          timestamp_seconds: t,
          label: selectedAction,
        })
        .select("id, timestamp_seconds, label")
        .single();

      if (insErr) throw insErr;

      const newPoint: HighlightPoint = {
        id: inserted.id,
        timestamp: Number(inserted.timestamp_seconds),
        action: (inserted.label as HighlightAction) ?? "other",
      };

      setPoints((prev) => [...prev, newPoint]);
      setSelectedPointId(newPoint.id);

      showSuccess(`Saved: ${newPoint.action.toUpperCase()} @ ${formatTime(t)}`);
    } catch (e) {
      console.error(e);
      showOpError("Failed to mark highlight");
    } finally {
      setIsMarking(false);
    }
  };

  const handleSeek = (p: HighlightPoint) => {
    setSelectedPointId(p.id);
    playerRef.current?.seekTo(p.timestamp);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("match_points").delete().eq("id", id);
      if (error) throw error;

      setPoints((prev) => prev.filter((p) => p.id !== id));
      if (selectedPointId === id) setSelectedPointId(null);

      showSuccess("Highlight deleted");
    } catch (e) {
      console.error(e);
      showOpError("Failed to delete highlight");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 px-6 py-8">
          <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-96 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (pageError || !match) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {pageError ?? "Match Not Found"}
            </h1>
            <p className="text-gray-600 mb-6">
              There was a problem loading this match.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} activePage="dashboard" />

      <main className="flex-1 bg-gray-50 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Success / Error banners */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          )}

          {operationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-medium text-red-800">
                {operationError}
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {match.homeTeam} vs {match.awayTeam}
                </h1>
                <p className="text-sm text-gray-600">
                  {new Date(match.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Video + Controls */}
          <div className="space-y-4">
            <VideoPlayer ref={playerRef} title="Match Replay" src={match.videoUrl} />

            {/* Mark + segmented control */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleMarkHighlight}
                    disabled={isMarking}
                    className="bg-[#0047AB] hover:bg-[#003580] text-white disabled:opacity-60"
                  >
                    {isMarking ? "Marking..." : `Mark Highlight`}
                  </Button>

                  <span className="text-xs text-gray-500">
                    Uses current action selection
                  </span>
                </div>
              </div>

              {/* Segmented control */}
              <div className="mt-4 flex flex-wrap gap-2">
                {ACTIONS.map((action) => {
                  const active = action === selectedAction;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setSelectedAction(action)}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#0047AB] text-white border-[#0047AB]"
                          : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {action.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Tip: Select an action, then click “Mark Highlight”. We’ll save a highlight
                 ~{MARK_OFFSET_SECONDS} seconds earlier to account for reaction time.
              </p>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  Highlights
                </span>
                <span className="text-xs text-gray-500">
                  {sortedPoints.length} saved
                </span>
              </div>

              {sortedPoints.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">
                  No highlights yet. Pick an action then press “Mark Highlight”.
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {sortedPoints.map((p) => {
                    const selected = p.id === selectedPointId;
                    return (
                      <li
                        key={p.id}
                        className={`px-4 py-3 flex items-center justify-between gap-3 ${
                          selected ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => handleSeek(p)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {p.action.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatTime(p.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Click to seek
                          </p>
                        </button>

                        <Button
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => handleDelete(p.id)}
                          aria-label="Delete highlight"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
