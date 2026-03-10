"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Calendar, Film, Play, X } from "lucide-react";

type PublicReel = {
  id: string;
  title: string | null;
  output_url: string | null;
  created_at: string;
  match_id: string | null;
};

type MatchInfo = { team_name: string; opponent: string };

function formatMatch(info: MatchInfo) {
  return info.team_name && info.opponent
    ? `${info.team_name} vs ${info.opponent}`
    : info.opponent || info.team_name;
}

export function PublicReelsGrid({
  reels,
  matchInfoMap,
}: {
  reels: PublicReel[];
  matchInfoMap: Record<string, MatchInfo>;
}) {
  const [selectedReel, setSelectedReel] = useState<PublicReel | null>(null);

  if (reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4">
          <Film className="w-10 h-10 text-gray-300" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">
          No public reels yet
        </h3>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {reels.map((reel) => {
          const matchInfo = reel.match_id ? matchInfoMap[reel.match_id] : null;
          return (
            <div
              key={reel.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedReel(reel)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
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
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-5 h-5 text-gray-900 fill-gray-900 ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="px-3 py-2.5">
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {reel.title || "Highlight Reel"}
                </h4>
                {matchInfo && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    🏐 {formatMatch(matchInfo)}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(reel.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              {selectedReel?.match_id &&
                matchInfoMap[selectedReel.match_id] && (
                  <p className="text-gray-400 text-xs mt-0.5">
                    🏐 {formatMatch(matchInfoMap[selectedReel.match_id])}
                  </p>
                )}
              {selectedReel?.created_at && (
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(selectedReel.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
