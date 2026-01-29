"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Send password reset email via Supabase Auth
      // Supabase will check if the email exists and only send if it does
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (resetError) {
        // Check if it's a "User not found" error
        if (
          resetError.message.includes("User not found") ||
          resetError.message.includes("not found")
        ) {
          setError("No account found with this email address");
        } else {
          throw resetError;
        }
        setIsLoading(false);
        return;
      }

      // Always show success message for security (don't reveal if email exists)
      setIsSubmitted(true);
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 bg-[#E8F1FA] px-6 py-12 md:py-20 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* Centered Icon and Header Text */}
          <div className="flex flex-col items-center space-y-4">
            <PasserIcon size="md" />
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold text-[#0047AB]">
                Reset your password
              </h1>
              <p className="text-gray-700 text-base">
                {isSubmitted
                  ? "Check your email for reset instructions"
                  : "Enter your email and we'll send you a reset link"}
              </p>
            </div>
          </div>

          {/* Reset Password Card */}
          <Card className="p-8 shadow-lg border-gray-200">
            {isSubmitted ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#E8F1FA] flex items-center justify-center">
                    <Mail className="w-8 h-8 text-[#0047AB]" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Check your email
                    </h2>
                    <p className="text-gray-600 text-sm">
                      We've sent a password reset link to{" "}
                      <span className="font-medium text-gray-900">{email}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">
                    Didn't receive the email? Check your spam folder or
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSubmitted(false)}
                    className="w-full h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Try another email address
                  </Button>
                </div>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-[#0047AB] font-medium hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Forgot your password?
                </h2>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-900"
                    >
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(""); // Clear error when user types
                      }}
                      placeholder="you@example.com"
                      className="h-11 bg-gray-50 border-gray-200"
                    />
                    <p className="text-xs text-gray-600">
                      Enter the email address associated with your account
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base"
                  >
                    {isLoading ? "Sending..." : "Send reset link"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </form>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-[#0047AB] font-medium hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to sign in
                  </Link>
                </div>
              </div>
            )}
          </Card>

          <p className="text-center text-xs text-gray-600 px-4">
            Need help?{" "}
            <Link href="/contact" className="underline hover:text-gray-900">
              Contact Support
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
