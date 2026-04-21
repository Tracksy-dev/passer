"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

export type VideoPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
};

export type VideoTimelineMarker = {
  id: string;
  timestamp: number;
  clipStart: number;
  clipEnd: number;
  label: string;
  color: string;
  startPercent: number;
  endPercent: number;
  pointPercent: number;
};

export type VideoTimelineMarkerAdjust = {
  clipStart?: number;
  clipEnd?: number;
};

interface VideoPlayerProps {
  title?: string;
  src?: string | null;
  onTimeUpdate?: (currentTime: number) => void;
  markers?: VideoTimelineMarker[];
  activeMarkerId?: string | null;
  currentTime?: number;
  onMarkerClick?: (markerId: string) => void;
  onDurationChange?: (duration: number) => void;
  onMarkerAdjust?: (
    markerId: string,
    updates: VideoTimelineMarkerAdjust,
  ) => void;
  onMarkPoint?: () => void;
  markDisabled?: boolean;
  isMarking?: boolean;
}

const MIN_CLIP_SECONDS = 0.2;

function clampPercent(v: number) {
  return Math.max(0, Math.min(100, v));
}

function roundToTenth(v: number) {
  return Math.round(v * 10) / 10;
}

function formatTimelineTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      title = "Match Replay",
      src,
      onTimeUpdate,
      markers = [],
      activeMarkerId = null,
      currentTime = 0,
      onMarkerClick,
      onDurationChange,
      onMarkerAdjust,
      onMarkPoint,
      markDisabled = false,
      isMarking = false,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const timelineTrackRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{
      markerId: string;
      edge: "start" | "end" | "body";
      grabOffset?: number;
      startX?: number;
      hasMoved?: boolean;
    } | null>(null);
    const suppressNextClickRef = useRef(false);

    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const normalizedMarkers = useMemo(
      () =>
        markers.map((m) => ({
          ...m,
          startPercent: clampPercent(m.startPercent),
          endPercent: clampPercent(m.endPercent),
          pointPercent: clampPercent(m.pointPercent),
        })),
      [markers],
    );

    const playheadPercent =
      duration > 0 ? clampPercent((currentTime / duration) * 100) : 0;

    useEffect(() => {
      // Reset duration when source changes so marker percentages can be recomputed from 0 -> real value.
      setDuration(0);
      onDurationChange?.(0);
      setIsPlaying(false);
    }, [src, onDurationChange]);

    useEffect(() => {
      const onFullscreenChange = () => {
        setIsFullscreen(document.fullscreenElement === containerRef.current);
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
      return () =>
        document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const syncDuration = (next: number) => {
      if (!Number.isFinite(next) || next <= 0) return;
      setDuration(next);
      onDurationChange?.(next);
    };

    const syncPlaybackState = () => {
      const el = videoRef.current;
      if (!el) return;
      setIsPlaying(!el.paused && !el.ended);
      setIsMuted(el.muted);
      setVolume(el.volume);
      setPlaybackRate(el.playbackRate);
    };

    useEffect(() => {
      const onPointerMove = (e: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag || duration <= 0) return;

        const marker = markers.find((m) => m.id === drag.markerId);
        const track = timelineTrackRef.current;
        if (!marker || !track) return;

        const rect = track.getBoundingClientRect();
        if (rect.width <= 0) return;

        if (drag.startX !== undefined && Math.abs(e.clientX - drag.startX) > 4) {
          drag.hasMoved = true;
        }

        const pct = clampPercent(((e.clientX - rect.left) / rect.width) * 100);
        const time = (pct / 100) * duration;

        if (drag.edge === "start") {
          const nextStart = roundToTenth(
            Math.max(0, Math.min(time, marker.clipEnd - MIN_CLIP_SECONDS)),
          );
          onMarkerAdjust?.(marker.id, { clipStart: nextStart });
        } else if (drag.edge === "end") {
          const nextEnd = roundToTenth(
            Math.min(duration, Math.max(time, marker.clipStart + MIN_CLIP_SECONDS)),
          );
          onMarkerAdjust?.(marker.id, { clipEnd: nextEnd });
        } else {
          const clipLen = marker.clipEnd - marker.clipStart;
          const nextStart = roundToTenth(
            Math.max(0, Math.min(time - (drag.grabOffset ?? 0), duration - clipLen)),
          );
          const nextEnd = roundToTenth(nextStart + clipLen);
          onMarkerAdjust?.(marker.id, { clipStart: nextStart, clipEnd: nextEnd });
        }

        e.preventDefault();
      };

      const stopDrag = () => {
        if (dragStateRef.current?.hasMoved) {
          suppressNextClickRef.current = true;
        }
        dragStateRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
      window.addEventListener("pointercancel", stopDrag);

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopDrag);
        window.removeEventListener("pointercancel", stopDrag);
      };
    }, [duration, markers, onMarkerAdjust]);

    const beginEdgeDrag = (
      e: React.PointerEvent<HTMLButtonElement>,
      markerId: string,
      edge: "start" | "end",
    ) => {
      if (duration <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragStateRef.current = { markerId, edge };
    };

    const beginBodyDrag = (
      e: React.PointerEvent<HTMLButtonElement>,
      markerId: string,
    ) => {
      if (duration <= 0) return;
      const marker = markers.find((m) => m.id === markerId);
      if (!marker || !timelineTrackRef.current) return;
      e.preventDefault();
      const rect = timelineTrackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = clampPercent(((e.clientX - rect.left) / rect.width) * 100);
      const time = (pct / 100) * duration;
      dragStateRef.current = {
        markerId,
        edge: "body",
        grabOffset: time - marker.clipStart,
        startX: e.clientX,
        hasMoved: false,
      };
    };

    const togglePlay = async () => {
      const el = videoRef.current;
      if (!el) return;
      try {
        if (el.paused || el.ended) {
          await el.play();
        } else {
          el.pause();
        }
      } catch {
        // ignore
      }
      syncPlaybackState();
    };

    const seekBy = (deltaSeconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      const next = Math.max(
        0,
        Math.min(duration || Number.MAX_SAFE_INTEGER, el.currentTime + deltaSeconds),
      );
      el.currentTime = next;
      onTimeUpdate?.(next);
    };

    const handleSeekChange = (pct: number) => {
      const el = videoRef.current;
      if (!el || duration <= 0) return;
      const safePct = clampPercent(pct);
      const next = (safePct / 100) * duration;
      el.currentTime = next;
      onTimeUpdate?.(next);
    };

    const handleMuteToggle = () => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = !el.muted;
      syncPlaybackState();
    };

    const handleVolumeChange = (nextVolume: number) => {
      const el = videoRef.current;
      if (!el) return;
      const safe = Math.max(0, Math.min(1, nextVolume));
      el.volume = safe;
      el.muted = safe === 0;
      syncPlaybackState();
    };

    const handlePlaybackRateChange = (nextRate: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.playbackRate = nextRate;
      syncPlaybackState();
    };

    const toggleFullscreen = async () => {
      const container = containerRef.current;
      if (!container) return;
      try {
        if (document.fullscreenElement === container) {
          await document.exitFullscreen();
        } else {
          await container.requestFullscreen();
        }
      } catch {
        // ignore
      }
    };

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

        <div ref={containerRef} className="relative aspect-video bg-black">
          {src ? (
            <>
              <video
                ref={videoRef}
                src={src}
                controls={false}
                className="w-full h-full"
                preload="metadata"
                onLoadedMetadata={(e) => {
                  syncDuration((e.currentTarget as HTMLVideoElement).duration);
                  syncPlaybackState();
                }}
                onDurationChange={(e) => {
                  syncDuration((e.currentTarget as HTMLVideoElement).duration);
                  syncPlaybackState();
                }}
                onPlay={syncPlaybackState}
                onPause={syncPlaybackState}
                onVolumeChange={syncPlaybackState}
                onRateChange={syncPlaybackState}
                onTimeUpdate={
                  onTimeUpdate
                    ? (e) =>
                        onTimeUpdate(
                          (e.currentTarget as HTMLVideoElement).currentTime,
                        )
                    : undefined
                }
              />

              {/* Custom controls + timeline overlay (works in fullscreen because it is inside the same container) */}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20">
                <div className="pointer-events-auto rounded-md border border-white/20 bg-black/65 text-white backdrop-blur-sm px-3 py-2 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          void togglePlay();
                        }}
                        className="h-7 w-7 rounded bg-white/15 hover:bg-white/25 flex items-center justify-center"
                        aria-label={isPlaying ? "Pause" : "Play"}
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => seekBy(-5)}
                        className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        aria-label="Back 5 seconds"
                        title="Back 5 seconds"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => seekBy(5)}
                        className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        aria-label="Forward 5 seconds"
                        title="Forward 5 seconds"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-[11px] text-white/90 min-w-[84px] text-center tabular-nums shrink-0">
                      {formatTimelineTime(currentTime)} / {formatTimelineTime(duration)}
                    </span>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={duration > 0 ? (currentTime / duration) * 100 : 0}
                      onChange={(e) => handleSeekChange(Number(e.currentTarget.value))}
                      className="min-w-[180px] flex-1 basis-[220px] accent-blue-400"
                      aria-label="Seek"
                    />

                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleMuteToggle}
                        className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        aria-label={isMuted ? "Unmute" : "Mute"}
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(volume * 100)}
                        onChange={(e) =>
                          handleVolumeChange(Number(e.currentTarget.value) / 100)
                        }
                        className="w-16 accent-blue-400"
                        aria-label="Volume"
                      />

                      <select
                        value={playbackRate}
                        onChange={(e) =>
                          handlePlaybackRateChange(Number(e.currentTarget.value))
                        }
                        className="h-7 w-[62px] rounded bg-white/10 border border-white/20 text-xs px-1"
                        aria-label="Playback speed"
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <option key={rate} value={rate} className="text-black">
                            {rate}x
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          void toggleFullscreen();
                        }}
                        className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onMarkPoint?.()}
                        disabled={markDisabled}
                        className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-medium"
                        aria-label="Mark highlight point"
                      >
                        {isMarking ? "Marking..." : "Mark"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-white/70">
                      Clip Timeline
                    </span>
                    <span className="text-[10px] text-white/50">
                      {normalizedMarkers.length} clip
                      {normalizedMarkers.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div ref={timelineTrackRef} className="relative h-10">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-white/10 ring-1 ring-inset ring-white/10 backdrop-blur-sm" />

                    {normalizedMarkers.map((marker) => {
                      const isActive = marker.id === activeMarkerId;
                      const baseWidth = marker.endPercent - marker.startPercent;
                      const widthPercent = Math.max(baseWidth, 0.8);
                      const anchorVisible =
                        marker.pointPercent >= marker.startPercent &&
                        marker.pointPercent <= marker.endPercent;
                      const pointWithin =
                        widthPercent > 0 && anchorVisible
                          ? clampPercent(
                              ((marker.pointPercent - marker.startPercent) /
                                widthPercent) *
                                100,
                            )
                          : 50;

                      return (
                        <div
                          key={marker.id}
                          className="absolute top-1/2 -translate-y-1/2 h-8"
                          style={{
                            left: `${marker.startPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                        >
                          <button
                            type="button"
                            onPointerDown={(e) => beginBodyDrag(e, marker.id)}
                            onClick={() => {
                              if (suppressNextClickRef.current) {
                                suppressNextClickRef.current = false;
                                return;
                              }
                              onMarkerClick?.(marker.id);
                            }}
                            aria-label={`Jump to ${marker.label} clip from ${formatTimelineTime(marker.clipStart)} to ${formatTimelineTime(marker.clipEnd)}`}
                            className={`group/clip absolute inset-0 rounded-full border border-white/40 shadow-[0_6px_18px_-8px_rgba(0,37,92,0.6)] cursor-grab active:cursor-grabbing focus:outline-none transition-shadow ${
                              isActive
                                ? "ring-2 ring-[#1B7CFF] ring-offset-1 ring-offset-transparent"
                                : ""
                            }`}
                            style={{
                              background: `linear-gradient(120deg, ${marker.color}cc, ${marker.color})`,
                            }}
                          >
                            {anchorVisible && (
                              <span
                                className="group/dot absolute top-1/2 h-2 w-2 rounded-full bg-white border-2 border-[#1B7CFF] shadow z-10"
                                style={{
                                  left: `${pointWithin}%`,
                                  transform: "translate(-50%, -50%)",
                                }}
                              >
                                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 hidden whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[9px] text-white shadow group-hover/dot:block">
                                  Match point
                                </span>
                              </span>
                            )}

                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-white shadow group-hover/clip:block group-focus-visible/clip:block">
                              {marker.label} {formatTimelineTime(marker.clipStart)}
                              {" - "}
                              {formatTimelineTime(marker.clipEnd)}
                            </span>
                          </button>

                          <button
                            type="button"
                            onPointerDown={(e) =>
                              beginEdgeDrag(e, marker.id, "start")
                            }
                            aria-label={`Adjust start of ${marker.label} clip`}
                            className="absolute -left-1 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-white/90 shadow ring-1 ring-black/10 cursor-ew-resize hover:shadow-[0_0_6px_rgba(27,124,255,0.6)] z-20"
                          />

                          <button
                            type="button"
                            onPointerDown={(e) => beginEdgeDrag(e, marker.id, "end")}
                            aria-label={`Adjust end of ${marker.label} clip`}
                            className="absolute -right-1 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-white/90 shadow ring-1 ring-black/10 cursor-ew-resize hover:shadow-[0_0_6px_rgba(27,124,255,0.6)] z-20"
                          />
                        </div>
                      );
                    })}

                    <div
                      className="pointer-events-none absolute top-0 bottom-0 z-30 flex flex-col items-center"
                      style={{ left: `${playheadPercent}%` }}
                      aria-hidden="true"
                    >
                      <div className="w-1.5 h-1.5 -mt-0.5 rounded-full bg-[#1B7CFF] shadow-[0_0_4px_rgba(27,124,255,0.8)]" />
                      <div className="w-0.5 flex-1 bg-[#1B7CFF] shadow-[0_0_8px_rgba(27,124,255,0.8)]" />
                    </div>
                  </div>
                </div>
              </div>
            </>
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