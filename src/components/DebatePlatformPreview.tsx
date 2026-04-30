"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import type { LiveCheckResponse, RefereeEvent } from "@/lib/referee/types";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  attachLocalMedia as attachLocalMediaBase,
  createDebatePeerConnection,
  stopMediaStream,
} from "@/lib/webrtc/peer";
import {
  createBroadcastSignaling,
  upsertPresence,
  type BroadcastSignaling,
} from "@/lib/webrtc/signaling";
import { isWebrtcCaller } from "@/lib/webrtc/caller-selection";
import {
  ICE_DISCONNECT_HOLD_MS,
  isIceDisconnectedProvisional,
  isIceTerminated,
} from "@/lib/webrtc/ice-policy";

type LogoMarkProps = {
  spinning?: boolean;
  /** Scale pulse up/down instead of rotating (pairing / matchmaking). */
  pulsing?: boolean;
  size?: "nav" | "large";
};

/** TV mark — same asset as welcome hero (`public/debate-room-welcome-mark.png`). */
function LogoMark({ spinning = false, pulsing = false, size = "nav" }: LogoMarkProps) {
  const markSize = size === "large" ? "h-20 w-20" : "h-10 w-10";

  const motion =
    pulsing ?
      "animate-matchmaking-logo-breathe"
    : spinning ? "animate-spin"
    : "";

  const hoverGrow =
    pulsing ? "" : "transition-transform duration-500 ease-out group-hover:scale-[1.02] hover:scale-[1.02]";

  return (
    <div
      className={`relative shrink-0 bg-transparent will-change-transform ${markSize} ${hoverGrow} ${motion}`}
    >
      <Image
        src="/debate-room-welcome-mark.png"
        alt=""
        width={855}
        height={880}
        priority
        unoptimized
        className="block size-full bg-transparent object-contain"
      />
    </div>
  );
}

function LogoButton({
  onClick,
  spinning = false,
  variant = "default",
}: {
  onClick: () => void;
  spinning?: boolean;
  variant?: "default" | "landing";
}) {
  const landing = variant === "landing";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        landing
          ? "group flex cursor-pointer items-center gap-4 text-left"
          : "group flex max-w-full items-center gap-[1.125rem] text-left sm:w-[310px]"
      }
    >
      <LogoMark spinning={spinning} />
      <span
        className={
          landing
            ? "hidden font-black uppercase tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-orange-600 md:block md:text-xl"
            : "select-none font-sans text-[28px] font-black uppercase leading-none tracking-[-0.045em] text-[#101318] transition-colors duration-300 group-hover:text-[#ff4d00]"
        }
      >
        DEBATEROOM
      </span>
    </button>
  );
}

/** Primary CTA: chunky “chat roulette” / late-web bevel, monospace caps (Omegle-adjacent). */
function StartSessionButton({
  onClick,
  transitioning,
  requiresSignIn = false,
}: {
  onClick: () => void;
  transitioning: boolean;
  requiresSignIn?: boolean;
}) {
  const disabled = transitioning || requiresSignIn;
  const label =
    transitioning ? "WAITING…" : requiresSignIn ? "SIGN IN FIRST" : "DEBATE NOW";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        requiresSignIn
          ? "Create an account or log in to get matched into a debate."
          : transitioning
            ? "Finding someone to debate"
            : "Jump into a random debate"
      }
      className="font-sidebar-mono inline-flex shrink-0 select-none items-center justify-center rounded-sm border-2 border-t-[#ffb896] border-l-[#ffc8a8] border-r-[#6b2000] border-b-[#4a1500] bg-gradient-to-b from-[#ff9a5c] via-[#ff4d00] to-[#b83200] px-7 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),2px_3px_0_rgba(0,0,0,0.2)] outline-none transition-[filter,transform,box-shadow] duration-75 hover:brightness-[1.06] active:translate-y-[2px] active:border-t-[#4a1500] active:border-l-[#4a1500] active:border-b-[#ffb896] active:border-r-[#ffb896] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f3f2] disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-40 disabled:brightness-90 disabled:shadow-none"
    >
      {label}
    </button>
  );
}


type LiveRoomCard = {
  id: string;
  title: string;
  topic: string;
  referee: string;
  viewers: number;
  tags: string[];
};

type OnboardingTag = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

