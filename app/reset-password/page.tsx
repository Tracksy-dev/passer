"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useEffect, Suspense } from "react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  // Validate token on mount - Supabase automatically validates the hash from the email link
  useEffect(() => {
    const validateToken = async () => {
      // Check if we have the hash fragment from Supabase email link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (type !== "recovery" || !accessToken) {
        setIsValidToken(false);
        return;
      }

      // Verify the session is valid
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        setIsValidToken(false);
        return;
      }

      setIsValidToken(true);
    };

    validateToken();
  }, []);

  const validateForm = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setIsSuccess(true);
    } catch (err) {
      console.error("Password reset error:", err);
      setErrors({
        password:
          "Failed to reset password. Please try again or request a new reset link.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while validating token
  if (isValidToken === null) {
    return (
      <Card className="p-8 shadow-lg border-gray-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#0047AB] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Validating reset link...</p>
        </div>
      </Card>
    );
  }

  // Invalid or expired token state
  if (!isValidToken) {
    return (
      <Card className="p-8 shadow-lg border-gray-200">
        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Invalid or expired link
              </h2>
              <p className="text-gray-600 text-sm">
                This password reset link is invalid or has expired. Please
                request a new one.
              </p>
            </div>
          </div>

          <Link href="/forgot-password">
            <Button className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base">
              Request new reset link
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-[#0047AB] font-medium hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <Card className="p-8 shadow-lg border-gray-200">
        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Password reset successful
              </h2>
              <p className="text-gray-600 text-sm">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
            </div>
          </div>

          <Link href="/login">
            <Button className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base">
              Sign in to your account
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  // Reset password form
  return (
    <Card className="p-8 shadow-lg border-gray-200">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Set new password
        </h2>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-gray-900"
            >
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors({ ...errors, password: undefined });
                }}
                placeholder="Enter your new password"
                className={`h-11 bg-gray-50 border-gray-200 pr-10 ${errors.password ? "border-red-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="text-xs text-red-500">{errors.password}</p>
            ) : (
              <p className="text-xs text-gray-600">
                Must be at least 8 characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-900"
            >
              Confirm new password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword)
                    setErrors({ ...errors, confirmPassword: undefined });
                }}
                placeholder="Confirm your new password"
                className={`h-11 bg-gray-50 border-gray-200 pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base"
          >
            {isLoading ? "Resetting password..." : "Reset password"}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-[#0047AB] font-medium hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
                Create new password
              </h1>
              <p className="text-gray-700 text-base">
                Choose a strong password for your account
              </p>
            </div>
          </div>

          {/* Reset Password Form with Suspense for useSearchParams */}
          <Suspense
            fallback={
              <Card className="p-8 shadow-lg border-gray-200">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-2 border-[#0047AB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-600">Loading...</p>
                </div>
              </Card>
            }
          >
            <ResetPasswordForm />
          </Suspense>

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
