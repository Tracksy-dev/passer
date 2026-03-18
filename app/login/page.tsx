"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowRight, Radar, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
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
        // Login successful - use window.location for full page reload
        // This ensures cookies are synced with the server/middleware
        window.location.href = redirectTo;
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
      <main className="page-shell flex-1 px-6 py-12 md:py-20 flex items-center">
        <div className="w-full max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <section className="hidden lg:block">
            <div className="glass-surface aurora-border p-8 xl:p-10 space-y-6">
              <span className="chip-kicker">
                <Sparkles className="w-3.5 h-3.5" />
                Intelligent Recruiting Workflow
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl xl:text-5xl font-semibold text-balance gradient-text-animated">
                  Turn raw matches into recruiting-ready proof.
                </h1>
                <p className="text-base text-[#1f4f88]/90 leading-relaxed max-w-xl">
                  Passer combines video organization, point-level analysis, and
                  highlight creation so coaches and recruiters can evaluate
                  athletes with context, not guesswork.
                </p>
              </div>
              <div className="grid gap-3">
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 rounded-xl border border-[#0047AB]/15 bg-white/60 p-3 hover-border-glow"
                >
                  <Radar className="w-4 h-4 text-[#0b57b5]" />
                  <p className="text-sm text-[#163f73]">
                    Explore player reels and performance trends in one place.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 rounded-xl border border-[#0047AB]/15 bg-white/60 p-3 hover-border-glow"
                >
                  <ShieldCheck className="w-4 h-4 text-[#0b57b5]" />
                  <p className="text-sm text-[#163f73]">
                    Authenticated profiles and secure video ownership with
                    Supabase.
                  </p>
                </motion.div>
              </div>
            </div>
          </section>

          <div className="w-full max-w-md lg:max-w-lg mx-auto space-y-6">
            <div className="flex flex-col items-center space-y-4 lg:hidden">
              <PasserIcon size="md" />
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold text-[#0047AB]">
                  Welcome to Passer
                </h1>
                <p className="text-[#25558e] text-base">
                  AI-powered volleyball match intelligence
                </p>
              </div>
            </div>

            <Card className="p-8 border-white/70 bg-white/78 backdrop-blur-xl">
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="chip-kicker">Sign In</span>
                  <h2 className="text-2xl font-semibold text-[#153f74]">
                    Access your dashboard
                  </h2>
                </div>

                <form className="space-y-5" onSubmit={handleLogin}>
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm text-[#153f74]">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="h-11"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="password"
                        className="text-sm text-[#153f74]"
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
                      className="h-11"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </form>

                <div className="text-center text-sm text-[#3d608d]">
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

            <p className="text-center text-xs text-[#4a678b] px-4">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-[#0f3e7d]">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-[#0f3e7d]">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
