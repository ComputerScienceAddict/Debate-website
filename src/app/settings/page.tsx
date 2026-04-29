"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createClient } from "@/lib/supabase/client";

type TagRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

type Stance = "support" | "oppose" | "neutral";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<TagRow[]>([]);
  const [stances, setStances] = useState<Record<string, Stance>>({});
  const [savingStances, setSavingStances] = useState(false);
  const [stanceMessage, setStanceMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setUserId(user.id);
    setEmail(user.email ?? null);

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    setDisplayName((prof?.display_name as string | undefined)?.trim() ?? "");

    const tagsRes = await fetch("/api/onboarding/tags", { cache: "no-store" });
    if (!tagsRes.ok) {
      setLoading(false);
      return;
    }
    const tagsData = (await tagsRes.json()) as { tags?: TagRow[] };
    const list = Array.isArray(tagsData.tags) ? tagsData.tags : [];
    setTags(list);

    const { data: prefs } = await supabase
      .from("user_tag_preferences")
      .select("tag_id, stance")
      .eq("user_id", user.id);
    const next: Record<string, Stance> = {};
    for (const row of prefs ?? []) {
      const s = row.stance;
      const id = row.tag_id as string;
      if (s === "support" || s === "oppose" || s === "neutral") next[id] = s;
    }
    setStances(next);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setNameMessage(null);
    setSavingName(true);
    try {
      const supabase = createClient();
      const trimmed = displayName.trim();
      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          display_name: trimmed.length > 0 ? trimmed : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      setNameMessage("Saved.");
    } catch {
      setNameMessage("Could not save display name.");
    } finally {
      setSavingName(false);
    }
  }

  async function saveStances() {
    setStanceMessage(null);
    if (tags.some((t) => stances[t.id] === undefined)) {
      setStanceMessage("Pick a stance for every topic.");
      return;
    }
    setSavingStances(true);
    try {
      const preferences = tags.map((t) => ({
        tag_id: t.id,
        stance: stances[t.id]!,
      }));
      const res = await fetch("/api/onboarding/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setStanceMessage("Saved.");
    } catch (err) {
      setStanceMessage(
        err instanceof Error ? err.message : "Could not save positions."
      );
    } finally {
      setSavingStances(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-[#171717] antialiased">
      <SiteHeader title="Settings" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8">
        {loading ?
          <p className="text-center text-sm text-gray-500">Loading...</p>
        : <>
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-400">
                Account
              </h2>
              {email ?
                <p className="mt-2 text-sm text-gray-500">
                  Signed in as <span className="font-medium text-gray-700">{email}</span>
                </p>
              : null}
              <form onSubmit={(e) => void saveDisplayName(e)} className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Display name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How others see you in debates"
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none ring-0 transition-colors focus:border-gray-500"
                    maxLength={80}
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingName}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
                >
                  {savingName ? "Saving..." : "Save name"}
                </button>
                {nameMessage ?
                  <p className={`text-xs ${nameMessage.startsWith("Could") ? "text-red-600" : "text-green-700"}`}>
                    {nameMessage}
                  </p>
                : null}
              </form>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Debate positions
                </h2>
                <p className="text-xs text-gray-500">
                  Same topics as onboarding. Adjust anytime.
                </p>
              </div>
              <div className="mt-6 space-y-6">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="border-b border-gray-100 pb-6 last:border-0 last:pb-0"
                  >
                    <p className="font-semibold text-gray-900">{tag.label}</p>
                    {tag.description ?
                      <p className="mt-1 text-sm text-gray-500">{tag.description}</p>
                    : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["support", "oppose", "neutral"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStances((prev) => ({ ...prev, [tag.id]: s }))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            stances[tag.id] === s ?
                              "border-black bg-black text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {s[0].toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {tags.length > 0 ?
                <button
                  type="button"
                  onClick={() => void saveStances()}
                  disabled={savingStances}
                  className="mt-6 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
                >
                  {savingStances ? "Saving..." : "Save positions"}
                </button>
              : null}
              {stanceMessage ?
                <p
                  className={`mt-2 text-xs ${stanceMessage.includes("Saved") ? "text-green-700" : "text-red-600"}`}
                >
                  {stanceMessage}
                </p>
              : null}
            </section>

            <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-red-800">Session</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sign out on this device. You can always log in again later.
              </p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100"
              >
                Sign out
              </button>
            </section>

            <p className="text-center">
              <Link
                href="/profile"
                className="text-sm font-medium text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline"
              >
                View profile
              </Link>
              {" · "}
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline"
              >
                Home
              </Link>
            </p>
          </>
        }
      </div>
    </div>
  );
}