function PlaceholderPlayGlyph() {
  return (
    <svg className="h-12 w-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

function LandingHomeView({
  onLogo,
  onGoLive,
  transitioning,
  userEmail,
  onRequestAuth,
  onLogout,
}: {
  onLogo: () => void;
  onGoLive: (room?: LiveRoomCard) => void;
  transitioning: boolean;
  userEmail: string | null;
  onRequestAuth: (mode?: "login" | "signup", message?: string) => void;
  onLogout: () => void;
}) {
  const disabled = transitioning;
  const [liveRooms, setLiveRooms] = useState<LiveRoomCard[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveRooms() {
      try {
        const response = await fetch("/api/rooms/live", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load rooms");
        const data = await response.json();
        if (!cancelled) setLiveRooms(Array.isArray(data.rooms) ? data.rooms : []);
      } catch {
        if (!cancelled) setLiveRooms([]);
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    }

    loadLiveRooms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

  const liveChannels = liveRooms.slice(0, 6).map((room) => ({
    id: room.id,
    title: room.title,
    spectating: `${room.viewers} watching`,
  }));

  const topicPills = Array.from(new Set(liveRooms.map((room) => room.topic))).slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 antialiased">
      <nav className="glass-nav fixed left-0 right-0 top-0 z-50 flex h-[70px] flex-col justify-center border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0 shrink">
            <LogoButton onClick={onLogo} spinning={transitioning} variant="landing" />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-y-2 sm:gap-y-2 sm:gap-x-3 md:gap-x-4 lg:gap-x-5">
              <div className="flex shrink-0 items-center">
                <StartSessionButton
                  onClick={() => {
                    if (userEmail) {
                      onGoLive();
                      return;
                    }
                    onRequestAuth("login", "Log in or sign up to join a debate.");
                  }}
                  transitioning={transitioning}
                  requiresSignIn={!userEmail}
                />
              </div>

              {userEmail ?
                <>
                  <div className="hidden h-8 w-px shrink-0 self-center bg-gray-200 sm:block" aria-hidden />

                  <div className="relative shrink-0">
                    <div className="relative" ref={accountMenuRef}>
                      <button
                        type="button"
                        id="account-menu-button"
                        title={userEmail}
                        aria-label="Account menu"
                        aria-expanded={accountMenuOpen}
                        aria-haspopup="menu"
                        aria-controls="account-dropdown"
                        onClick={() => setAccountMenuOpen((open) => !open)}
                        className="flex h-9 min-h-[36px] min-w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-gray-900 text-xs font-semibold uppercase text-white outline-none ring-offset-2 ring-offset-white transition hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-400"
                      >
                        {userEmail.slice(0, 1)}
                      </button>
                      {accountMenuOpen ?
                        <div
                          id="account-dropdown"
                          role="menu"
                          aria-labelledby="account-menu-button"
                          className="absolute right-0 top-[calc(100%+6px)] z-[100] min-w-[11.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          <Link
                            href="/profile"
                            role="menuitem"
                            className="block px-4 py-2.5 text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50 sm:text-sm"
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            Profile
                          </Link>
                          <Link
                            href="/settings"
                            role="menuitem"
                            className="block px-4 py-2.5 text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50 sm:text-sm"
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            Settings
                          </Link>
                          <div className="my-1 border-t border-gray-100" role="separator" />
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-4 py-2.5 text-left text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 sm:text-sm"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              onLogout();
                            }}
                          >
                            Log out
                          </button>
                        </div>
                      : null}
                    </div>
                  </div>
                </>
              : (
                <button
                  type="button"
                  onClick={() => onRequestAuth("login")}
                  className="hidden whitespace-nowrap text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:block"
                >
                  Log in / Sign up
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <aside className="sidebar fixed bottom-0 left-0 top-[70px] z-40 flex w-[260px] flex-col overflow-hidden border-r border-gray-200 bg-white pl-0 pr-4 max-lg:w-[70px] max-lg:px-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8">
          <p className="sidebar-section-label mb-4 shrink-0 px-4 max-lg:hidden">
            Live channels
          </p>
          <nav aria-label="Live channels" className="flex flex-col">
            {loadingRooms ? (
              <p className="sidebar-copy-muted px-4 py-3 text-gray-500">
                Loading live channels...
              </p>
            ) : liveChannels.length === 0 ? (
              <p className="sidebar-copy-muted px-4 py-3 text-gray-500">
                No live channels yet.
              </p>
            ) : (
              liveChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    const room = liveRooms.find((r) => r.id === ch.id);
                    onGoLive(room);
                  }}
                  className="group flex w-full items-center gap-0 text-left transition-colors hover:bg-gray-50 max-lg:justify-center max-lg:py-3 lg:min-h-[4.25rem] lg:border-b lg:border-gray-100 lg:last:border-b-0"
                >
                  <span
                    className="hidden h-2 w-2 shrink-0 rounded-full bg-red-500 max-lg:block"
                    aria-hidden
                  />
                  <div className="sidebar-text flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 max-lg:hidden">
                    <span className="font-sans text-sm font-semibold leading-snug tracking-tight text-gray-900 group-hover:text-gray-950">
                      {ch.title}
                    </span>
                    <span className="font-sans text-xs text-gray-500">{ch.spectating}</span>
                  </div>
                </button>
              ))
            )}
          </nav>
        </div>

        <div className="sidebar-text mt-auto shrink-0 border-t border-gray-100 pb-8 pt-6 max-lg:hidden">
          <p className="sidebar-section-label mb-4 px-4">Topics</p>
          <div className="flex flex-wrap gap-2 px-4">
            {topicPills.length === 0 ? (
              <span className="sidebar-copy-muted text-gray-500">
                Topics appear when live rooms are available.
              </span>
            ) : (
              topicPills.map((topic) => (
                <span
                  key={topic}
                  className="sidebar-topic-chip rounded-md border border-gray-200/90 bg-[#fafafa] px-2.5 py-1 text-[11px] font-medium text-gray-700"
                >
                  {topic}
                </span>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="main-content ml-[260px] pt-[70px] max-lg:ml-[70px]">
        <section className="p-6 sm:p-8" aria-labelledby="welcome-brand">
          <div className="relative flex min-h-[240px] w-full overflow-hidden rounded-[24px] border border-white/15 px-6 py-12 sm:min-h-[280px] sm:px-8 sm:py-14 md:min-h-[320px]">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url(/welcome-debate-bg.webp)" }}
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/60"
              aria-hidden
            />
            <div className="relative z-10 flex w-full flex-col items-center justify-center">
              <Image
                src="/debate-room-welcome-mark.png"
                alt=""
                width={855}
                height={880}
                priority
                unoptimized
                className="mx-auto h-auto w-auto max-w-[min(72vw,200px)] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)] sm:max-w-[220px] md:max-w-[240px]"
              />
              <h2
                id="welcome-brand"
                className="mt-6 select-none text-center font-sans text-[clamp(1.5rem,4.5vw,2.25rem)] font-black uppercase leading-none tracking-[-0.04em] text-white antialiased drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
              >
                DEBATEROOM
              </h2>
            </div>
          </div>
        </section>

        <section className="border-t border-neutral-200/90 px-6 pb-16 pt-10 sm:px-8">
          <div className="mb-10">
            <h2 className="discussions-heading">Live discussions</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {loadingRooms ? (
              <p className="discussions-empty col-span-full">Loading…</p>
            ) : liveRooms.length === 0 ? (
              <p className="discussions-empty col-span-full max-w-md">
                None live yet. Hit Debate now when you are ready.
              </p>
            ) : (
              liveRooms.map((card) => (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={disabled ? undefined : () => onGoLive(card)}
                  onKeyDown={
                    disabled
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onGoLive(card);
                          }
                        }
                  }
                  className={`overflow-hidden rounded-xl border border-neutral-200/80 bg-white ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                >
                  <div className="relative aspect-video overflow-hidden bg-gray-50">
                    <div className="absolute left-3 top-3 z-10 rounded-sm bg-[#dc2626] px-1.5 py-px font-sidebar-mono text-[10px] font-semibold lowercase tracking-wide text-white">
                      live
                    </div>
                    <div className="absolute bottom-3 left-3 z-10 rounded-sm bg-black/55 px-1.5 py-px font-sidebar-mono text-[10px] font-medium text-white backdrop-blur-sm">
                      {card.viewers} watching
                    </div>
                    <div className="flex h-full w-full items-center justify-center bg-gray-200">
                      <PlaceholderPlayGlyph />
                    </div>
                  </div>
                  <div className="space-y-2 p-5">
                    <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-tight text-zinc-900">
                      {card.title}
                    </h3>
                    <p className="discussions-card-meta">{card.referee}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="sidebar-topic-chip rounded border border-neutral-200/90 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-zinc-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthPageView({
  mode,
  initialMessage,
  onBack,
  onSuccess,
}: {
  mode: "login" | "signup";
  initialMessage?: string | null;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "signup">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(initialMessage ?? null);

  useEffect(() => {
    setAuthMode(mode);
  }, [mode]);

  async function submitAuthForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    setAuthLoading(true);

    try {
      const supabase = createSupabaseClient();
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setAuthError(error.message);
          return;
        }
        onSuccess();
      } else {
        const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        });
        if (error) {
          setAuthError(error.message);
          return;
        }
        setAuthMessage("Account created. Check your email to verify your account.");
      }
    } catch {
      setAuthError("Auth unavailable. Check Supabase environment variables.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f4] px-4 py-10 text-gray-900 antialiased">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center justify-center border-b border-black/10 pb-4">
          <LogoMark size="large" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#171717]">
            {authMode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm font-normal text-gray-500">
            {authMode === "login"
              ? "Log in to start your next debate."
              : "Sign up to enter the arena."}
          </p>
        </div>
        <form
          onSubmit={submitAuthForm}
          className="space-y-3 rounded-xl border border-gray-200 bg-white p-5"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-gray-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-gray-500"
          />

          {authError ? <p className="text-xs text-red-600">{authError}</p> : null}
          {authMessage ? <p className="text-xs text-green-700">{authMessage}</p> : null}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
          >
            {authLoading ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setAuthMode((m) => (m === "login" ? "signup" : "login"));
            setAuthError(null);
            setAuthMessage(null);
          }}
          className="text-center text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

function OnboardingTagsView({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [tags, setTags] = useState<OnboardingTag[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, "support" | "oppose" | "neutral">>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tagsRes = await fetch("/api/onboarding/tags", { cache: "no-store" });
        if (!tagsRes.ok) throw new Error("Could not load topics.");
        const tagsData = (await tagsRes.json()) as { tags?: OnboardingTag[] };
        if (!cancelled) setTags(Array.isArray(tagsData.tags) ? tagsData.tags : []);

        // Best-effort prefill from existing preferences.
        try {
          const supabase = createSupabaseClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user && !cancelled) {
            const { data: prefs } = await supabase
              .from("user_tag_preferences")
              .select("tag_id, stance")
              .eq("user_id", user.id);
            if (prefs && !cancelled) {
              const next: Record<string, "support" | "oppose" | "neutral"> = {};
              for (const p of prefs) {
                if (
                  p.stance === "support" ||
                  p.stance === "oppose" ||
                  p.stance === "neutral"
                ) {
                  next[p.tag_id as string] = p.stance;
                }
              }
              setSelected(next);
            }
          }
        } catch {
          // ignore prefill
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load topics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tags.length === 0) return;
    const allowed = new Set(tags.map((t) => t.id));
    setSelected((prev) => {
      let changed = false;
      const next: Record<string, "support" | "oppose" | "neutral"> = { ...prev };
      for (const id of Object.keys(next)) {
        if (!allowed.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tags]);

  useEffect(() => {
    if (tags.length === 0) return;
    setSlideIndex((i) => Math.min(Math.max(i, 0), tags.length - 1));
  }, [tags]);

  const answeredAll =
    tags.length > 0 && tags.every((t) => selected[t.id] !== undefined);

  const slideTopic =
    !loading && tags.length > 0 ? tags[Math.min(slideIndex, tags.length - 1)] : undefined;

  async function savePreferences() {
    setError(null);
    if (!answeredAll || tags.length === 0) {
      setError("Answer every topic before you finish.");
      return;
    }
    setSaving(true);
    try {
      const preferences = tags.map((tag) => ({
        tag_id: tag.id,
        stance: selected[tag.id],
      }));
      const response = await fetch("/api/onboarding/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save your answers.");
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answers.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eff2f7] px-4 py-8 text-[#303545] antialiased">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-center justify-center border-b border-black/10 pb-4">
          <LogoMark size="large" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-[1.625rem] font-bold tracking-tight text-[#303545] sm:text-[1.75rem]">
            Your stance
          </h1>
          <p className="mx-auto max-w-md text-[0.9375rem] leading-relaxed text-[#646f90]">
            One topic per screen. After the last answer we save your profile.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[#dfe3ee] bg-white p-10 text-center text-[0.9375rem] text-[#646f90] shadow-[0_4px_24px_rgba(18,69,149,0.06)]">
            Loading...
          </div>
        ) : tags.length === 0 ? (
          <>
            <div className="rounded-2xl border border-[#dfe3ee] bg-white p-10 text-center text-[0.9375rem] text-[#646f90] shadow-[0_4px_24px_rgba(18,69,149,0.06)]">
              No topics are available right now. Try again later.
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border-2 border-[#dcdfe8] bg-white px-4 py-2.5 text-sm font-semibold text-[#4257b2] transition-colors hover:bg-[#f8fafc]"
              >
                Back to home
              </button>
            </div>
          </>
        ) : slideTopic ? (
              <div
                key={slideTopic.id}
                className="flex min-h-[min(440px,calc(100vh-220px))] flex-col transition-opacity duration-300"
              >
                <div
                  className="flex justify-center gap-2.5 pt-1"
                  role="status"
                  aria-live="polite"
                  aria-label={`Topic ${slideIndex + 1} of ${tags.length}`}
                >
                  {tags.map((t, i) => (
                    <span
                      key={t.id}
                      className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                        i === slideIndex ? "bg-[#4257b2]"
                        : i < slideIndex ? "bg-[#4257b2]/85"
                        : "bg-[#d3dae8]"
                      }`}
                    />
                  ))}
                </div>
                <div className="mx-auto mt-7 w-full max-w-xl rounded-2xl border border-[#dfe3ee] bg-white px-6 py-8 shadow-[0_4px_24px_rgba(18,69,149,0.07),0_1px_3px_rgba(0,0,0,0.05)] sm:px-10 sm:py-10">
                  <div className="text-center">
                    <h2 className="text-[1.375rem] font-semibold leading-snug text-[#303545] sm:text-2xl">
                      {slideTopic.label}
                    </h2>
                    {slideTopic.description ?
                      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#646f90]">
                        {slideTopic.description}
                      </p>
                    : null}
                  </div>
                  <div className="mt-8 flex flex-col gap-3">
                    {(["support", "oppose", "neutral"] as const).map((stance) => {
                      const picked = selected[slideTopic.id] === stance;
                      const label = stance.charAt(0).toUpperCase() + stance.slice(1);
                      return (
                        <button
                          key={stance}
                          type="button"
                          onClick={() =>
                            setSelected((prev) => ({
                              ...prev,
                              [slideTopic.id]: stance,
                            }))
                          }
                          className={`w-full rounded-xl border-2 px-4 py-3.5 text-left text-[0.9375rem] font-medium transition-all ${
                            picked ?
                              "border-[#4257b2] bg-[#f0f4ff] text-[#4257b2] shadow-sm"
                            : "border-[#dcdfe8] bg-white text-[#303545] hover:border-[#b4bdd4] hover:bg-[#f8fafc]"
                          }`}
                        >
                          <span className="block truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
        ) : (
          <div className="rounded-2xl border border-[#dfe3ee] bg-white p-10 text-center text-[0.9375rem] text-[#646f90] shadow-[0_4px_24px_rgba(18,69,149,0.06)]">
            Could not load this step. Try reloading the page.
          </div>
        )}

        {loading || tags.length === 0 ? null : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (slideIndex === 0) onBack();
              else setSlideIndex((i) => i - 1);
            }}
            disabled={loading}
            className="rounded-xl border-2 border-[#dcdfe8] bg-white px-5 py-2.5 text-sm font-semibold text-[#303545] transition-colors hover:border-[#b4bdd4] hover:bg-[#f8fafc] disabled:opacity-60"
          >
            {slideIndex === 0 ? "Exit" : "Previous"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (loading || tags.length === 0) return;
              const topic = tags[slideIndex];
              setError(null);
              if (!topic || selected[topic.id] === undefined) {
                setError("Choose support, oppose, or neutral first.");
                return;
              }
              if (slideIndex >= tags.length - 1) void savePreferences();
              else setSlideIndex((i) => i + 1);
            }}
            disabled={saving || loading || tags.length === 0}
            className="rounded-xl bg-[#4257b2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#364b95] disabled:opacity-60"
          >
            {saving ? "Saving..." : slideIndex >= tags.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
        )}
        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

function SearchingOverlay({ onStop }: { onStop: () => void }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      500
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-zinc-900/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Looking for a stranger{dots}
        </p>
        <p className="max-w-xs text-[11px] leading-relaxed text-zinc-500">
          If someone skips or disconnects you, we&apos;ll keep looking automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onStop}
        className="border-2 border-t-zinc-500 border-l-zinc-500 border-r-zinc-200 border-b-zinc-200 bg-zinc-800 px-8 py-2 font-mono text-sm font-bold uppercase tracking-widest text-zinc-200 hover:bg-zinc-700 active:border-t-zinc-200 active:border-l-zinc-200 active:border-r-zinc-500 active:border-b-zinc-500"
      >
        Stop
      </button>
    </div>
  );
}

type ArenaLogEntry =
  | { type: "system"; text: string }
  | { type: "spacer" }
  | { type: "stranger" | "you" | "ai"; text: string };

const DEFAULT_ARENA_LOG: ArenaLogEntry[] = [
  {
    type: "system",
    text: "Looking for someone to debate with… We'll keep searching until you're matched.",
  },
];

function ArenaView({
  onLeave,
  onNextStranger,
  onStop,
  roomId,
  topic,
  searching,
}: {
  onLeave: () => void;
  onNextStranger: () => void;
  onStop: () => void;
  roomId: string;
  topic: string;
  searching: boolean;
}) {
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<ArenaLogEntry[]>(() => [...DEFAULT_ARENA_LOG]);
  const [sending, setSending] = useState(false);
  const prevSearchingRef = useRef(searching);
  const prevRoomIdRef = useRef(roomId);
  useEffect(() => {
    if (prevSearchingRef.current && !searching && topic) {
      setLog((l) => [
        ...l,
        { type: "system", text: `You're now debating with a stranger. Topic: ${topic}` },
      ]);
    }
    prevSearchingRef.current = searching;
  }, [searching, topic]);

  // Auto-start camera when matched (roomId changes from empty to valid)
  useEffect(() => {
    if (!prevRoomIdRef.current && roomId && !searching) {
      // Small delay to let video refs mount
      const t = setTimeout(() => {
        if (localVideoRef.current && remoteVideoRef.current) {
          void startCameraAndSync();
        }
      }, 100);
      return () => clearTimeout(t);
    }
    prevRoomIdRef.current = roomId;
    // Intentional: do not depend on startCameraAndSync (new identity every render would re-arm camera).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, searching]);

  const [cameraReady, setCameraReady] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("Camera off");
  /** Local preview / outgoing WebRTC tracks (does not mute local video element echo — that stays muted). */
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  /** Sync auth / guest ids for teardown (React state batches too late for bye/presence). */
  const myUserIdRef = useRef("");
  const guestModeRef = useRef(false);
  const syncInFlightRef = useRef(false);
  /** Suppress ICE handler reacting to intentional peer.close() / teardown */
  const webrtcClosingRef = useRef(false);
  /** `disconnected` can recover — only treat as bye after ICE_DISCONNECT_HOLD_MS */
  const iceDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Avoid bye + ICE both calling goToNextStranger */
  const peerLeaveHandledRef = useRef(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalsRef = useRef<BroadcastSignaling | null>(null);
  /** Stable ref so ICE/offer closures always see the latest remote peer ID. */
  const remoteUserIdRef = useRef<string | null>(null);

  function applyLocalVideoEnabled(on: boolean) {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = on;
    });
    setVideoEnabled(on);
  }

  function applyLocalMicEnabled(on: boolean) {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
    setMicEnabled(on);
  }

  function goToNextStranger() {
    void shutdownWebRtc();
    setMessage("");
    remoteUserIdRef.current = null;
    onNextStranger();
  }

  async function startCameraAndSync() {
    if (cameraReady) return;
    if (peerRef.current !== null || syncInFlightRef.current) return;
    if (!roomId) {
      setWebrtcStatus("No room yet — find a stranger first");
      return;
    }
    if (!localVideoRef.current || !remoteVideoRef.current) {
      setWebrtcStatus("Video elements not ready");
      return;
    }

    syncInFlightRef.current = true;
    peerLeaveHandledRef.current = false;

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      const userId =
        !error && data.user
          ? data.user.id
          : `guest_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
      myUserIdRef.current = userId;
      guestModeRef.current = !data.user;

      const peer = createDebatePeerConnection();
      peerRef.current = peer;
      try {
        localStreamRef.current = await attachLocalMediaBase(
          peer,
          localVideoRef.current
        );
      } catch (mediaErr) {
        peer.close();
        peerRef.current = null;
        throw mediaErr;
      }

      peer.ontrack = (event) => {
        const incoming = event.streams[0];
        if (!incoming || !remoteVideoRef.current) return;
        if (localStreamRef.current && incoming.id === localStreamRef.current.id)
          return;
        const rv = remoteVideoRef.current;
        rv.muted = false;
        rv.playsInline = true;
        rv.autoplay = true;
        rv.setAttribute("playsinline", "");
        rv.setAttribute("webkit-playsinline", "");
        rv.srcObject = incoming;
        const tryPlay = () => rv.play().catch(() => {});
        void tryPlay();
        setTimeout(tryPlay, 50);
        setTimeout(tryPlay, 200);
        setWebrtcStatus("Connected");
      };

      setCameraReady(true);
      setMicEnabled(true);
      setVideoEnabled(true);
      setWebrtcStatus("Connecting…");

      // --- Broadcast-based signaling (no replication needed) ---
      let offerSent = false;

      const bc = createBroadcastSignaling(roomId);

      const schedulePeerLeft = () => {
        if (peerLeaveHandledRef.current || webrtcClosingRef.current) return;
        peerLeaveHandledRef.current = true;
        setLog((l) => [
          ...l,
          { type: "system", text: "Stranger has disconnected." },
        ]);
        goToNextStranger();
      };

      const sendOffer = async (peerId: string) => {
        if (offerSent) return;
        offerSent = true;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        bc.send("offer", { sdp: offer, target: peerId, sender: userId });
        setWebrtcStatus("Calling peer…");
      };

      bc
        .on("hello", (payload) => {
          const peerId = payload.sender as string;
          if (!peerId || peerId === userId) return;
          remoteUserIdRef.current = peerId;
          if (isWebrtcCaller(userId, peerId)) {
            void sendOffer(peerId);
          } else {
            bc.send("ack", { target: peerId, sender: userId });
          }
        })
        .on("ack", (payload) => {
          const peerId = payload.sender as string;
          if (!peerId || peerId === userId) return;
          const target = payload.target as string | undefined;
          if (target && target !== userId) return;
          remoteUserIdRef.current = peerId;
          if (isWebrtcCaller(userId, peerId)) void sendOffer(peerId);
        })
        .on("offer", async (payload) => {
          const target = payload.target as string | undefined;
          if (target && target !== userId) return;
          const peerId = payload.sender as string;
          remoteUserIdRef.current = peerId;
          await peer.setRemoteDescription(
            new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit)
          );
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          bc.send("answer", { sdp: answer, target: peerId, sender: userId });
          setWebrtcStatus("Connected");
        })
        .on("answer", async (payload) => {
          const target = payload.target as string | undefined;
          if (target && target !== userId) return;
          await peer.setRemoteDescription(
            new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit)
          );
          setWebrtcStatus("Connected");
        })
        .on("ice", async (payload) => {
          const target = payload.target as string | undefined;
          if (target && target !== userId) return;
          try {
            await peer.addIceCandidate(
              new RTCIceCandidate(payload.candidate as RTCIceCandidateInit)
            );
          } catch {
            // ignore stale candidates
          }
        })
        .on("bye", (payload) => {
          const target = payload.target as string | undefined;
          if (target && target !== userId) return;
          schedulePeerLeft();
        })
        .subscribe(() => {
          bc.send("hello", { sender: userId });
        });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        bc.send("ice", {
          candidate: event.candidate.toJSON(),
          target: remoteUserIdRef.current,
          sender: userId,
        });
      };

      peer.oniceconnectionstatechange = () => {
        if (webrtcClosingRef.current) return;

        const state = peer.iceConnectionState;

        if (state === "connected" || state === "completed") {
          if (iceDisconnectTimerRef.current !== null) {
            clearTimeout(iceDisconnectTimerRef.current);
            iceDisconnectTimerRef.current = null;
          }
          return;
        }

        if (isIceTerminated(state)) {
          if (iceDisconnectTimerRef.current !== null) {
            clearTimeout(iceDisconnectTimerRef.current);
            iceDisconnectTimerRef.current = null;
          }
          if (remoteUserIdRef.current) schedulePeerLeft();
          return;
        }

        if (isIceDisconnectedProvisional(state)) {
          if (iceDisconnectTimerRef.current !== null) {
            clearTimeout(iceDisconnectTimerRef.current);
          }
          iceDisconnectTimerRef.current = setTimeout(() => {
            iceDisconnectTimerRef.current = null;
            if (
              webrtcClosingRef.current ||
              peerRef.current?.iceConnectionState !== "disconnected"
            ) {
              return;
            }
            if (remoteUserIdRef.current) schedulePeerLeft();
          }, ICE_DISCONNECT_HOLD_MS);
        }
      };

      signalsRef.current = bc;

      if (data.user) {
        void upsertPresence({ roomId, userId, role: "affirmative", isOnline: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWebrtcStatus(`Failed to start camera: ${msg}`);
    } finally {
      syncInFlightRef.current = false;
    }
  }

  async function shutdownWebRtc() {
    webrtcClosingRef.current = true;
    if (iceDisconnectTimerRef.current !== null) {
      clearTimeout(iceDisconnectTimerRef.current);
      iceDisconnectTimerRef.current = null;
    }
    try {
      if (signalsRef.current && remoteUserIdRef.current) {
        signalsRef.current.send("bye", {
          target: remoteUserIdRef.current,
          sender: myUserIdRef.current,
        });
      }
      if (signalsRef.current) {
        await signalsRef.current.destroy();
        signalsRef.current = null;
      }
      if (myUserIdRef.current && roomId && !guestModeRef.current) {
        try {
          await upsertPresence({
            roomId,
            userId: myUserIdRef.current,
            role: "affirmative",
            isOnline: false,
          });
        } catch {
          /* ignore */
        }
      }
      peerRef.current?.close();
      peerRef.current = null;
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      remoteUserIdRef.current = null;
      setCameraReady(false);
      setMicEnabled(true);
      setVideoEnabled(true);
      setWebrtcStatus("Camera off");
    } finally {
      webrtcClosingRef.current = false;
    }
  }

  async function callLiveCheck(text: string): Promise<RefereeEvent[]> {
    if (!topic || !roomId) return [];
    try {
      const res = await fetch("/api/referee/live-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          speaker_id: "user",
          speaker_role: "affirmative",
          topic,
          text,
        }),
      });
      if (!res.ok) return [];
      const data: LiveCheckResponse = await res.json();
      return data.events ?? [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    return () => {
      if (iceDisconnectTimerRef.current !== null) {
        clearTimeout(iceDisconnectTimerRef.current);
        iceDisconnectTimerRef.current = null;
      }
      if (signalsRef.current) {
        void signalsRef.current.destroy();
        signalsRef.current = null;
      }
      peerRef.current?.close();
      peerRef.current = null;
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
    };
  }, []);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean || sending) return;

    setSending(true);
    setLog((current) => [...current, { type: "you", text: clean }]);
    setMessage("");

    const events = await callLiveCheck(clean);

    if (events.length > 0) {
      const feedback = events.map((e) => e.message).join(" ");
      setLog((current) => [...current, { type: "ai", text: feedback }]);
    } else {
      setLog((current) => [...current, { type: "ai", text: "Message recorded." }]);
    }

    setSending(false);
  }

  function leaveArenaHome() {
    void shutdownWebRtc();
    onLeave();
  }

  function OmegleLogLine({ item, index }: { item: ArenaLogEntry; index: number }) {
    if (item.type === "system") {
      return (
        <div key={index} className="msg-system">
          {item.text}
        </div>
      );
    }
    if (item.type === "spacer") {
      return <div key={index} className="pt-4" />;
    }
    if (item.type === "ai") {
      return (
        <div
          key={index}
          className="border border-zinc-400 bg-[#fff9e6] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] min-[480px]:p-3"
        >
          <span className="msg-ai">AI Referee:</span> {item.text}
        </div>
      );
    }
    if (item.type === "stranger") {
      return (
        <div key={index}>
          <span className="msg-stranger">Stranger:</span> {item.text}
        </div>
      );
    }
    return (
      <div key={index}>
        <span className="msg-you">You:</span> {item.text}
      </div>
    );
  }

  const metaLabel =
    "text-[0.6rem] font-bold uppercase tracking-[0.18em] min-[480px]:text-[0.65rem] min-[480px]:tracking-[0.2em]";

  /* Cap video tiles on wide layouts so 4:3 previews do not consume most of the viewport — chat needs flex room. */
  const videoShell =
    "relative flex w-full min-h-0 items-center justify-center overflow-hidden rounded-lg border min-[480px]:rounded-xl " +
    "h-[clamp(7.5rem,22svh,12rem)] max-h-[30svh] min-[520px]:aspect-[4/3] min-[520px]:h-auto min-[520px]:max-h-[min(40dvh,20rem)] min-[520px]:w-full";

  return (
    <div className="box-border flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f2f2f0] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] text-[#121212] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]">
      <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,1400px)] flex-1 flex-col gap-3 overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-1 sm:gap-4 sm:px-4 sm:pb-4 sm:pt-2 md:gap-5 md:px-6 lg:px-8 xl:max-w-[min(100%,92rem)] xl:px-10 2xl:px-12">
        {/* Top row: Stranger | You */}
        <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 min-[520px]:grid-cols-2 min-[520px]:gap-4 min-[520px]:content-start lg:gap-5">
          <div className={`${videoShell} relative border-black/10 bg-zinc-900`}>
            {searching ? (
              <SearchingOverlay onStop={onStop} />
            ) : !roomId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                  No stranger yet
                </p>
                <p className="text-[10px] text-zinc-700">Click Find Stranger to begin</p>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className={`pointer-events-none absolute bottom-2 left-0 right-0 text-center min-[480px]:bottom-4 ${metaLabel} text-white/50`}>
              Stranger
            </div>
          </div>

          <div className={`${videoShell} border-zinc-300 bg-zinc-200`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {!cameraReady ? (
              <div className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => void startCameraAndSync()}
                  className="rounded-md border border-zinc-500 bg-white/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700"
                >
                  Turn Camera On
                </button>
                <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600 min-[480px]:text-[10px]">
                  {webrtcStatus}
                </span>
              </div>
            ) : (
              <>
                <span className="absolute left-2 top-2 z-10 rounded bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {webrtcStatus}
                </span>
                <div className="absolute bottom-10 left-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 min-[520px]:bottom-11">
                  <button
                    type="button"
                    onClick={() => applyLocalVideoEnabled(!videoEnabled)}
                    aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
                    aria-pressed={videoEnabled}
                    className={
                      videoEnabled
                        ? "rounded border border-emerald-600/90 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-black/70 active:translate-y-px min-[480px]:px-2.5 min-[480px]:text-[10px]"
                        : "rounded border border-red-500/90 bg-red-950/65 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-50 shadow-sm hover:bg-red-950/85 active:translate-y-px min-[480px]:px-2.5 min-[480px]:text-[10px]"
                    }
                  >
                    Camera {videoEnabled ? "on" : "off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLocalMicEnabled(!micEnabled)}
                    aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
                    aria-pressed={micEnabled}
                    className={
                      micEnabled
                        ? "rounded border border-emerald-600/90 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-black/70 active:translate-y-px min-[480px]:px-2.5 min-[480px]:text-[10px]"
                        : "rounded border border-red-500/90 bg-red-950/65 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-50 shadow-sm hover:bg-red-950/85 active:translate-y-px min-[480px]:px-2.5 min-[480px]:text-[10px]"
                    }
                  >
                    Mic {micEnabled ? "on" : "off"}
                  </button>
                </div>
              </>
            )}
            <div className="pointer-events-none absolute inset-0 bg-black/10" aria-hidden>
            </div>
            <div className={`pointer-events-none absolute bottom-2 left-0 right-0 text-center min-[480px]:bottom-4 ${metaLabel} text-zinc-500`}>
              You
            </div>
          </div>
        </div>

        {/* Bottom row: full-width chat — flex-1 + min-h-0 so the log fills everything between videos and composer */}
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-md border-2 border-zinc-400 bg-zinc-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] min-[480px]:rounded-lg">
          <div className="flex shrink-0 flex-col gap-1 border-b-2 border-zinc-400 bg-gradient-to-b from-zinc-200 via-zinc-100 to-zinc-200 px-2 py-1.5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-2 min-[420px]:px-3 sm:py-2 md:px-4">
            <span className="text-[11px] font-semibold tracking-wide text-zinc-800 min-[480px]:text-xs">
              {searching ? (
                <span className="text-zinc-500">Searching for a stranger…</span>
              ) : !roomId ? (
                <span className="text-zinc-500">Press Find Stranger to start</span>
              ) : (
                <>
                  Session chat
                  <span className="ml-2 font-normal text-zinc-500">· AI moderator</span>
                </>
              )}
            </span>
            {!searching && !!roomId && (
              <button
                type="button"
                onClick={leaveArenaHome}
                className="self-start border border-transparent px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 underline decoration-zinc-400 underline-offset-2 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-800 min-[420px]:self-auto"
              >
                Leave arena
              </button>
            )}
          </div>

          <div className="custom-scroll omegle-log arena-chat-log min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#f0ece2] p-3 text-[13px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] min-[480px]:p-4 min-[480px]:text-[13px] md:p-5 lg:p-6">
            <div className="mx-auto max-w-[52rem] space-y-1.5 lg:max-w-none">
              {log.map((item, index) => (
                <OmegleLogLine key={`${item.type}-${index}`} item={item} index={index} />
              ))}
            </div>
          </div>

          <form
            onSubmit={searching || !roomId ? (e) => e.preventDefault() : sendMessage}
            className="arena-chat-composer shrink-0 border-t-2 border-zinc-400 bg-gradient-to-b from-zinc-200 to-zinc-300/95 p-2.5 min-[480px]:p-3 sm:p-4 md:p-5"
          >
            <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-2 min-[520px]:max-w-none min-[520px]:flex-row min-[520px]:items-stretch min-[520px]:gap-3 lg:max-w-none">
              {!searching && !roomId ? (
                /* Idle state — full-width Find Stranger button */
                <button
                  type="button"
                  onClick={goToNextStranger}
                  className="h-12 w-full border-2 border-t-orange-200 border-l-orange-200 border-r-orange-900 border-b-orange-900 bg-orange-600 font-mono text-sm font-bold uppercase tracking-widest text-white hover:bg-orange-500 active:border-t-orange-900 active:border-l-orange-900 active:border-r-orange-200 active:border-b-orange-200"
                >
                  Find Stranger
                </button>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={searching ? "Looking for a stranger…" : "Type your message..."}
                    disabled={searching}
                    rows={1}
                    className="min-h-[3rem] min-w-0 flex-1 resize-none border-2 border-t-zinc-500 border-l-zinc-500 border-r-white border-b-white bg-white px-3 py-2.5 font-mono text-sm leading-snug text-zinc-900 outline-none focus:border-t-zinc-600 focus:border-l-zinc-600 disabled:bg-zinc-100 disabled:text-zinc-400 min-[480px]:min-h-[3.5rem] min-[480px]:px-3.5 min-[480px]:py-3"
                  />
                  <div className="flex w-full gap-2 min-[520px]:w-auto min-[520px]:shrink-0">
                    {searching ? (
                      <button
                        type="button"
                        onClick={onStop}
                        className="h-11 min-w-0 flex-1 border-2 border-t-white border-l-white border-r-zinc-500 border-b-zinc-600 bg-zinc-200 font-mono text-sm font-bold text-red-700 hover:bg-red-50 active:border-t-zinc-500 active:border-l-zinc-500 active:border-r-white active:border-b-white min-[520px]:h-auto min-[520px]:min-h-[3.5rem] min-[520px]:flex-none min-[520px]:px-8"
                      >
                        Stop
                      </button>
                    ) : (
                      <>
                        <button
                          type="submit"
                          disabled={sending}
                          className="h-11 min-w-0 flex-1 border-2 border-t-white border-l-white border-r-zinc-500 border-b-zinc-600 bg-zinc-200 font-mono text-sm font-bold text-zinc-900 hover:bg-zinc-100 active:border-t-zinc-500 active:border-l-zinc-500 active:border-r-white active:border-b-white disabled:opacity-50 min-[520px]:h-auto min-[520px]:min-h-[3.5rem] min-[520px]:flex-none min-[520px]:px-6"
                        >
                          {sending ? "..." : "Send"}
                        </button>
                        <button
                          type="button"
                          onClick={goToNextStranger}
                          className="h-11 min-w-0 flex-1 border-2 border-t-orange-200 border-l-orange-200 border-r-orange-900 border-b-orange-900 bg-orange-600 px-4 font-mono text-sm font-bold text-white hover:bg-orange-500 active:border-t-orange-900 active:border-l-orange-900 active:border-r-orange-200 active:border-b-orange-200 min-[520px]:h-auto min-[520px]:min-h-[3.5rem] min-[520px]:flex-none min-[520px]:px-6"
                        >
                          Next
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type View = "landing" | "auth" | "onboarding" | "arena";

export default function DebatePlatformPreview() {
  const [view, setView] = useState<View>("landing");
  const [transitioning, setTransitioning] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [, setOnboardingComplete] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  /** true while the arena is polling for a match (Omegle "looking for stranger" state) */
  const [isSearching, setIsSearching] = useState(false);
  /** Each search effect mount bumps this so late async responses cannot flip us to "matched" from an old wave. */
  const matchmakingWaveRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let sub: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createSupabaseClient();
      void supabase.auth.getUser().then(({ data }) => {
        if (!mounted) return;
        setUserEmail(data.user?.email ?? null);
      });
      const authSub = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setUserEmail(session?.user?.email ?? null);
      });
      sub = authSub.data.subscription;
    } catch {
      if (mounted) setUserEmail(null);
    }

    return () => {
      mounted = false;
      sub?.unsubscribe();
    };
  }, []);

  const showAuth = (mode: "login" | "signup" = "login", message?: string) => {
    setAuthMode(mode);
    setAuthPrompt(message ?? null);
    setView("auth");
  };

  const checkOnboardingStatus = async (): Promise<boolean> => {
    try {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOnboardingComplete(false);
        return false;
      }
      const { count: tagCount, error: tagErr } = await supabase
        .from("political_tags")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      const { count: prefCount, error: prefErr } = await supabase
        .from("user_tag_preferences")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (prefErr) return false;
      const needed = tagErr || tagCount === null ? 5 : Math.max(tagCount ?? 1, 1);
      const complete = (prefCount ?? 0) >= needed;
      setOnboardingComplete(complete);
      return complete;
    } catch {
      return false;
    }
  };

  const handleAuthSuccess = async () => {
    setAuthPrompt(null);
    const done = await checkOnboardingStatus();
    setView(done ? "landing" : "onboarding");
  };

  const logout = () => {
    void (async () => {
      try {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
      } catch {
        // no-op
      }
    })();
  };

  const showLanding = () => {
    if (transitioning) return;
    void fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {});
    setTransitioning(true);
    window.setTimeout(() => {
      setView("landing");
      setIsSearching(false);
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  /** Enter arena immediately and start searching for a stranger. */
  const enterArena = (room?: LiveRoomCard) => {
    if (transitioning || view === "arena") return;
    void (async () => {
      const done = await checkOnboardingStatus();
      if (!userEmail) {
        showAuth("login", "Log in or sign up to join a debate.");
        return;
      }
      if (!done) {
        setView("onboarding");
        return;
      }
      if (room?.id) {
        setActiveRoomId(room.id);
        setActiveTopic(room.topic);
        setIsSearching(false);
      } else {
        setActiveRoomId("");
        setActiveTopic("");
        // Auto-start searching (Omegle-style: clicking "Start" immediately searches)
        setIsSearching(true);
      }
      setTransitioning(true);
      window.setTimeout(() => {
        setView("arena");
        window.setTimeout(() => setTransitioning(false), 420);
      }, 520);
    })();
  };

  /** Stop pairing but stay in the arena (idle state + Find Stranger). */
  const stopSearching = () => {
    void fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {});
    setIsSearching(false);
    setActiveRoomId("");
    setActiveTopic("");
  };

  /** "Next" / stranger left: POST /matchmaking/join closes the active room server-side (RLS blocks client writes). */
  const startNextStrangerMatch = () => {
    if (view !== "arena") return;
    setActiveRoomId("");
    setActiveTopic("");
    setIsSearching(true);
  };

  // Omegle-style searching: runs while arena is open and isSearching === true
  useEffect(() => {
    if (view !== "arena" || !isSearching) return;

    const wave = ++matchmakingWaveRef.current;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const stale = () => cancelled || matchmakingWaveRef.current !== wave;

    const applyMatched = (roomId: string, topic: string) => {
      if (stale()) return;
      setIsSearching(false);
      setActiveRoomId(roomId);
      setActiveTopic(topic);
    };

    const schedule = (fn: () => Promise<void>, ms: number) => {
      if (stale()) return;
      pollTimer = setTimeout(() => void fn(), ms);
    };

    const run = async () => {
      try {
        const joinRes = await fetch("/api/matchmaking/join", { method: "POST" });
        let joinBody: unknown;
        try {
          joinBody = await joinRes.json();
        } catch {
          joinBody = {};
        }
        if (stale()) return;

        const jd = joinBody as {
          matched?: unknown;
          room_id?: unknown;
          topic?: unknown;
          error?: unknown;
        };
        const joinFailed =
          !joinRes.ok ||
          (typeof jd.error === "string" && jd.error.length > 0);

        if (joinFailed) {
          schedule(run, 2600);
          return;
        }

        if (jd.matched === true && typeof jd.room_id === "string") {
          applyMatched(
            jd.room_id,
            typeof jd.topic === "string" ? jd.topic : "Open debate"
          );
          return;
        }

        const poll = async () => {
          if (stale()) return;
          try {
            const statusRes = await fetch("/api/matchmaking/status");
            let statusBody: unknown;
            try {
              statusBody = await statusRes.json();
            } catch {
              statusBody = {};
            }
            if (stale()) return;

            const sb = statusBody as {
              state?: unknown;
              room_id?: unknown;
              topic?: unknown;
              error?: unknown;
            };

            if (!statusRes.ok || typeof sb.error === "string") {
              schedule(poll, 2200);
              return;
            }

            if (sb.state === "matched" && typeof sb.room_id === "string") {
              applyMatched(
                sb.room_id,
                typeof sb.topic === "string" ? sb.topic : "Open debate"
              );
              return;
            }

            if (sb.state === "idle") {
              const rejoinRes = await fetch("/api/matchmaking/join", {
                method: "POST",
              });
              let rj: unknown;
              try {
                rj = await rejoinRes.json();
              } catch {
                rj = {};
              }
              if (stale()) return;
              const rjb = rj as {
                matched?: unknown;
                room_id?: unknown;
                topic?: unknown;
                error?: unknown;
              };
              const rejoinFailed =
                !rejoinRes.ok ||
                (typeof rjb.error === "string" && rjb.error.length > 0);
              if (
                !rejoinFailed &&
                rjb.matched === true &&
                typeof rjb.room_id === "string"
              ) {
                applyMatched(
                  rjb.room_id,
                  typeof rjb.topic === "string" ? rjb.topic : "Open debate"
                );
                return;
              }
            }

            schedule(poll, 1800);
          } catch {
            if (!stale()) schedule(poll, 3000);
          }
        };

        schedule(poll, 1200);
      } catch {
        if (!stale()) schedule(run, 2800);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      void fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {});
    };
  }, [view, isSearching]);

  if (view === "landing") {
    return (
      <main className="min-h-screen font-sans antialiased">
        <div
          className={`transition-all duration-500 ease-out ${transitioning ? "scale-[0.992] opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
        >
          <LandingHomeView
            onLogo={showLanding}
            onGoLive={enterArena}
            transitioning={transitioning}
            userEmail={userEmail}
            onRequestAuth={showAuth}
            onLogout={logout}
          />
        </div>
      </main>
    );
  }

  if (view === "auth") {
    return (
      <main className="min-h-screen font-sans antialiased">
        <AuthPageView
          mode={authMode}
          initialMessage={authPrompt}
          onBack={showLanding}
          onSuccess={handleAuthSuccess}
        />
      </main>
    );
  }

  if (view === "onboarding") {
    return (
      <main className="min-h-screen font-sans antialiased">
        <OnboardingTagsView onBack={showLanding} onComplete={() => setView("landing")} />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f4] font-sans text-[#121212] antialiased">
      <div
        className={`transition-all duration-500 ease-out ${transitioning ? "scale-[0.992] opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
      >
        <ArenaView
          key={isSearching ? "searching" : activeRoomId || "arena"}
          onLeave={showLanding}
          onNextStranger={startNextStrangerMatch}
          onStop={stopSearching}
          roomId={activeRoomId}
          topic={activeTopic}
          searching={isSearching}
        />
      </div>
    </main>
  );
}
