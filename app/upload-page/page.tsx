"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { CheckCircle2, AlertCircle } from "lucide-react";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_FORMATS = [".mp4", ".mov", ".avi"];
const ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileUploadComplete, setFileUploadComplete] = useState(false);
  const [fileUploadError, setFileUploadError] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [opponent, setOpponent] = useState("");

  const validateFile = (file: File): string | null => {
    // Check file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidFormat =
      ALLOWED_FORMATS.includes(fileExtension || "") ||
      ALLOWED_MIME_TYPES.includes(file.type);

    if (!isValidFormat) {
      return `Invalid file format. Please upload a video file (${ALLOWED_FORMATS.join(
        ", "
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

  const simulateFileUpload = (_file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setFileUploadComplete(false);
    setFileUploadError(false);

    // Simulate file upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);

          // Simulate random upload success/failure (90% success rate)
          // In production, this would be based on actual upload result
          const uploadSuccess = Math.random() > 0.1;

          if (uploadSuccess) {
            setFileUploadComplete(true);
            setFileUploadError(false);
          } else {
            setFileUploadComplete(false);
            setFileUploadError(true);
            setErrorMessage("Failed to upload video. Please try again.");
          }

          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      setErrorMessage("Please select a video file to upload");
      setUploadStatus("error");
      return;
    }

    if (!matchDate || !opponent) {
      setErrorMessage("Please fill in match date and opponent");
      setUploadStatus("error");
      return;
    }

    // Submit the data (replace with actual API call later)
    setUploadStatus("success");
    // Here you would send the file, matchDate, and opponent to your backend
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
      simulateFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && handleFileValidation(file)) {
      setSelectedFile(file);
      simulateFileUpload(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      <main className="flex-1 bg-gray-50 px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Status Messages */}
          {uploadStatus === "success" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">
                Video uploaded successfully! Your match analysis will be ready
                shortly.
              </p>
            </div>
          )}

          {uploadStatus === "error" && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`bg-white rounded-lg border-2 border-dashed p-16 transition-colors ${
              isDragging ? "border-[#0047AB] bg-blue-50" : "border-gray-300"
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
                <p className="text-gray-500">or</p>
              </div>

              {/* Upload Button */}
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".mp4,.mov,.avi"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => document.getElementById("file-upload")?.click()}
                className="bg-[#0047AB] hover:bg-[#003580] text-white px-8 h-11"
              >
                Click to upload
              </Button>

              {/* Supported Formats */}
              <p className="text-sm text-gray-600 mt-2">
                Supported formats: .mp4, .mov, .avi (Max: 500MB)
              </p>
            </div>
          </div>

          {/* Progress Bar - Shows during file upload */}
          {isUploading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                  <div
                    className="bg-[#0047AB] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Please wait while we upload your video file...
                </p>
              </div>
            </div>
          )}

          {/* File Upload Success Message */}
          {fileUploadComplete && !isUploading && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-green-800 font-medium">
                  Video uploaded successfully!
                </p>
                <p className="text-green-700 text-sm mt-1">
                  Please fill in the match details below and click Submit.
                </p>
              </div>
            </div>
          )}

          {/* File Upload Error Message */}
          {fileUploadError && !isUploading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-medium">Upload failed</p>
                <p className="text-red-700 text-sm mt-1">
                  {errorMessage || "Failed to upload video. Please try again."}
                </p>
              </div>
            </div>
          )}

          {/* Match Details Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Match Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Match Date
                </label>
                <Input
                  type="date"
                  className="h-11 bg-gray-50 border-gray-200"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                />
              </div>

              {/* Opponent */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Opponent
                </label>
                <Input
                  type="text"
                  placeholder="e.g., St. Mary's College"
                  className="h-11 bg-gray-50 border-gray-200"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={
                isUploading ||
                !fileUploadComplete ||
                !selectedFile ||
                !matchDate ||
                !opponent
              }
              className="w-full h-12 mt-6 bg-gradient-to-r from-[#0047AB] to-[#E8A550] hover:opacity-90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
