"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionType } from "@/lib/match-data";

interface AddPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPoint: (data: {
    scoringTeam: "home" | "away";
    homeScore: number;
    awayScore: number;
    actionType: ActionType;
    timestamp: number;
  }) => void;
  homeTeam: string;
  awayTeam: string;
}

export function AddPointModal({
  isOpen,
  onClose,
  onAddPoint,
  homeTeam,
  awayTeam,
}: AddPointModalProps) {
  const [scoringTeam, setScoringTeam] = useState<"home" | "away">("home");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [actionType, setActionType] = useState<ActionType>("serve");
  const [timestamp, setTimestamp] = useState(30);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onAddPoint({
      scoringTeam,
      homeScore,
      awayScore,
      actionType,
      timestamp,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Point</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Team Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Which team scored this point?
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScoringTeam("home")}
                className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  scoringTeam === "home"
                    ? "border-gray-900 bg-white text-gray-900"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                }`}
              >
                {homeTeam}
              </button>
              <button
                onClick={() => setScoringTeam("away")}
                className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  scoringTeam === "away"
                    ? "border-[#F5A623] bg-[#FEF3CD] text-[#B8860B]"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                }`}
              >
                Opponent
              </button>
            </div>
          </div>

          {/* Score Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="homeScore"
                className="text-sm font-medium text-gray-700"
              >
                {homeTeam} Score
              </Label>
              <Input
                id="homeScore"
                type="number"
                min="0"
                value={homeScore}
                onChange={(e) =>
                  setHomeScore(Number.parseInt(e.target.value) || 0)
                }
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="awayScore"
                className="text-sm font-medium text-gray-700"
              >
                Opponent Score
              </Label>
              <Input
                id="awayScore"
                type="number"
                min="0"
                value={awayScore}
                onChange={(e) =>
                  setAwayScore(Number.parseInt(e.target.value) || 0)
                }
                className="h-11"
              />
            </div>
          </div>

          {/* Action Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Action Type
            </Label>
            <Select
              value={actionType}
              onValueChange={(v) => setActionType(v as ActionType)}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serve">Serve</SelectItem>
                <SelectItem value="spike">Spike</SelectItem>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="dig">Dig</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timestamp */}
          <div className="space-y-2">
            <Label
              htmlFor="timestamp"
              className="text-sm font-medium text-gray-700"
            >
              Video Timestamp (seconds)
            </Label>
            <Input
              id="timestamp"
              type="number"
              min="0"
              value={timestamp}
              onChange={(e) =>
                setTimestamp(Number.parseInt(e.target.value) || 0)
              }
              className="h-11"
            />
            <p className="text-xs text-gray-500">
              Enter the time in the video when this point was scored
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 h-11 bg-[#0047AB] hover:bg-[#003580] text-white"
          >
            Add Point
          </Button>
        </div>
      </div>
    </div>
  );
}
