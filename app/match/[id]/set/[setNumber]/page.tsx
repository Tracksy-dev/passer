"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, AlertCircle } from "lucide-react";

export default function SetAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const setNumber = Number.parseInt(params.setNumber as string);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isAddPointModalOpen, setIsAddPointModalOpen] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Get match and set data
  const [data, setData] = useState<ReturnType<typeof getSetData> | null>(null);

  useEffect(() => {
    // Simulate loading state
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        const matchData = getSetData(matchId, setNumber);

        if (!matchData) {
          setError("Match or set not found");
        } else {
          setData(matchData);
          setPoints(matchData.set.points);
        }
      } catch {
        setError("Failed to load match data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [matchId, setNumber]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Loading skeleton */}
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader showNav={true} activePage="dashboard" />
        <main className="flex-1 bg-gray-50 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {error || "Match Not Found"}
            </h1>
            <p className="text-gray-600 mb-6">
              {error
                ? "There was a problem loading the match data. Please check your connection and try again."
                : "The requested match or set could not be found."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
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
    try {
      const newPoint: Point = {
        id: `point-${Date.now()}`,
        ...newPointData,
      };
      setPoints([...points, newPoint]);
      setSuccessMessage("Point added successfully");
      setOperationError(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setOperationError("Failed to add point. Please try again.");
      setTimeout(() => setOperationError(null), 5000);
    }
  };

  const handleEditPoint = (point: Point) => {
    try {
      // TODO: Open edit modal with point data
      console.log("Edit point:", point);
      setSuccessMessage("Point updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setOperationError("Failed to update point. Please try again.");
      setTimeout(() => setOperationError(null), 5000);
    }
  };

  const handleDeletePoint = (point: Point) => {
    try {
      setPoints(points.filter((p) => p.id !== point.id));
      if (selectedPointId === point.id) {
        setSelectedPointId(null);
      }
      setSuccessMessage("Point deleted successfully");
      setOperationError(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setOperationError("Failed to delete point. Please try again.");
      setTimeout(() => setOperationError(null), 5000);
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
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          )}

          {/* Error Message */}
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
