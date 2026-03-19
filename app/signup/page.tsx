"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Check,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Track password requirements
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate password before submitting
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Signup successful, redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || "An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Main Content */}
      <main className="page-shell flex-1 px-6 py-12 md:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Features */}
          <div className="space-y-8 glass-surface aurora-border p-7 md:p-8">
            <span className="chip-kicker w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              Build Your Athlete Profile
            </span>
            <div className="flex justify-center md:justify-start">
              <PasserIcon size="md" />
            </div>

            <div className="space-y-3 text-center md:text-left">
              <h1 className="text-2xl md:text-4xl font-semibold text-balance gradient-text-animated">
                Start analyzing your matches today
              </h1>
              <p className="text-[#315c91] text-base leading-relaxed max-w-md mx-auto md:mx-0">
                Join thousands of coaches and players using Passer to gain
                insights from their volleyball matches.
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto md:mx-0">
              {[
                "AI-powered match analysis",
                "Detailed player statistics",
                "Automated match reports",
                "Team performance tracking",
              ].map((feature, idx) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#e8a550] to-[#d9861f] flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[#123f77] text-[15px]">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md space-y-6">
              <Card className="p-8 border-white/70 bg-white/78 backdrop-blur-xl">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="chip-kicker">Create Account</span>
                    <h2 className="text-2xl font-semibold text-[#153f74]">
                      Create your account
                    </h2>
                    <p className="text-[#40638f] text-sm">
                      Start your free trial today
                    </p>
                  </div>

                  <form className="space-y-5" onSubmit={handleSignUp}>
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label
                        htmlFor="fullName"
                        className="text-sm text-[#153f74]"
                      >
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        className="h-11"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

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
                      <Label
                        htmlFor="password"
                        className="text-sm text-[#153f74]"
                      >
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a strong password"
                        className="h-11"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <div className="text-xs space-y-1.5 mt-2">
                        <p className="font-medium text-gray-700">
                          Password must contain:
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {passwordRequirements.minLength ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                              className={
                                passwordRequirements.minLength
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }
                            >
                              At least 8 characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasUppercase ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                              className={
                                passwordRequirements.hasUppercase
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }
                            >
                              One uppercase letter
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasLowercase ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                              className={
                                passwordRequirements.hasLowercase
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }
                            >
                              One lowercase letter
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasNumber ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                              className={
                                passwordRequirements.hasNumber
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }
                            >
                              One number
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasSpecialChar ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                              className={
                                passwordRequirements.hasSpecialChar
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }
                            >
                              One special character (!@#$%^&*...)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base"
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Create account"}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </form>

                  <div className="text-center text-sm text-[#3d608d]">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-[#0047AB] font-medium hover:underline"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              </Card>

              <p className="text-center text-xs text-[#4a678b] px-4">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-[#0f3e7d]">
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="underline hover:text-[#0f3e7d]"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
