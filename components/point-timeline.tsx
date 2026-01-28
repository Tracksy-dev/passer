"use client";

import { useState } from "react";
import {
  type Point,
  type ActionType,
  actionTypeColors,
} from "@/lib/match-data";
import { Filter, Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PointTimelineProps {
  points: Point[];
  homeTeam: string;
  awayTeam: string;
  onPointClick?: (point: Point) => void;
  selectedPointId?: string | null;
  showEditControls?: boolean;
  onEditPoint?: (point: Point) => void;
  onDeletePoint?: (point: Point) => void;
}

export function PointTimeline({
  points,
  homeTeam,
  awayTeam,
  onPointClick,
  selectedPointId,
  showEditControls = false,
  onEditPoint,
  onDeletePoint,
}: PointTimelineProps) {
  const [filter, setFilter] = useState<ActionType | "all">("all");
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const filteredPoints =
    filter === "all" ? points : points.filter((p) => p.actionType === filter);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Point-by-Point Timeline
        </h3>
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as ActionType | "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Points</SelectItem>
              <SelectItem value="serve">Serve</SelectItem>
              <SelectItem value="spike">Spike</SelectItem>
              <SelectItem value="block">Block</SelectItem>
              <SelectItem value="dig">Dig</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-6">
        Click on any point to view the rally. Filled dots = {homeTeam}, Hollow
        dots = {awayTeam}
      </p>

      {/* Timeline Grid */}
      <div className="relative">
        {showEditControls && selectedPointId && (
          <div className="absolute -top-2 right-0 flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1 shadow-sm z-10">
            <button
              onClick={() => {
                const point = points.find((p) => p.id === selectedPointId);
                if (point && onEditPoint) onEditPoint(point);
              }}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <Pencil className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => {
                const point = points.find((p) => p.id === selectedPointId);
                if (point && onDeletePoint) onDeletePoint(point);
              }}
              className="p-1.5 hover:bg-gray-100 rounded"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {filteredPoints.map((point) => {
            const isHome = point.scoringTeam === "home";
            const isSelected = selectedPointId === point.id;
            const isHovered = hoveredPoint === point.id;
            const dotColor = isHome ? "#0047AB" : "#F5A623";
            const actionColor = actionTypeColors[point.actionType];

            return (
              <div
                key={point.id}
                className="relative flex flex-col items-center"
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10"
                    style={{ backgroundColor: actionColor }}
                  >
                    {point.actionType}
                  </div>
                )}

                {/* Point Dot */}
                <button
                  onClick={() => onPointClick?.(point)}
                  onMouseEnter={() => setHoveredPoint(point.id)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all cursor-pointer",
                    isHome
                      ? "bg-[#0047AB] border-[#0047AB]"
                      : "bg-white border-[#F5A623]",
                    isSelected && "ring-2 ring-offset-2 ring-teal-500",
                    "hover:scale-110",
                  )}
                  style={{
                    backgroundColor: isHome ? dotColor : "white",
                    borderColor: dotColor,
                  }}
                  aria-label={`Point ${point.homeScore}-${point.awayScore}, ${point.actionType}`}
                />

                {/* Score Label */}
                <span className="text-xs text-gray-600 mt-1">
                  {point.homeScore}-{point.awayScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
