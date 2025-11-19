"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Login successful, redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Main Content */}
      <main className="flex-1 bg-[#E8F1FA] px-6 py-12 md:py-20 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* Centered Icon and Welcome Text */}
          <div className="flex flex-col items-center space-y-4">
            <PasserIcon size="md" />
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold text-[#0047AB]">
                Welcome to Passer
              </h1>
              <p className="text-gray-700 text-base">
                AI-powered volleyball match analysis
              </p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="p-8 shadow-lg border-gray-200">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Sign in to your account
              </h2>

              <form className="space-y-5" onSubmit={handleLogin}>
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
                    placeholder="you@example.com"
                    className="h-11 bg-gray-50 border-gray-200"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-900"
                    >
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-[#0047AB] font-medium hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    className="h-11 bg-gray-50 border-gray-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#0047AB] hover:bg-[#003580] text-white font-medium text-base"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>

              <div className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-[#0047AB] font-medium hover:underline"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </Card>

          <p className="text-center text-xs text-gray-600 px-4">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-900">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-900">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
