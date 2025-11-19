import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { PasserIcon } from "@/components/ui/passer-icon";

export default function SignUpPage() {
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

                  <form className="space-y-5">
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
                      />
                      <p className="text-xs text-gray-600">
                        Must be at least 8 characters
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#0047AB] to-[#E8A550] hover:opacity-90 text-white font-medium text-base"
                    >
                      Create account
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
