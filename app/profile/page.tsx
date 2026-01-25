"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";

type ProfileUser = {
  id: string;
  email: string | null;
  created_at?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error);
        router.push("/login");
        return;
      }

      const u = data.session?.user;
      if (!u) {
        router.push("/login");
        return;
      }

      setUser({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
      });

      setLoading(false);
    };

    load();
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      console.error("Sign out error:", error);
      return;
    }

    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      <main className="flex-1 bg-gray-50 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Your Profile
                </h1>
                <p className="text-gray-600 mt-1">
                  Account details for your Volleyball Analysis profile.
                </p>
              </div>

              <Button
                onClick={handleSignOut}
                disabled={signingOut || loading}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>

            <div className="mt-8">
              {loading ? (
                <div className="text-gray-600">Loading profile...</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Email
                    </p>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {user?.email ?? "No email available"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      User ID
                    </p>
                    <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                      {user?.id}
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => router.push("/dashboard")}
                      className="bg-[#0047AB] hover:bg-[#003580] text-white"
                    >
                      Back to dashboard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
