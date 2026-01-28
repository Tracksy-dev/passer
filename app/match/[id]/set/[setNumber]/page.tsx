"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { PointTimeline } from "@/components/point-timeline";
import { SetStatistics } from "@/components/set-statistics";
import { ActionLegend } from "@/components/action-legend";
import { AddPointModal } from "@/components/add-point-modal";
import { getSetData, type Point, type ActionType } from "@/lib/match-data";
import { ArrowLeft, Plus } from "lucide-react";

export default function SetAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const setNumber = Number.parseInt(params.setNumber as string);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isAddPointModalOpen, setIsAddPointModalOpen] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);

  // Get match and set data
  const data = getSetData(matchId, setNumber);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Match Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              The requested match or set could not be found.
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { match, set } = data;

  // Initialize points from set data
  if (points.length === 0 && set.points.length > 0) {
    setPoints(set.points);
  }

  const handlePointClick = (point: Point) => {
    setSelectedPointId(point.id);
    // TODO: Seek video to timestamp
  };

  const handleAddPoint = (newPointData: {
    scoringTeam: "home" | "away";
    homeScore: number;
    awayScore: number;
    actionType: ActionType;
    timestamp: number;
  }) => {
    const newPoint: Point = {
      id: `point-${Date.now()}`,
      ...newPointData,
    };
    setPoints([...points, newPoint]);
  };

  const handleEditPoint = (point: Point) => {
    // TODO: Open edit modal with point data
    console.log("Edit point:", point);
  };

  const handleDeletePoint = (point: Point) => {
    setPoints(points.filter((p) => p.id !== point.id));
    if (selectedPointId === point.id) {
      setSelectedPointId(null);
    }
  };

  const handleSetNavigation = (direction: "prev" | "next") => {
    const newSetNumber = direction === "prev" ? setNumber - 1 : setNumber + 1;
    if (newSetNumber >= 1 && newSetNumber <= match.sets.length) {
      router.push(`/match/${matchId}/set/${newSetNumber}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} activePage="dashboard" />

      <main className="flex-1 bg-gray-50 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
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
                  {new Date(match.date).toLocaleDateString()} • Set {setNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Set Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSetNavigation("prev")}
                  disabled={setNumber === 1}
                  size="sm"
                >
                  ← Set {setNumber - 1}
                </Button>
                <span className="text-sm font-medium text-gray-700 px-3">
                  Set {setNumber} of {match.sets.length}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handleSetNavigation("next")}
                  disabled={setNumber === match.sets.length}
                  size="sm"
                >
                  Set {setNumber + 1} →
                </Button>
              </div>

              <Button
                onClick={() => setIsAddPointModalOpen(true)}
                className="bg-[#0047AB] hover:bg-[#003580] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Point
              </Button>
            </div>
          </div>

          {/* Score */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-center gap-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#0047AB]">
                  {set.homeScore}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {match.homeTeam}
                </div>
              </div>
              <div className="text-2xl text-gray-400">-</div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[#F5A623]">
                  {set.awayScore}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {match.awayTeam}
                </div>
              </div>
            </div>
          </div>

          {/* Video Player and Stats Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <VideoPlayer
                title={`Set ${setNumber} - ${match.homeTeam} vs ${match.awayTeam}`}
              />
            </div>
            <div className="space-y-6">
              <SetStatistics
                totalRallies={set.rallies}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                homePoints={set.homeScore}
                awayPoints={set.awayScore}
                analysisConfidence={match.analysisConfidence}
              />
              <ActionLegend />
            </div>
          </div>

          {/* Point Timeline */}
          <PointTimeline
            points={points.length > 0 ? points : set.points}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            onPointClick={handlePointClick}
            selectedPointId={selectedPointId}
            showEditControls={true}
            onEditPoint={handleEditPoint}
            onDeletePoint={handleDeletePoint}
          />
        </div>
      </main>

      <SiteFooter />

      {/* Add Point Modal */}
      <AddPointModal
        isOpen={isAddPointModalOpen}
        onClose={() => setIsAddPointModalOpen(false)}
        onAddPoint={handleAddPoint}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
      />
    </div>
  );
}
