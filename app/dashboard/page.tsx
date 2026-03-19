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
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

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
  const prefersReducedMotion = useReducedMotion();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("user_id", user.id)
        .order("match_date", { ascending: false });

      if (error) throw error;

      setMatches(data || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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

      // Get current user for authorization check
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to delete matches");
      }

      // Delete match record from database (user_id check for defense-in-depth)
      const { error: dbError } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchToDelete.id)
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      // Update local state to remove the deleted match
      setMatches((prevMatches) =>
        prevMatches.filter((m) => m.id !== matchToDelete.id),
      );

      toast.success("Match deleted successfully.");

      // Redirect to upload page if no matches left
      if (matches.length === 1) {
        router.push("/upload-page");
      }
    } catch (error) {
      console.error("Error deleting match:", error);
      toast.error("Failed to delete match. Please try again.");
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
      <SiteHeader showNav={true} activePage="dashboard" />

      {/* Main Content */}
      <main className="page-shell flex-1 px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          {/* Search and Filter Section */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.3 }}
            className="glass-surface p-4 md:p-6 relative z-20"
          >
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
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
                    className="h-11 pl-10"
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
          </motion.div>

          {/* Skeleton Loading State */}
          {loading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md p-6 space-y-4">
                  <div className="skeleton h-5 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-4 w-2/3" />
                  <div className="flex gap-2 mt-4">
                    <div className="skeleton h-11 flex-1" />
                    <div className="skeleton h-11 w-12" />
                  </div>
                </div>
              ))}
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

          {/* User's Uploaded Matches */}
          {!loading && filteredMatches.length > 0 && (
            <>
              <div className="border-t border-[#9ec0ea] pt-8 mb-6">
                <h2 className="text-xl font-bold text-[#143f74]">
                  Your Uploaded Matches
                </h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMatches.map((match, idx) => (
                  <motion.div
                    key={match.id}
                    initial={
                      prefersReducedMotion ? false : { opacity: 0, y: 24 }
                    }
                    whileInView={
                      prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
                    }
                    viewport={{ once: true, amount: 0.15 }}
                    transition={
                      prefersReducedMotion
                        ? undefined
                        : { duration: 0.35, delay: Math.min(idx * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }
                    }
                    whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.02 }}
                  >
                    <Card className="p-6 border-[#c9dbf3] bg-white/74 flex flex-col">
                      <div className="flex-1 space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {match.team_name || "DkIT VC"} vs {match.opponent}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Date:{" "}
                          {new Date(match.match_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          Match video uploaded on{" "}
                          {new Date(match.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() =>
                            router.push(`/match/${match.id}/set/1`)
                          }
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
                  </motion.div>
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
