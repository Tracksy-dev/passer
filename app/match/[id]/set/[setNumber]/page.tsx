"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HighlightReelPanel } from "@/components/highlight-reel-panel";
import { ActionLegend } from "@/components/action-legend";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video-player";
import { highlightActionColors } from "@/lib/match-data";
import { getMatchTitle } from "@/lib/match-title";

import {
  ArrowLeft,
  AlertCircle,
  Trash2,
  X,
  CheckSquare,
  Square,
  Pencil,
} from "lucide-react";

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
  timestamp: number;
  action: HighlightAction;
  note?: string | null;
  clipBefore?: number; // seconds to include before the timestamp
  clipAfter?: number; // seconds to include after the timestamp
};

type MatchPointRow = {
  id: string;
  timestamp_seconds: number;
  label: string | null;
  note: string | null;
  clip_before: number | null;
  clip_after: number | null;
};

type ToastKind = "success" | "error";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type AiSmashProjectPoint = {
  timestamp_seconds: number;
  label?: string;
  note?: string;
};

type AiResultPayload = {
  success: boolean;
  smashRaw?: unknown;
  smashSeconds?: unknown;
  smashProjectPoints?: unknown;
  cached?: boolean;
};

type AiJobRow = {
  id: string;
  status: string;
  progress: number | null;
  message: string | null;
  processed_frames: number | null;
  total_frames: number | null;
  result_json: AiResultPayload | null;
  error_text: string | null;
  finished_at: string | null;
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

const MARK_OFFSET_SECONDS = 5;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function getActionColor(action: HighlightAction) {
  return highlightActionColors[action] ?? "#6B7280";
}

export default function MatchHighlightsPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const setNumber = parseInt(params.setNumber as string, 10) || 1;

  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [match, setMatch] = useState<{
    id: string;
    match_name: string | null;
    team_name: string | null;
    opponent: string | null;
    date: string;
    videoUrl: string | null;
  } | null>(null);

  const [isGeneratingSmashes, setIsGeneratingSmashes] = useState(false);
  const [aiSmashPoints, setAiSmashPoints] = useState<AiSmashProjectPoint[]>([]);
  const [isImportingAiSmashes, setIsImportingAiSmashes] = useState(false);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);
  const [aiJobProgress, setAiJobProgress] = useState<number>(0);
  const [aiJobMessage, setAiJobMessage] = useState<string>("Idle");
  const [aiJobProcessedFrames, setAiJobProcessedFrames] = useState<number | null>(null);
  const [aiJobTotalFrames, setAiJobTotalFrames] = useState<number | null>(null);
  const [aiJobError, setAiJobError] = useState<string | null>(null);
  const [hasDismissedCompletedJob, setHasDismissedCompletedJob] =
    useState(false);
  const [isCancellingJob, setIsCancellingJob] = useState(false);
  const [isEditingMatchTitle, setIsEditingMatchTitle] = useState(false);
  const [matchNameDraft, setMatchNameDraft] = useState("");
  const [isSavingMatchTitle, setIsSavingMatchTitle] = useState(false);
  const [matchRenameFeedback, setMatchRenameFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const skipMatchBlurSaveRef = useRef(false);

  const [points, setPoints] = useState<HighlightPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<HighlightAction>("spike");
  const [noteDraft, setNoteDraft] = useState("");

  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(
    new Set()
  );
  const [isMarking, setIsMarking] = useState(false);

  const [dirtyPointIds, setDirtyPointIds] = useState<Set<string>>(new Set());
  const [isSavingOffsets, setIsSavingOffsets] = useState(false);
  const hasUnsavedOffsets = dirtyPointIds.size > 0;
  const [generateWithoutSavingNonce, setGenerateWithoutSavingNonce] = useState(0);

  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const activeClipRef = useRef<{
    id: string;
    start: number;
    end: number;
  } | null>(null);

  const lastInsertedIdRef = useRef<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const aiJobStorageKey = useMemo(
    () => `ai-smash-job:${matchId}`,
    [matchId]
  );
  const lastCompletedJobToastRef = useRef<string | null>(null);

  const toast = {
    push: (kind: ToastKind, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, kind, message }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, kind === "error" ? 4500 : 2500);
    },
    dismiss: (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
  };

  useEffect(() => {
    if (!matchRenameFeedback) return;
    const timeoutId = window.setTimeout(
      () => setMatchRenameFeedback(null),
      3000
    );
    return () => window.clearTimeout(timeoutId);
  }, [matchRenameFeedback]);

  const startEditingMatchTitle = () => {
    if (!match) return;
    setMatchNameDraft(match.match_name ?? "");
    setIsEditingMatchTitle(true);
    setMatchRenameFeedback(null);
  };

  const cancelEditingMatchTitle = () => {
    setIsEditingMatchTitle(false);
    setMatchNameDraft("");
  };

  const saveMatchTitle = async () => {
    if (!match || isSavingMatchTitle) return;

    const trimmedDraft = matchNameDraft.trim();
    const nextMatchName = trimmedDraft.length > 0 ? trimmedDraft : null;
    const currentMatchName = match.match_name?.trim() || null;

    if (nextMatchName === currentMatchName) {
      cancelEditingMatchTitle();
      return;
    }

    try {
      setIsSavingMatchTitle(true);
      setMatchRenameFeedback(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You must be logged in to rename matches");

      const { error } = await supabase
        .from("matches")
        .update({ match_name: nextMatchName })
        .eq("id", match.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setMatch((prev) =>
        prev ? { ...prev, match_name: nextMatchName } : prev
      );
      setMatchRenameFeedback({
        kind: "success",
        message: "Match title saved",
      });
      toast.push("success", "Match title updated");
      cancelEditingMatchTitle();
    } catch (e) {
      console.error(e);
      setMatchRenameFeedback({
        kind: "error",
        message: "Failed to save title",
      });
      toast.push("error", "Failed to update match title");
    } finally {
      setIsSavingMatchTitle(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const k = e.key;
      if (/^[1-9]$/.test(k)) {
        const idx = Number(k) - 1;
        if (idx >= 0 && idx < ACTIONS.length) {
          e.preventDefault();
          const action = ACTIONS[idx];
          void markHighlight(action);
        }
        return;
      }

      if (k === "m" || k === " ") {
        e.preventDefault();
        void markHighlight();
        return;
      }

      if (k === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void handleUndo();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAction, isMarking, points]);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.timestamp - b.timestamp),
    [points]
  );

  const timelineMarkers = useMemo(() => {
    const safeDuration = videoDuration > 0 ? videoDuration : 1;

    return sortedPoints.map((p, i) => {
      const before = p.clipBefore ?? MARK_OFFSET_SECONDS;
      const after = p.clipAfter ?? MARK_OFFSET_SECONDS;

      const clipStart = Math.max(0, p.timestamp - before);
      const rawClipEnd = Math.max(clipStart, p.timestamp + after);
      const clipEnd =
        videoDuration > 0 ? Math.min(videoDuration, rawClipEnd) : rawClipEnd;
      const markerPoint = Math.min(Math.max(p.timestamp, clipStart), clipEnd);

      return {
        id: p.id,
        timestamp: p.timestamp,
        clipStart,
        clipEnd,
        label: `${p.action.toUpperCase()} #${i + 1}`,
        color: getActionColor(p.action),
        startPercent: (clipStart / safeDuration) * 100,
        endPercent: (clipEnd / safeDuration) * 100,
        pointPercent: (markerPoint / safeDuration) * 100,
      };
    });
  }, [sortedPoints, videoDuration]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setPageError(null);
        setVideoDuration(0);

        const { data: matchRow, error: matchErr } = await supabase
          .from("matches")
          .select(
            "id, match_name, match_date, opponent, team_name, video_path, video_url"
          )
          .eq("id", matchId)
          .single();

        if (matchErr) throw matchErr;
        if (!matchRow) throw new Error("Match not found");

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
          match_name: matchRow.match_name ?? null,
          team_name: matchRow.team_name ?? null,
          opponent: matchRow.opponent ?? null,
          date: matchRow.match_date,
          videoUrl: playableUrl,
        });

        const { data: pts, error: ptsErr } = await supabase
          .from("match_points")
          .select("id, timestamp_seconds, label, note, clip_before, clip_after")
          .eq("match_id", matchId)
          .order("timestamp_seconds", { ascending: true });

        if (ptsErr) throw ptsErr;

        const loaded = ((pts ?? []) as MatchPointRow[]).map((p) => ({
          id: p.id,
          timestamp: Number(p.timestamp_seconds),
          action: ((p.label as HighlightAction) ?? "other") as HighlightAction,
          note: p.note,
          clipBefore: p.clip_before ?? MARK_OFFSET_SECONDS,
          clipAfter: p.clip_after ?? MARK_OFFSET_SECONDS,
        }));

        setPoints(loaded);
        setSelectedPointIds(new Set(loaded.map((p) => p.id)));
        setDirtyPointIds(new Set());
      } catch (e) {
        setPageError(e instanceof Error ? e.message : "Failed to load match.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [matchId, setNumber]);

  const markHighlight = async (action?: HighlightAction) => {
    if (isMarking) return;
    const prevAction = selectedAction;
    if (action) setSelectedAction(action);

    const now = playerRef.current?.getCurrentTime() ?? 0;
    const t = Math.max(0, now - MARK_OFFSET_SECONDS);
    const trimmedNote = noteDraft.trim();

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
          label: action ?? prevAction,
          note: trimmedNote.length > 0 ? trimmedNote : null,
          clip_before: MARK_OFFSET_SECONDS,
          clip_after: MARK_OFFSET_SECONDS,
        })
        .select("id, timestamp_seconds, label, note, clip_before, clip_after")
        .single();

      if (insErr) throw insErr;

      const newPoint: HighlightPoint = {
        id: inserted.id,
        timestamp: Number(inserted.timestamp_seconds),
        action: (inserted.label as HighlightAction) ?? "other",
        note: inserted.note,
        clipBefore: MARK_OFFSET_SECONDS,
        clipAfter: MARK_OFFSET_SECONDS,
      };

      setPoints((p) => [...p, newPoint]);
      setSelectedPointId(newPoint.id);
      setSelectedPointIds((prev) => new Set(prev).add(newPoint.id));
      lastInsertedIdRef.current = newPoint.id;
      setCanUndo(true);
      setNoteDraft("");

      toast.push(
        "success",
        `Saved ${(newPoint.action as string).toUpperCase()} @ ${formatTime(t)}`
      );
    } catch (e) {
      console.error(e);
      toast.push("error", "Failed to mark highlight");
    } finally {
      setIsMarking(false);
    }
  };

  const updatePointOffset = (
    id: string,
    updates: { clipBefore?: number; clipAfter?: number; note?: string | null },
  ) => {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setDirtyPointIds((prev) => new Set(prev).add(id));
  };

  const applyOffsets = async (): Promise<boolean> => {
    if (dirtyPointIds.size === 0) return true;
    setIsSavingOffsets(true);

    try {
      const dirty = points.filter((p) => dirtyPointIds.has(p.id));
      // Supabase JS doesn't support batch-updating different rows in one call,
      // so we fire updates in parallel per dirty point.
      const results = await Promise.all(
        dirty.map((p) =>
          supabase
            .from("match_points")
            .update({
              clip_before: p.clipBefore ?? MARK_OFFSET_SECONDS,
              clip_after: p.clipAfter ?? MARK_OFFSET_SECONDS,
              note: p.note?.trim() ? p.note.trim() : null,
            })
            .eq("id", p.id)
        )
      );

      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        toast.push("error", `Failed to save ${failed.length} offset(s)`);
        return false;
      } else {
        toast.push("success", `Saved changes for ${dirty.length} point(s)`);
        setDirtyPointIds(new Set());
        return true;
      }
    } catch (e) {
      console.error(e);
      toast.push("error", "Failed to save offsets");
      return false;
    } finally {
      setIsSavingOffsets(false);
    }
  };

  const normalizeAiPoints = (payload: AiResultPayload): AiSmashProjectPoint[] => {
    if (!Array.isArray(payload.smashProjectPoints)) return [];

    const mapped: Array<AiSmashProjectPoint | null> = payload.smashProjectPoints.map(
      (p: unknown) => {
        if (!p || typeof p !== "object") return null;
        const candidate = p as {
          timestamp_seconds?: unknown;
          label?: unknown;
          note?: unknown;
        };
        const ts = Number(candidate.timestamp_seconds);
        if (!Number.isFinite(ts)) return null;

        return {
          timestamp_seconds: ts,
          label: typeof candidate.label === "string" ? candidate.label : "smash",
          note:
            typeof candidate.note === "string"
              ? candidate.note
              : "AI detected smash",
        };
      }
    );

    return mapped.filter(
      (p: AiSmashProjectPoint | null): p is AiSmashProjectPoint => p !== null
    );
  };

  const applyAiResult = (payload: AiResultPayload, jobId?: string) => {
    const aiPoints = normalizeAiPoints(payload);
    const aiSeconds = Array.isArray(payload.smashSeconds)
      ? payload.smashSeconds
      : [];
    const count = aiPoints.length || aiSeconds.length;

    setAiSmashPoints(aiPoints);

    if (jobId && lastCompletedJobToastRef.current === jobId) {
      return;
    }

    if (jobId) {
      lastCompletedJobToastRef.current = jobId;
    }

    toast.push(
      "success",
      count > 0
        ? `Detected ${count} smash timestamp${count > 1 ? "s" : ""}`
        : "No smash timestamps detected"
    );
  };

  const dismissAiJobCard = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(aiJobStorageKey);
    }

    setAiJobId(null);
    setAiJobStatus(null);
    setAiJobProgress(0);
    setAiJobMessage("Idle");
    setAiJobProcessedFrames(null);
    setAiJobTotalFrames(null);
    setAiJobError(null);
    setHasDismissedCompletedJob(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedJobId = localStorage.getItem(aiJobStorageKey);
    if (savedJobId) {
      setAiJobId(savedJobId);
      setHasDismissedCompletedJob(false);
    }
  }, [aiJobStorageKey]);

  useEffect(() => {
    if (!aiJobId || hasDismissedCompletedJob) return;

    let stopped = false;

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/ai/jobs/${aiJobId}`);
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          job?: AiJobRow;
        };

        if (stopped) return;

        if (data.success && data.job) {
          const job = data.job;
          setAiJobStatus(job.status);
          setAiJobProgress(job.progress ?? 0);
          setAiJobMessage(job.message ?? "Working...");
          setAiJobProcessedFrames(job.processed_frames ?? null);
          setAiJobTotalFrames(job.total_frames ?? null);
          setAiJobError(job.error_text ?? null);

          if (job.result_json?.success) {
            applyAiResult(job.result_json, job.id);
          }

          // Terminal states — stop polling.
          if (
            job.status === "completed" ||
            job.status === "failed" ||
            job.status === "cancelled"
          ) {
            return;
          }
        }
        // Non-terminal or transient error — fall through to reschedule.
      } catch {
        if (!stopped) {
          setAiJobMessage("Unable to fetch job status — retrying…");
        }
      }

      // Always reschedule unless the effect was cleaned up or a terminal
      // status was hit above (which returns early before reaching this line).
      if (!stopped) {
        window.setTimeout(() => void pollJob(), 1500);
      }
    };

    void pollJob();

    return () => {
      stopped = true;
    };
  }, [aiJobId, hasDismissedCompletedJob]);

  const handleCancelJob = async () => {
    if (!aiJobId || isCancellingJob) return;
    try {
      setIsCancellingJob(true);
      const res = await fetch(`/api/ai/jobs/${aiJobId}`, { method: "DELETE" });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Cancel failed");
      setAiJobStatus("cancelled");
      setAiJobMessage("Cancelled by user");
      setAiJobProgress(100);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setIsCancellingJob(false);
    }
  };

  const importAiSmashPoints = async () => {
    if (aiSmashPoints.length === 0 || isImportingAiSmashes) return;

    try {
      setIsImportingAiSmashes(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("Not logged in.");

      const tolerance = 0.01;
      const toInsert = aiSmashPoints.filter((ai) => {
        return !points.some(
          (p) =>
            Math.abs(p.timestamp - ai.timestamp_seconds) <= tolerance &&
            String(p.action).toLowerCase() === "smash"
        );
      });

      if (toInsert.length === 0) {
        toast.push("success", "All detected smashes are already imported");
        return;
      }

      const payload = toInsert.map((ai) => ({
        match_id: matchId,
        user_id: user.id,
        timestamp_seconds: ai.timestamp_seconds,
        label: "smash",
        note: ai.note ?? "AI detected smash",
        clip_before: MARK_OFFSET_SECONDS,
        clip_after: MARK_OFFSET_SECONDS,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from("match_points")
        .insert(payload)
        .select("id, timestamp_seconds, label, note, clip_before, clip_after");

      if (insertErr) throw insertErr;

      const newPoints: HighlightPoint[] = ((inserted ?? []) as MatchPointRow[]).map(
        (p) => ({
          id: p.id,
          timestamp: Number(p.timestamp_seconds),
          action: ((p.label as HighlightAction) ?? "other") as HighlightAction,
          note: p.note,
          clipBefore: p.clip_before ?? MARK_OFFSET_SECONDS,
          clipAfter: p.clip_after ?? MARK_OFFSET_SECONDS,
        })
      );

      if (newPoints.length > 0) {
        setPoints((prev) => [...prev, ...newPoints]);
        setSelectedPointIds((prev) => {
          const next = new Set(prev);
          newPoints.forEach((p) => next.add(p.id));
          return next;
        });
      }

      const skipped = aiSmashPoints.length - toInsert.length;
      toast.push(
        "success",
        `Imported ${toInsert.length} AI smash point${
          toInsert.length > 1 ? "s" : ""
        }${skipped > 0 ? ` (${skipped} already existed)` : ""}`
      );
    } catch (err) {
      console.error("Failed to import AI smashes", err);
      toast.push("error", "Failed to import AI smashes");
    } finally {
      setIsImportingAiSmashes(false);
    }
  };

  const handleVideoTimeUpdate = useCallback((time: number) => {
    setCurrentVideoTime(time);
    const clip = activeClipRef.current;
    if (clip && time >= clip.end) {
      playerRef.current?.pause();
      activeClipRef.current = null;
      setActiveClipId(null);
    }
  }, []);

  const handleSeek = (p: HighlightPoint) => {
    setSelectedPointId(p.id);
    const before = p.clipBefore ?? MARK_OFFSET_SECONDS;
    const after = p.clipAfter ?? MARK_OFFSET_SECONDS;
    const start = Math.max(0, p.timestamp - before);
    const end =
      videoDuration > 0
        ? Math.min(videoDuration, p.timestamp + after)
        : p.timestamp + after;

    activeClipRef.current = { id: p.id, start, end };
    setActiveClipId(p.id);
    setCurrentVideoTime(start);
    playerRef.current?.seekTo(start);
    playerRef.current?.play();
  };

  const handleMarkerClick = (markerId: string) => {
    const point = points.find((p) => p.id === markerId);
    if (!point) return;
    handleSeek(point);
  };

  const handleMarkerAdjust = (
    markerId: string,
    updates: { clipStart?: number; clipEnd?: number }
  ) => {
    const point = points.find((p) => p.id === markerId);
    if (!point) return;
    const localUpdates: { clipBefore?: number; clipAfter?: number } = {};
    if (updates.clipStart !== undefined) {
      localUpdates.clipBefore = Math.round((point.timestamp - updates.clipStart) * 10) / 10;
    }
    if (updates.clipEnd !== undefined) {
      localUpdates.clipAfter = Math.round((updates.clipEnd - point.timestamp) * 10) / 10;
    }
    updatePointOffset(markerId, localUpdates);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("match_points").delete().eq("id", id);
      if (error) throw error;

      setPoints((prev) => prev.filter((p) => p.id !== id));
      setDirtyPointIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelectedPointIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      if (selectedPointId === id) setSelectedPointId(null);
      if (activeClipId === id) {
        activeClipRef.current = null;
        setActiveClipId(null);
      }
      if (lastInsertedIdRef.current === id) {
        lastInsertedIdRef.current = null;
        setCanUndo(false);
      }

      toast.push("success", "Highlight deleted");
    } catch (e) {
      console.error(e);
      toast.push("error", "Failed to delete highlight");
    }
  };

  const handleUndo = async () => {
    const id = lastInsertedIdRef.current;
    if (!id) return;
    await handleDelete(id);
    toast.push("success", "Last highlight undone");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 px-6 py-8">
          <div className="max-w-[1500px] mx-auto space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-gray-200 rounded" />
              <div className="h-96 bg-gray-200 rounded" />
            </div>
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
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-50">
      <SiteHeader showNav={true} activePage="dashboard" />

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 ease-out ${
          hasUnsavedOffsets ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 12%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.10) 24%, rgba(245,158,11,0.04) 46%, rgba(245,158,11,0.00) 68%), linear-gradient(180deg, rgba(255,251,235,0.40) 0%, rgba(255,251,235,0.14) 42%, rgba(255,255,255,0) 78%)",
          mixBlendMode: "multiply",
        }}
      />

      <main className="relative z-10 flex-1 bg-transparent px-4 md:px-6 lg:px-8 py-6 md:py-8 transition-colors duration-1000 ease-out">
        <div className="relative z-10 max-w-[88rem] mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>

              <div>
                {isEditingMatchTitle ? (
                  <div className="space-y-1">
                    <Input
                      autoFocus
                      value={matchNameDraft}
                      onChange={(e) => setMatchNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveMatchTitle();
                          return;
                        }

                        if (e.key === "Escape") {
                          e.preventDefault();
                          skipMatchBlurSaveRef.current = true;
                          cancelEditingMatchTitle();
                        }
                      }}
                      onBlur={() => {
                        if (skipMatchBlurSaveRef.current) {
                          skipMatchBlurSaveRef.current = false;
                          return;
                        }
                        void saveMatchTitle();
                      }}
                      disabled={isSavingMatchTitle}
                      className="h-9 min-w-[18rem]"
                      placeholder="Enter match title"
                    />
                    <p className="text-xs text-gray-500">
                      Enter to save, Esc to cancel
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-left text-2xl font-bold text-gray-900 hover:text-[#0047AB] transition-colors"
                    onClick={startEditingMatchTitle}
                    title="Click to rename"
                  >
                    <span className="inline-flex items-center gap-2">
                      {getMatchTitle(match)}
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </span>
                  </button>
                )}

                {!isEditingMatchTitle && (
                  <p className="text-xs text-gray-400 mt-1">
                    Click title to rename
                  </p>
                )}

                {isSavingMatchTitle && (
                  <p className="text-xs text-[#0047AB] mt-1">Saving title...</p>
                )}

                {matchRenameFeedback && (
                  <p
                    className={`text-xs mt-1 ${
                      matchRenameFeedback.kind === "success"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {matchRenameFeedback.message}
                  </p>
                )}

                <p className="text-sm text-gray-600">
                  {new Date(match.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Layout: video left, highlights right */}
          <div className="grid md:grid-cols-12 gap-4 md:gap-6 items-start">
            {/* Video (2/3) */}
            <div className="md:col-span-8 space-y-4">
              <VideoPlayer
                ref={playerRef}
                title="Match Replay"
                src={match.videoUrl}
                onTimeUpdate={handleVideoTimeUpdate}
                currentTime={currentVideoTime}
                onDurationChange={setVideoDuration}
                markers={timelineMarkers}
                activeMarkerId={activeClipId ?? selectedPointId}
                onMarkerClick={handleMarkerClick}
                onMarkerAdjust={handleMarkerAdjust}
                onMarkPoint={() => {
                  void markHighlight();
                }}
                markDisabled={isMarking}
                isMarking={isMarking}
              />

              <div className="mt-4">
                <HighlightReelPanel
                  matchId={matchId}
                  selectedPointIds={selectedPointIds}
                  hasUnsavedOffsets={hasUnsavedOffsets}
                  unsavedPointCount={dirtyPointIds.size}
                  generateWithoutSavingNonce={generateWithoutSavingNonce}
                  onGenerateWithoutSaving={() => {
                    setGenerateWithoutSavingNonce((n) => n + 1);
                  }}
                  onSaveOffsets={applyOffsets}
                />
              </div>

            </div>

            {/* Highlights panel (1/3) */}
            <div className="md:col-span-4">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-4 border-b border-gray-200">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          (Beta) AI Smash detection
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Automatically detect smash moments in the match video.
                        </p>
                      </div>

                      <Button
                        type="button"
                        className="bg-[#0047AB] hover:bg-[#003580] text-white"
                        disabled={
                          isGeneratingSmashes ||
                          !match.videoUrl ||
                          (aiJobStatus !== null &&
                            aiJobStatus !== "completed" &&
                            aiJobStatus !== "failed")
                        }
                        onClick={async () => {
                          try {
                            setIsGeneratingSmashes(true);
                            setHasDismissedCompletedJob(false);
                            setAiJobError(null);

                            const res = await fetch("/api/ai/ai-function", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                videoUrl: match.videoUrl,
                                matchId,
                              }),
                            });

                            const raw = await res.text();
                            console.log("Raw response:", raw);

                            let data;
                            try {
                              data = JSON.parse(raw);
                            } catch {
                              throw new Error(`Expected JSON but got: ${raw}`);
                            }

                            if (data.success) {
                              if (typeof data.jobId === "string") {
                                setAiJobId(data.jobId);
                                setAiJobStatus(String(data.status ?? "queued"));
                                setAiJobMessage(String(data.message ?? "Queued"));
                                setAiJobProgress(
                                  typeof data.progress === "number"
                                    ? data.progress
                                    : data.status === "completed"
                                    ? 100
                                    : 0
                                );
                                if (typeof window !== "undefined") {
                                  localStorage.setItem(aiJobStorageKey, data.jobId);
                                }
                              }

                              if (data.result_json?.success) {
                                applyAiResult(data.result_json, data.jobId);
                              } else {
                                toast.push("success", "AI smash job started");
                              }
                            } else {
                              console.error("Error:", data.error);
                              toast.push(
                                "error",
                                data.error ?? "Failed to generate smashes"
                              );
                            }
                          } catch (err) {
                            console.error("Request failed", err);
                            toast.push("error", "Request failed");
                          } finally {
                            setIsGeneratingSmashes(false);
                          }
                        }}
                      >
                        {isGeneratingSmashes
                          ? "Generating..."
                          : aiJobStatus &&
                            aiJobStatus !== "completed" &&
                            aiJobStatus !== "failed"
                          ? "Processing..."
                          : "Generate smashes"}
                      </Button>
                    </div>

                    {aiJobId && !hasDismissedCompletedJob && (
                      <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-gray-700">
                            {aiJobMessage}
                          </p>
                          <p className="text-xs text-gray-500">{aiJobProgress}%</p>
                        </div>

                        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              aiJobStatus === "failed"
                                ? "bg-red-500"
                                : aiJobStatus === "cancelled"
                                ? "bg-gray-400"
                                : aiJobStatus === "completed"
                                ? "bg-green-500"
                                : "bg-[#0047AB]"
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, aiJobProgress))}%` }}
                          />
                        </div>

                        {(aiJobProcessedFrames !== null ||
                          aiJobTotalFrames !== null) && (
                          <p className="text-[11px] text-gray-500">
                            {aiJobProcessedFrames ?? 0}
                            {aiJobTotalFrames !== null ? ` / ${aiJobTotalFrames}` : ""} frames
                          </p>
                        )}

                        {aiJobError && (
                          <p className="text-xs text-red-600">{aiJobError}</p>
                        )}

                        <div className="flex justify-end gap-2">
                          {aiJobStatus !== "completed" &&
                            aiJobStatus !== "failed" &&
                            aiJobStatus !== "cancelled" && (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => void handleCancelJob()}
                                disabled={isCancellingJob}
                              >
                                {isCancellingJob ? "Cancelling…" : "Cancel"}
                              </Button>
                            )}
                          {(aiJobStatus === "completed" ||
                            aiJobStatus === "failed" ||
                            aiJobStatus === "cancelled") && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-7 px-2 text-xs border-gray-300"
                              onClick={dismissAiJobCard}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        {aiSmashPoints.length > 0
                          ? `${aiSmashPoints.length} AI smash timestamp${
                              aiSmashPoints.length > 1 ? "s" : ""
                            } ready to import`
                          : "Generate smashes to prepare import points"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs border-gray-300"
                        onClick={() => void importAiSmashPoints()}
                        disabled={
                          aiSmashPoints.length === 0 ||
                          isImportingAiSmashes ||
                          isGeneratingSmashes
                        }
                      >
                        {isImportingAiSmashes
                          ? "Importing..."
                          : "Import AI smashes"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-b border-gray-200">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => void markHighlight()}
                      disabled={isMarking}
                      className="flex-1 bg-[#0047AB] hover:bg-[#003580] text-white disabled:opacity-60"
                    >
                      {isMarking
                        ? "Marking..."
                        : `Mark Highlight (-${MARK_OFFSET_SECONDS}s)`}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => void handleUndo()}
                      disabled={!canUndo || isMarking}
                      className="border-gray-300 text-gray-600 disabled:opacity-40"
                      title="Undo last highlight (Ctrl+Z)"
                    >
                      Undo
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {ACTIONS.map((action) => {
                      const active = action === selectedAction;
                      const color = getActionColor(action);
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setSelectedAction(action)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#0047AB] ${
                            active
                              ? "text-white border-transparent"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                          style={active ? { backgroundColor: color, borderColor: color } : undefined}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: active ? "rgba(255,255,255,0.65)" : color }}
                            aria-hidden="true"
                          />
                          {action.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <Input
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add note for next marked point (optional)"
                      className="h-9"
                    />
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    Pick an action, then hit “Mark Highlight”. We save 5s
                    earlier. You can also press number keys to capture directly.
                  </p>

                  <div className="mt-3">
                    <ActionLegend
                      items={ACTIONS.map((a, i) => ({
                        keyLabel: `${i + 1}`,
                        label: a.toUpperCase(),
                        color: getActionColor(a),
                      }))}
                    />
                  </div>
                </div>

                {hasUnsavedOffsets && (
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-medium text-gray-700">
                      {dirtyPointIds.size} unsaved point change
                      {dirtyPointIds.size > 1 ? "s" : ""}
                    </span>
                    <Button
                      onClick={() => void applyOffsets()}
                      disabled={isSavingOffsets}
                      className="h-7 px-3 text-xs bg-[#0047AB] hover:bg-[#003580] text-white"
                    >
                      {isSavingOffsets ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                )}

                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Highlights
                  </span>
                  <span className="text-xs text-gray-500">
                    {selectedPointIds.size}/{sortedPoints.length} selected
                  </span>
                </div>

                {sortedPoints.length > 0 && (
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs border-gray-300"
                        onClick={() =>
                          setSelectedPointIds(new Set(sortedPoints.map((p) => p.id)))
                        }
                        disabled={selectedPointIds.size === sortedPoints.length}
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-1" />
                        Select All
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs border-gray-300"
                        onClick={() => setSelectedPointIds(new Set())}
                        disabled={selectedPointIds.size === 0}
                      >
                        <Square className="w-3.5 h-3.5 mr-1" />
                        Deselect All
                      </Button>
                    </div>

                    <span className="text-xs text-gray-500">
                      ~
                      {(() => {
                        const totalSec = sortedPoints
                          .filter((p) => selectedPointIds.has(p.id))
                          .reduce(
                            (sum, p) =>
                              sum +
                              (p.clipBefore ?? MARK_OFFSET_SECONDS) +
                              (p.clipAfter ?? MARK_OFFSET_SECONDS),
                            0
                          );
                        return formatTime(totalSec);
                      })()}{" "}
                      est. duration
                    </span>
                  </div>
                )}

                <div className="overflow-y-auto max-h-[24rem] md:max-h-[36rem] lg:max-h-[44rem]">
                  {sortedPoints.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">
                      No highlights yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {sortedPoints.map((p) => {
                        const selected = p.id === selectedPointId;
                        const isPlaying = p.id === activeClipId;
                        const actionColor = getActionColor(p.action);

                        const before = p.clipBefore ?? MARK_OFFSET_SECONDS;
                        const after = p.clipAfter ?? MARK_OFFSET_SECONDS;
                        const clipStart = Math.max(0, p.timestamp - before);
                        const rawClipEnd = p.timestamp + after;
                        const clipEnd =
                          videoDuration > 0
                            ? Math.min(videoDuration, rawClipEnd)
                            : rawClipEnd;
                        const clipDuration = clipEnd - clipStart;

                        let progress = 0;
                        if (isPlaying && clipDuration > 0) {
                          progress = Math.min(
                            1,
                            Math.max(0, (currentVideoTime - clipStart) / clipDuration)
                          );
                        }

                        return (
                          <li
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSeek(p)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSeek(p);
                              }
                            }}
                            style={{ borderLeftColor: actionColor }}
                            className={`border-l-4 px-3 pt-2.5 pb-2 space-y-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0047AB] ${
                              isPlaying || selected
                                ? "bg-blue-50"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide text-white flex-shrink-0"
                                style={{ backgroundColor: actionColor }}
                              >
                                {p.action.toUpperCase()}
                              </span>

                              <span className="text-xs font-mono text-gray-600 tabular-nums flex-shrink-0">
                                {formatTime(p.timestamp)}
                              </span>

                              {dirtyPointIds.has(p.id) && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
                                  title="Unsaved changes"
                                  aria-label="Unsaved changes"
                                />
                              )}

                              <div className="flex-1" />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPointIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(p.id)) next.delete(p.id);
                                    else next.add(p.id);
                                    return next;
                                  });
                                }}
                                className="flex-shrink-0 p-1 rounded transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0047AB]"
                                aria-label={
                                  selectedPointIds.has(p.id)
                                    ? "Exclude from reel"
                                    : "Include in reel"
                                }
                              >
                                {selectedPointIds.has(p.id) ? (
                                  <CheckSquare className="w-4 h-4 text-[#0047AB]" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(p.id);
                                }}
                                className="flex-shrink-0 p-1 rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                aria-label="Delete highlight"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-mono tabular-nums text-gray-700">
                                Clip: {formatTime(clipStart)} - {formatTime(clipEnd)}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                Adjust by dragging timeline clip handles
                              </span>
                            </div>

                            <Input
                              value={p.note ?? ""}
                              onChange={(e) =>
                                updatePointOffset(p.id, { note: e.target.value })
                              }
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.stopPropagation()}
                              placeholder="Note (optional)"
                              className="h-7 text-xs"
                            />

                            <div>
                              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-150 ${
                                    isPlaying
                                      ? "bg-[#0047AB]"
                                      : selected
                                      ? "bg-blue-300"
                                      : "bg-gray-300"
                                  }`}
                                  style={{
                                    width: `${
                                      isPlaying
                                        ? progress * 100
                                        : selected
                                        ? 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              {(isPlaying || selected) && (
                                <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                                  <span>{formatTime(clipStart)}</span>
                                  {isPlaying && (
                                    <span className="text-[#0047AB] font-medium">
                                      {formatTime(currentVideoTime)}
                                    </span>
                                  )}
                                  <span>{formatTime(clipEnd)}</span>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`w-[320px] rounded-lg border shadow-lg p-4 flex items-start gap-3 ${
              t.kind === "success"
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  t.kind === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {t.message}
              </p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-gray-500 hover:text-gray-800"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}