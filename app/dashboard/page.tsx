"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Search, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";

interface Match {
  id: string;
  opponent: string;
  team_name: string;
  match_date: string;
  video_url: string;
  video_path: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setIsAuthenticated(true);
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setIsAuthenticated(false);
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchMatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: false });

      if (error) throw error;

      setMatches(data || []);

      // Redirect to upload page if no matches (demo cards are for demonstration only)
      if (!data || data.length === 0) {
        router.push("/upload-page");
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleDeleteMatch = (match: Match) => {
    setMatchToDelete(match);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteMatch = async () => {
    if (!matchToDelete) return;

    setDeletingMatchId(matchToDelete.id);

    try {
      // Delete video file from storage
      const { error: storageError } = await supabase.storage
        .from("match-videos")
        .remove([matchToDelete.video_path]);

      if (storageError) {
        console.error("Error deleting video file:", storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete match record from database
      const { error: dbError } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchToDelete.id);

      if (dbError) throw dbError;

      // Update local state to remove the deleted match
      setMatches((prevMatches) =>
        prevMatches.filter((m) => m.id !== matchToDelete.id),
      );

      // Redirect to upload page if no matches left
      if (matches.length === 1) {
        router.push("/upload-page");
      }
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Failed to delete match. Please try again.");
    } finally {
      setDeletingMatchId(null);
      setMatchToDelete(null);
    }
  };

  // Filter matches based on search and date
  const filteredMatches = matches.filter((match) => {
    const matchesSearch = searchQuery
      ? match.opponent.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesDate = dateFilter ? match.match_date === dateFilter : true;
    return matchesSearch && matchesDate;
  });

  // Don't render anything until authentication is verified
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Search and Filter Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Search matches
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by opponent or match details..."
                    className="h-11 pl-10 bg-gray-50 border-gray-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Filter by date
                </label>
                <DatePicker
                  value={dateFilter}
                  onChange={setDateFilter}
                  placeholder="Pick a date"
                  showIcon
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading matches...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredMatches.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {searchQuery || dateFilter
                  ? "No matches found with the current filters."
                  : "No matches yet. Upload your first match video!"}
              </p>
            </div>
          )}

          {/* Demo Match Card (Mock Data) */}
          {!loading && (
            <>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                        DEMO
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        Sample match with full analysis and point-by-point
                        breakdown
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Demo Match Cards */}
                <Card className="p-6 shadow-sm border-blue-200 border-2 flex flex-col bg-gradient-to-br from-white to-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                      DEMO
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      DkIT VC vs St. Mary&apos;s College
                    </h3>
                    <p className="text-sm text-gray-600">
                      Date: November 1, 2023
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      3-0 Victory • 95% Analysis Confidence
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => router.push("/match/1/set/1")}
                      className="flex-1 h-11 bg-[#0047AB] hover:bg-[#003580] text-white font-medium"
                    >
                      View Report
                    </Button>
                  </div>
                </Card>

                <Card className="p-6 shadow-sm border-blue-200 border-2 flex flex-col bg-gradient-to-br from-white to-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                      DEMO
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      DkIT VC vs Trinity College Dublin
                    </h3>
                    <p className="text-sm text-gray-600">
                      Date: November 2, 2023
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      3-2 Victory • 91% Analysis Confidence
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => router.push("/match/2/set/1")}
                      className="flex-1 h-11 bg-[#0047AB] hover:bg-[#003580] text-white font-medium"
                    >
                      View Report
                    </Button>
                  </div>
                </Card>

                <Card className="p-6 shadow-sm border-blue-200 border-2 flex flex-col bg-gradient-to-br from-white to-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                      DEMO
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      DkIT VC vs UCD
                    </h3>
                    <p className="text-sm text-gray-600">
                      Date: November 3, 2023
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      3-0 Victory • 97% Analysis Confidence
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => router.push("/match/3/set/1")}
                      className="flex-1 h-11 bg-[#0047AB] hover:bg-[#003580] text-white font-medium"
                    >
                      View Report
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* User's Uploaded Matches */}
          {!loading && filteredMatches.length > 0 && (
            <>
              <div className="border-t border-gray-300 pt-8 mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Your Uploaded Matches
                </h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMatches.map((match) => (
                  <Card
                    key={match.id}
                    className="p-6 shadow-sm border-gray-200 flex flex-col"
                  >
                    <div className="flex-1 space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {match.team_name || "DkIT VC"} vs {match.opponent}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Date: {new Date(match.match_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Match video uploaded on{" "}
                        {new Date(match.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => router.push(`/match/${match.id}/set/1`)}
                        className="flex-1 h-11 bg-[#0047AB] hover:bg-[#003580] text-white font-medium"
                      >
                        View Report
                      </Button>
                      <Button
                        onClick={() => handleDeleteMatch(match)}
                        disabled={deletingMatchId === match.id}
                        variant="outline"
                        className="h-11 px-3 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-50"
                      >
                        {deletingMatchId === match.id ? (
                          <span className="text-xs">Deleting...</span>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Match"
        description={
          matchToDelete
            ? `Are you sure you want to delete "${
                matchToDelete.team_name || "DkIT VC"
              } vs ${
                matchToDelete.opponent
              }"? This will permanently delete the match video and all associated data. This action cannot be undone.`
            : ""
        }
        confirmText="Delete Match"
        cancelText="Cancel"
        onConfirm={confirmDeleteMatch}
        variant="danger"
      />
    </div>
  );
}
