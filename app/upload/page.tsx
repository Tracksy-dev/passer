"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Upload, Loader2 } from "lucide-react";
import Link from "next/link";

export default function UploadVideoPage() {
  const router = useRouter();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [matchName, setMatchName] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [opponent, setOpponent] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setVideoFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // upload handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!videoFile) {
      setError("Please select or drag in a video file.");
      return;
    }

    try {
      setLoading(true);

      const fileExt = videoFile.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("match-videos")
        .upload(fileName, videoFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("match-videos")
        .getPublicUrl(fileName);

      const videoUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from("matches").insert({
        match_name: matchName,
        match_date: matchDate,
        opponent,
        video_url: videoUrl,
        video_path: fileName
      });

      if (dbError) throw dbError;

      router.push("/dashboard");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Upload failed.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 bg-[#E8F1FA] px-6 py-12 md:py-20 flex items-center justify-center">
        <div className="w-full max-w-xl space-y-8">
          <Card className="p-8 shadow-lg border-gray-200 bg-white">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Upload Match Video
            </h2>

            <form className="space-y-6" onSubmit={handleUpload}>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Match Name</Label>
                <Input
                  placeholder="Example: Quarterfinal Match"
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                  required
                  className="h-11 bg-gray-50 border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label>Match Date</Label>
                <Input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  required
                  className="h-11 bg-gray-50 border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label>Opponent Team</Label>
                <Input
                  placeholder="Example: Eagles Volleyball Club"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  required
                  className="h-11 bg-gray-50 border-gray-200"
                />
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-10 flex flex-col items-center text-center space-y-3"
              >
                <Upload className="w-8 h-8 text-gray-500" />
                <p className="text-gray-700">Drag & drop your match video</p>
                <p className="text-xs text-gray-500">MP4, MOV, or WEBM</p>

                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => document.getElementById("videoInput")?.click()}
                >
                  Select Video
                </Button>

                <input
                  id="videoInput"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {videoFile && (
                <p className="text-sm text-gray-700">
                  Selected file: <strong>{videoFile.name}</strong>
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Match"
                )}
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-gray-600">
            Need help?{" "}
            <Link href="/support" className="text-[#0047AB] underline">
              Contact support
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}