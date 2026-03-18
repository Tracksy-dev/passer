"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_FORMATS = [".mp4", ".mov", ".avi"];
const ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

export default function UploadPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [teamName, setTeamName] = useState("DkIT VC");
  const [uploadAbortController, setUploadAbortController] =
    useState<AbortController | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        console.error("Supabase session error:", error);
        return;
      }
    };

    checkUser();
  }, []);

  const validateFile = (file: File): string | null => {
    // Check file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidFormat =
      ALLOWED_FORMATS.includes(fileExtension || "") ||
      ALLOWED_MIME_TYPES.includes(file.type);

    if (!isValidFormat) {
      return `Invalid file format. Please upload a video file (${ALLOWED_FORMATS.join(
        ", ",
      )})`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size too large. Maximum size is ${
        MAX_FILE_SIZE / (1024 * 1024)
      }MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
    }

    return null;
  };

  const handleFileValidation = (file: File): boolean => {
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setUploadStatus("error");
      return false;
    }
    setErrorMessage("");
    setUploadStatus("idle");
    return true;
  };

  const SIGNED_UPLOAD_MAX = 500 * 1024 * 1024; // 50MB (safe cutoff)

  const uploadFileWithProgress = async (
    fileName: string,
    file: File,
    abortController: AbortController,
  ): Promise<void> => {
    // If file is large, skip signed-upload route (it’s the one failing)
    if (file.size > SIGNED_UPLOAD_MAX) {
      const { error } = await supabase.storage
        .from("match-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) throw error;
      setUploadProgress(100);
      return;
    }

    // Otherwise try signed upload (keep your progress)
    const { data: uploadData, error: urlError } = await supabase.storage
      .from("match-videos")
      .createSignedUploadUrl(fileName, {
        upsert: false,
      });

    if (urlError || !uploadData) {
      // fallback
      const { error } = await supabase.storage
        .from("match-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (error) throw error;
      setUploadProgress(100);
      return;
    }

    // XHR for progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      abortController.signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload cancelled by user"));
      });

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 201) return resolve();
        // log real error body
        console.error("Signed upload failed:", xhr.status, xhr.responseText);
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("abort", () =>
        reject(new Error("Upload cancelled")),
      );

      xhr.open("PUT", uploadData.signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });

    setUploadProgress(100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedFile) {
      setErrorMessage("Please select a video file to upload");
      setUploadStatus("error");
      return;
    }

    if (!matchDate || !opponent || !teamName) {
      setErrorMessage("Please fill in all required fields");
      setUploadStatus("error");
      return;
    }

    const abortController = new AbortController();
    setUploadAbortController(abortController);

    try {
      setIsUploading(true);
      setUploadStatus("idle");
      setUploadProgress(0);

      // ✅ Get current user FIRST (needed for file path + DB insert)
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("You must be logged in to upload videos");

      // ✅ Unique filename under user folder
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      // ✅ Upload to Supabase Storage with progress tracking
      await uploadFileWithProgress(fileName, selectedFile, abortController);

      // ✅ Insert match record into database (store video_path only)
      const { data: inserted, error: dbError } = await supabase
        .from("matches")
        .insert({
          user_id: user.id,
          match_date: matchDate,
          opponent,
          team_name: teamName,
          video_path: fileName,
          // video_url: optional; recommended to omit if using signed URLs
        })
        .select("id")
        .single();

      if (dbError) throw dbError;
      if (!inserted?.id) throw new Error("Match created but no id returned.");

      // ✅ Success - redirect to editor page to add highlight points
      setUploadStatus("success");
      setTimeout(() => {
        router.push(`/match/${inserted.id}/set/1`);
      }, 500);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Upload failed.";
      setErrorMessage(errMsg);
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
      setUploadAbortController(null);
    }
  };

  const handleCancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort();
      setUploadAbortController(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage("");
    // Reset file input
    const fileInput = document.getElementById(
      "file-upload",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleRetry = () => {
    setUploadStatus("idle");
    setErrorMessage("");
    setUploadProgress(0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && handleFileValidation(file)) {
      setSelectedFile(file);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && handleFileValidation(file)) {
      setSelectedFile(file);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} activePage="upload" />

      <main className="page-shell flex-1 px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          {/* Status Messages */}
          {uploadStatus === "success" && (
            <div className="bg-green-50/90 border border-green-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">
                Video uploaded successfully! Your match analysis will be ready
                shortly.
              </p>
            </div>
          )}

          {uploadStatus === "error" && errorMessage && (
            <div className="bg-red-50/90 border border-red-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Upload failed</p>
                  <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
                </div>
              </div>
              <Button
                onClick={handleRetry}
                className="mt-3 bg-red-600 hover:bg-red-700 text-white h-9 px-4"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Upload Area */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.32 }}
            className={`rounded-3xl border-2 border-dashed p-8 md:p-12 lg:p-16 transition-colors shadow-[0_24px_44px_-34px_rgba(0,71,171,0.95)] backdrop-blur-lg ${
              isDragging
                ? "border-[#0047AB] bg-[#dfeeff]/90"
                : "border-[#99bbe4] bg-white/72"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              {/* Upload Icon */}
              <div className="w-20 h-20 flex items-center justify-center">
                <svg
                  className="w-full h-full text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              {/* Upload Text */}
              <div className="space-y-2">
                <p className="text-lg text-gray-700">
                  {selectedFile
                    ? selectedFile.name
                    : "Drag & Drop your video files here"}
                </p>
                {selectedFile && (
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
                {!selectedFile && <p className="text-gray-500">or</p>}
              </div>

              {/* Upload Button */}
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".mp4,.mov,.avi"
                onChange={handleFileSelect}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                  className="px-8 h-11"
                  disabled={isUploading}
                >
                  {selectedFile ? "Change Video" : "Click to upload"}
                </Button>
                {selectedFile && !isUploading && (
                  <Button
                    onClick={handleClearFile}
                    variant="outline"
                    className="border-[#94b6de] text-[#18467f] hover:bg-[#e8f2ff] px-6 h-11"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Supported Formats */}
              <p className="text-sm text-gray-600 mt-2">
                Supported formats: .mp4, .mov, .avi (Max: 500MB)
              </p>
            </div>
          </motion.div>

          {/* Progress Bar - Shows during file upload */}
          {isUploading && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { duration: 0.24 }}
              className="glass-surface p-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Uploading video...
                  </span>
                  <span className="text-sm font-medium text-[#0047AB]">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <motion.div
                    className="bg-[linear-gradient(120deg,#0047AB,#1B7CFF,#E8A550)] h-3 rounded-full transition-all duration-300"
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={
                      prefersReducedMotion
                        ? undefined
                        : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    Please wait while we upload your video file...
                  </p>
                  <Button
                    onClick={handleCancelUpload}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-3 text-xs"
                  >
                    Cancel Upload
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Match Details Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/70 bg-white/90 shadow-[0_20px_50px_-35px_rgba(0,32,92,0.7)] p-5 md:p-8 hover-border-glow"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={
              prefersReducedMotion ? undefined : { duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {/* Team Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Your Team Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g., DkIT VC"
                  className="h-11 bg-gray-50 border-gray-200"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>

              {/* Opponent */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Opponent Team
                </label>
                <Input
                  type="text"
                  placeholder="e.g., St. Mary's College"
                  className="h-11 bg-gray-50 border-gray-200"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  required
                />
              </div>

              {/* Match Date */}
              <div className="space-y-2 md:col-span-2 relative z-20">
                <label className="text-sm font-medium text-gray-900">
                  Match Date
                </label>
                <DatePicker
                  value={matchDate}
                  onChange={setMatchDate}
                  placeholder="Select match date"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={
                isUploading ||
                !selectedFile ||
                !matchDate ||
                !opponent ||
                !teamName
              }
              className="w-full h-12 mt-6 bg-gradient-to-r from-[#0047AB] to-[#E8A550] hover:opacity-90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Submit"}
            </Button>
          </motion.form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
