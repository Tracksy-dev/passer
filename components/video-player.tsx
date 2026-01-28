"use client";

import { Play } from "lucide-react";

interface VideoPlayerProps {
  title?: string;
}

export function VideoPlayer({ title = "Match Replay" }: VideoPlayerProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
      )}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        {/* Play Button Overlay */}
        <button
          className="w-16 h-16 border-2 border-white rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Play video"
        >
          <Play className="w-8 h-8 text-white ml-1" fill="transparent" />
        </button>
      </div>
    </div>
  );
}
