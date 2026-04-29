"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setEmail(user.email ?? null);
    const { data: row } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, created_at")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(row as ProfileRow | null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const display =
    profile?.display_name?.trim() || (email ? email.split("@")[0] : null);
  const initial = display ? display.slice(0, 1).toUpperCase() : "?";

  const joined =
    profile?.created_at ?
      new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-[#171717] antialiased">
      <SiteHeader title="Your profile" />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        {loading ?
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            Loading...
          </div>
        : <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-6 pb-10 pt-10 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-900 text-2xl font-bold uppercase text-white">
                {initial}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
                {profile?.display_name?.trim() || display || "Debater"}
              </h1>
              {email ?
                <p className="mt-1 text-sm text-gray-500">{email}</p>
              : null}
              {joined ?
                <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Member since {joined}
                </p>
              : null}
            </div>
            <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-center">
              <Link
                href="/settings"
                className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Edit in settings
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        }
      </div>
    </div>
  );
}
