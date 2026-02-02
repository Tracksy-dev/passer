"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";

export type VideoPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
};

interface VideoPlayerProps {
  title?: string;
  src?: string | null;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ title = "Match Replay", src }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const el = videoRef.current;
        if (!el) return;

        // clamp to >= 0; if metadata not loaded, duration may be NaN
        const t = Math.max(0, seconds);
        el.currentTime = t;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
    }));

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {title && (
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-900">{title}</span>
          </div>
        )}

        <div className="relative aspect-video bg-black">
          {src ? (
            <video
              ref={videoRef}
              src={src}
              controls
              className="w-full h-full"
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-200">
              No video loaded
            </div>
          )}
        </div>
      </div>
    );
  }
);
