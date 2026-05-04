"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { getReelTitle } from "@/lib/match-title";
import { Trash2, Loader2, Eye, EyeOff, Globe, Pencil } from "lucide-react";

type ReelJobStatus = "queued" | "processing" | "complete" | "failed";

type ReelJobRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: ReelJobStatus;
  clip_before: number;
  clip_after: number;
  output_path: string | null;
  output_url: string | null;
  error: string | null;
  created_at: string;
  title?: string | null;
  is_public: boolean;
  show_on_explore: boolean;
};

type ReelRenameFeedback = {
  reelId: string;
  kind: "success" | "error";
  message: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function HighlightReelPanel({
  matchId,
  selectedPointIds,
  hasUnsavedOffsets = false,
  unsavedPointCount = 0,
  generateWithoutSavingNonce = 0,
  onGenerateWithoutSaving,
  onSaveOffsets,
}: {
  matchId: string;
  selectedPointIds: Set<string>;
  hasUnsavedOffsets?: boolean;
  unsavedPointCount?: number;
  generateWithoutSavingNonce?: number;
  onGenerateWithoutSaving?: () => void;
  onSaveOffsets?: () => Promise<boolean>;
}) {
  const [reels, setReels] = useState<ReelJobRow[]>([]);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isSavingAndStarting, setIsSavingAndStarting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
  const [editingReelId, setEditingReelId] = useState<string | null>(null);
  const [reelTitleDraft, setReelTitleDraft] = useState("");
  const [renamingReelId, setRenamingReelId] = useState<string | null>(null);
  const [renameFeedback, setRenameFeedback] =
    useState<ReelRenameFeedback | null>(null);
  const skipBlurSaveForReelIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);
  const lastGenerateWithoutSavingNonceRef = useRef(0);

  const selected = useMemo(
    () => reels.find((r) => r.id === selectedReelId) ?? null,
    [reels, selectedReelId],
  );

  const loadReels = async () => {
    const { data, error } = await supabase
      .from("reel_jobs")
      .select(
        "id, match_id, user_id, status, clip_before, clip_after, output_path, output_url, error, created_at, title, is_public, show_on_explore",
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as ReelJobRow[];
    setReels(rows);

    // Keep selection stable / sensible
    setSelectedReelId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  };

  useEffect(() => {
    loadReels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (!renameFeedback) return;
    const timeoutId = window.setTimeout(() => setRenameFeedback(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [renameFeedback]);

  // Poll any queued/processing reels
  useEffect(() => {
    const hasActive = reels.some(
      (r) => r.status === "queued" || r.status === "processing",
    );
    if (!hasActive) return;

    const interval = window.setInterval(() => {
      loadReels();
    }, 2000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels]);

  const startNewReel = async () => {
    if (isStarting || isSavingAndStarting) return;

    try {
      setIsStarting(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("You must be logged in.");

      const pointIds = Array.from(selectedPointIds);

      if (pointIds.length < 1) {
        throw new Error("Select at least one highlight to generate a reel.");
      }

      // Guard against stale selections: only keep IDs that still exist on this match.
      const { data: existingRows, error: pointsErr } = await supabase
        .from("match_points")
        .select("id")
        .eq("match_id", matchId)
        .in("id", pointIds);

      if (pointsErr) throw pointsErr;

      const verifiedPointIds = (existingRows ?? []).map((row) => row.id);
      if (verifiedPointIds.length < 1) {
        throw new Error("Selected highlights no longer exist. Please reselect.");
      }

      const { data: inserted, error: insErr } = await supabase
        .from("reel_jobs")
        .insert({
          match_id: matchId,
          user_id: user.id,
          status: "queued",
          clip_before: 6,
          clip_after: 6,
          title: null,
          point_ids: verifiedPointIds,
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      await loadReels();
      if (inserted?.id) setSelectedReelId(inserted.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create reel job");
    } finally {
      setIsStarting(false);
    }
  };

  const saveThenStartNewReel = async () => {
    if (!onSaveOffsets) {
      await startNewReel();
      return;
    }

    try {
      setIsSavingAndStarting(true);
      setError(null);

      const saved = await onSaveOffsets();
      if (!saved) return;

      await startNewReel();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to save changes before generating reel",
      );
    } finally {
      setIsSavingAndStarting(false);
    }
  };

  const handleGenerateClick = () => {
    if (hasUnsavedOffsets && onSaveOffsets) {
      setConfirmUnsavedOpen(true);
      return;
    }

    void startNewReel();
  };

  useEffect(() => {
    if (generateWithoutSavingNonce <= 0) return;
    if (generateWithoutSavingNonce === lastGenerateWithoutSavingNonceRef.current) return;

    lastGenerateWithoutSavingNonceRef.current = generateWithoutSavingNonce;
    void startNewReel();
  }, [generateWithoutSavingNonce]);

  const startInlineReelRename = (reel: ReelJobRow) => {
    setEditingReelId(reel.id);
    setReelTitleDraft(reel.title ?? "");
    setRenameFeedback(null);
    setError(null);
  };

  const cancelInlineReelRename = () => {
    setEditingReelId(null);
    setReelTitleDraft("");
  };

  const saveInlineReelRename = async (reel: ReelJobRow) => {
    if (renamingReelId === reel.id) return;

    const trimmedDraft = reelTitleDraft.trim();
    const nextTitle = trimmedDraft.length > 0 ? trimmedDraft : null;
    const currentTitle = reel.title?.trim() || null;

    if (nextTitle === currentTitle) {
      cancelInlineReelRename();
      return;
    }

    try {
      setRenamingReelId(reel.id);
      setRenameFeedback(null);
      setError(null);

      const { error: updateErr } = await supabase
        .from("reel_jobs")
        .update({ title: nextTitle })
        .eq("id", reel.id);

      if (updateErr) throw updateErr;

      setReels((prev) =>
        prev.map((row) =>
          row.id === reel.id ? { ...row, title: nextTitle } : row,
        ),
      );
      setRenameFeedback({
        reelId: reel.id,
        kind: "success",
        message: "Reel title saved",
      });
      cancelInlineReelRename();
    } catch (e) {
      console.error(e);
      setRenameFeedback({
        reelId: reel.id,
        kind: "error",
        message: "Failed to save title",
      });
    } finally {
      setRenamingReelId(null);
    }
  };

  const deleteReel = async (reelJobId: string) => {
    try {
      setIsDeletingId(reelJobId);
      setError(null);

      const { data: job, error: jobErr } = await supabase
        .from("reel_jobs")
        .select("id, output_path")
        .eq("id", reelJobId)
        .single();

      if (jobErr) throw jobErr;

      if (job.output_path) {
        const { error: storageErr } = await supabase.storage
          .from("highlight-reels")
          .remove([job.output_path]);

        if (storageErr) throw storageErr;
      }

      const { error: dbErr } = await supabase
        .from("reel_jobs")
        .delete()
        .eq("id", reelJobId);

      if (dbErr) throw dbErr;

      await loadReels();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to delete reel");
    } finally {
      setIsDeletingId(null);
    }
  };

  const togglePrivacy = async (reelJobId: string, currentlyPublic: boolean) => {
    try {
      setIsTogglingId(reelJobId);
      setError(null);

      // If making private, also unset show_on_explore
      const updates: { is_public: boolean; show_on_explore?: boolean } = {
        is_public: !currentlyPublic,
      };
      if (currentlyPublic) {
        updates.show_on_explore = false;
      }

      const { error: updateErr } = await supabase
        .from("reel_jobs")
        .update(updates)
        .eq("id", reelJobId);

      if (updateErr) throw updateErr;

      // Update local state immediately
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelJobId
            ? {
                ...r,
                is_public: !currentlyPublic,
                ...(currentlyPublic ? { show_on_explore: false } : {}),
              }
            : r,
        ),
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to update privacy");
    } finally {
      setIsTogglingId(null);
    }
  };

  const toggleExplore = async (
    reelJobId: string,
    currentlyOnExplore: boolean,
  ) => {
    try {
      setIsTogglingId(reelJobId);
      setError(null);

      const { error: updateErr } = await supabase
        .from("reel_jobs")
        .update({ show_on_explore: !currentlyOnExplore })
        .eq("id", reelJobId);

      if (updateErr) throw updateErr;

      setReels((prev) =>
        prev.map((r) =>
          r.id === reelJobId
            ? { ...r, show_on_explore: !currentlyOnExplore }
            : r,
        ),
      );
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Failed to update explore visibility",
      );
    } finally {
      setIsTogglingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900">
            Highlight Reels
          </span>
          {hasUnsavedOffsets && (
            <p className="mt-0.5 text-[11px] text-amber-800">
              {unsavedPointCount} unsaved point change
              {unsavedPointCount === 1 ? "" : "s"} need saving before generating.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasUnsavedOffsets && (
            <Button
              variant="outline"
              onClick={() => onGenerateWithoutSaving?.()}
              disabled={isStarting || isSavingAndStarting || selectedPointIds.size === 0}
              className="h-8 px-3 text-xs border-gray-300 text-gray-700 hover:bg-gray-100"
              title="Generate reel without saving"
            >
              Generate reel without saving
            </Button>
          )}

          <Button
            onClick={handleGenerateClick}
            disabled={isStarting || selectedPointIds.size === 0}
            className="h-8 px-3 bg-[#0047AB] hover:bg-[#003580] text-white disabled:opacity-50"
            title={
              selectedPointIds.size === 0
                ? "Select at least one highlight to generate a reel"
                : hasUnsavedOffsets
                  ? "You have unsaved offset changes"
                  : undefined
            }
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : isSavingAndStarting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              hasUnsavedOffsets ? "Generate reel" : "Generate new"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
          {error}
        </div>
      )}

      <div className="p-4 border-b border-gray-200">
        {selected?.output_url ? (
          <video
            controls
            className="w-full rounded-lg border border-gray-200 bg-black"
            src={selected.output_url}
          />
        ) : (
          <div className="text-sm text-gray-600">
            {selected
              ? selected.status === "failed"
                ? `Failed: ${selected.error ?? "Unknown error"}`
                : `Status: ${selected.status}`
              : "No reels yet. Generate your first one!"}
          </div>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {reels.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No reels created yet.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {reels.map((r) => {
              const active = r.id === selectedReelId;
              const disableDelete =
                isDeletingId === r.id ||
                r.status === "queued" ||
                r.status === "processing";
              const isCompleted = r.status === "complete";

              return (
                <li
                  key={r.id}
                  className={`p-4 flex items-start justify-between gap-3 ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    className="flex-1 text-left min-w-0"
                    onClick={() => {
                      if (editingReelId !== r.id) {
                        setSelectedReelId(r.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (editingReelId === r.id) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedReelId(r.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between">
                      {editingReelId === r.id ? (
                        <Input
                          autoFocus
                          value={reelTitleDraft}
                          onChange={(e) => setReelTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveInlineReelRename(r);
                              return;
                            }

                            if (e.key === "Escape") {
                              e.preventDefault();
                              skipBlurSaveForReelIdRef.current = r.id;
                              cancelInlineReelRename();
                            }
                          }}
                          onBlur={() => {
                            if (skipBlurSaveForReelIdRef.current === r.id) {
                              skipBlurSaveForReelIdRef.current = null;
                              return;
                            }
                            void saveInlineReelRename(r);
                          }}
                          disabled={renamingReelId === r.id}
                          placeholder="Enter reel title"
                          className="h-8 mr-2"
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-sm font-medium text-gray-900 hover:text-[#0047AB] transition-colors text-left truncate max-w-[70%] inline-flex items-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            startInlineReelRename(r);
                          }}
                          title="Click to rename"
                        >
                          <span className="truncate">{getReelTitle(r.title)}</span>
                          <Pencil className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        </button>
                      )}
                      <span className="text-xs text-gray-600">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    {renamingReelId === r.id && (
                      <div className="mt-1 text-xs text-[#0047AB]">
                        Saving title...
                      </div>
                    )}
                    {renameFeedback?.reelId === r.id && (
                      <div
                        className={`mt-1 text-xs ${
                          renameFeedback.kind === "success"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {renameFeedback.message}
                      </div>
                    )}
                    {editingReelId !== r.id && (
                      <div className="mt-1 text-[11px] text-gray-400">
                        Click title to rename
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                      <span>
                        Status:{" "}
                        <span className="font-medium">
                          {r.status.toUpperCase()}
                        </span>
                      </span>
                      {isCompleted && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              r.is_public
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {r.is_public ? (
                              <>
                                <Eye className="w-3 h-3" /> Public
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" /> Private
                              </>
                            )}
                          </span>
                          {r.is_public && r.show_on_explore && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                              <Globe className="w-3 h-3" /> Explore
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {r.status === "failed" && r.error && (
                      <div className="mt-1 text-xs text-red-700">{r.error}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isCompleted && (
                      <>
                        <Button
                          variant="outline"
                          className={`border-gray-300 ${
                            r.is_public
                              ? "text-green-600 hover:text-green-700"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                          disabled={isTogglingId === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePrivacy(r.id, r.is_public);
                          }}
                          aria-label={
                            r.is_public ? "Make private" : "Make public"
                          }
                          title={
                            r.is_public
                              ? "Public on profile. Click to make private."
                              : "Private — only you can see this. Click to make public."
                          }
                        >
                          {isTogglingId === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : r.is_public ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className={`border-gray-300 ${
                            r.show_on_explore
                              ? "text-blue-600 hover:text-blue-700"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                          disabled={isTogglingId === r.id || !r.is_public}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExplore(r.id, r.show_on_explore);
                          }}
                          aria-label={
                            r.show_on_explore
                              ? "Remove from Explore"
                              : "Show on Explore"
                          }
                          title={
                            !r.is_public
                              ? "Make the reel public first to show on Explore."
                              : r.show_on_explore
                                ? "Visible on Explore page. Click to remove."
                                : "Not on Explore. Click to feature on the Explore page."
                          }
                        >
                          <Globe className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="border-gray-300"
                      disabled={disableDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReel(r.id);
                      }}
                      aria-label="Delete reel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={confirmUnsavedOpen}
        onOpenChange={setConfirmUnsavedOpen}
        title="Generate reel without saving?"
        description={`Are you sure you want to generate the reel without saving your ${unsavedPointCount} unsaved point change${unsavedPointCount === 1 ? "" : "s"}? Generating now may use older saved values and produce the wrong reel. This warning also helps if you clicked generate by accident.`}
        confirmText="Save changes and generate"
        cancelText="Review changes"
        secondaryText="Generate reel without saving"
        onSecondaryAction={() => {
          void startNewReel();
        }}
        onConfirm={() => {
          void saveThenStartNewReel();
        }}
        variant="warning"
      />
    </div>
  );
}
