"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <main className="flex-1 bg-[#E8F1FA] px-6 py-12 md:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Features */}
          <div className="space-y-8">
            <div className="flex justify-center md:justify-start">
              <PasserIcon size="md" />
            </div>

            <div className="space-y-3 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-semibold text-[#0047AB] text-balance">
                Start analyzing your matches today
              </h1>
              <p className="text-gray-700 text-base leading-relaxed max-w-md mx-auto md:mx-0">
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
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F5A623] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-gray-800 text-[15px]">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md space-y-6">
              <Card className="p-8 shadow-lg border-gray-200">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-gray-900">
                      Create your account
                    </h2>
                    <p className="text-gray-600 text-sm">
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
                        className="text-sm font-medium text-gray-900"
                      >
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        className="h-11 bg-gray-50 border-gray-200"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

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
                      <Label
                        htmlFor="password"
                        className="text-sm font-medium text-gray-900"
                      >
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a strong password"
                        className="h-11 bg-gray-50 border-gray-200"
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
                      className="w-full h-12 bg-gradient-to-r from-[#0047AB] to-[#E8A550] hover:opacity-90 text-white font-medium text-base"
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Create account"}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </form>

                  <div className="text-center text-sm text-gray-600">
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

              <p className="text-center text-xs text-gray-600 px-4">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-gray-900">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline hover:text-gray-900">
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
