"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LiveCheckResponse, FinalScoreResponse, RefereeEvent } from "@/lib/referee/types";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  createDebatePeerConnection,
  attachLocalMedia,
  stopMediaStream,
} from "@/lib/webrtc/peer";
import {
  sendSignal,
  subscribeSignals,
  unsubscribeSignals,
  upsertPresence,
} from "@/lib/webrtc/signaling";

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

function ArenaGlyph() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center rounded-md border border-white/25">
      <span className="absolute h-3 w-3 rounded-sm border border-white/70" />
      <span className="absolute h-3 w-3 rotate-45 rounded-sm border border-white/35" />
    </span>
  );
}

function BoltGlyph() {
  return (
    <span className="text-[15px] leading-none text-[#ff4d00] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
      ↯
    </span>
  );
}

function FlagGlyph() {
  return <span className="text-[13px] text-zinc-400">⚑</span>;
}

function ArrowGlyph({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      className={`ml-2 text-[16px] leading-none transition-transform duration-300 group-hover:translate-x-0.5 ${tone === "dark" ? "text-zinc-500" : "text-white/70"}`}
    >
      →
    </span>
  );
}

type BrandVariant = "dark" | "hero" | "nav" | "light" | "cancel" | "terminate" | "send" | "ghost";

function BrandButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "dark",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: BrandVariant;
  className?: string;
}) {
  const base =
    "group inline-flex items-center justify-center whitespace-nowrap font-bold transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-60";

  const variants: Record<BrandVariant, string> = {
    dark:
      "relative overflow-hidden rounded-[20px] border border-black/90 bg-[linear-gradient(135deg,#191919,#060606)] text-white shadow-[0_18px_45px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:shadow-[0_24px_52px_-20px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16)] active:translate-y-0",
    hero:
      "relative overflow-hidden rounded-[20px] border border-black/90 bg-[linear-gradient(135deg,#191919,#060606)] text-white shadow-[0_18px_45px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:shadow-[0_24px_52px_-20px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16)] active:translate-y-0",
    nav:
      "rounded-full border border-black/90 bg-[#111] text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#ff4d00] hover:border-[#ff4d00] active:scale-[0.98]",
    light:
      "rounded-[18px] border border-black/10 bg-white/95 text-[#1a1a1a] shadow-[0_8px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] hover:-translate-y-px hover:border-black/20 hover:bg-white active:translate-y-0",
    cancel:
      "rounded-none border-b border-transparent bg-transparent text-zinc-300 hover:border-red-400 hover:text-red-500",
    terminate:
      "rounded-[16px] border border-zinc-200 bg-white text-zinc-400 shadow-[0_8px_22px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] hover:-translate-y-px hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:translate-y-0",
    send:
      "rounded-[14px] border border-zinc-300 bg-[linear-gradient(180deg,#f8f8f8,#e6e6e8)] text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_14px_-10px_rgba(0,0,0,0.65)] hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-200 active:translate-y-0",
    ghost:
      "rounded-full border border-zinc-200/80 bg-white/50 text-zinc-600 shadow-none backdrop-blur-sm hover:bg-white hover:border-zinc-300 active:scale-[0.98]",
  };

  const content: Record<BrandVariant, React.ReactNode> = {
    hero: (
      <>
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        <ArenaGlyph />
        <span>{children}</span>
        <ArrowGlyph />
      </>
    ),
    nav: (
      <>
        <BoltGlyph />
        <span>{children}</span>
      </>
    ),
    cancel: <span>{children}</span>,
    terminate: (
      <>
        <FlagGlyph />
        <span>{children}</span>
      </>
    ),
    send: (
      <>
        <span>{children}</span>
        <ArrowGlyph tone="dark" />
      </>
    ),
    light: <span>{children}</span>,
    dark: <span>{children}</span>,
    ghost: <span>{children}</span>,
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {content[variant]}
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

function MatchmakingView({
  onCancel,
  found,
  statusText,
}: {
  onCancel: () => void;
  found: boolean;
  statusText: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] px-6 py-16">
      <div
        className={`flex w-full max-w-md flex-col items-center text-center transition-all duration-700 ease-out ${found ? "scale-[0.99] opacity-85" : "scale-100 opacity-100"}`}
      >
        <div className="relative mb-10 flex h-44 w-44 items-center justify-center">
          <div
            className="absolute inset-[5%] rounded-[35%] bg-[radial-gradient(circle_at_50%_45%,rgba(255,77,0,0.38),transparent_62%)] blur-2xl animate-matchmaking-aura"
            aria-hidden
          />
          <LogoMark pulsing size="large" />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          {found ? "Ready" : "Matching"}
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#121212] sm:text-[1.65rem]">
          {found ? "Opponent matched" : "Finding your rival"}
        </h2>

        <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-zinc-500">
          {statusText}
        </p>

        <BrandButton
          onClick={onCancel}
          variant="ghost"
          className="mt-14 min-h-[42px] rounded-full px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-800"
        >
          Cancel
        </BrandButton>
      </div>
    </div>
  );
}

type ArenaLogEntry =
  | { type: "system"; text: string }
  | { type: "spacer" }
  | { type: "stranger" | "you" | "ai"; text: string };

const DEFAULT_ARENA_LOG: ArenaLogEntry[] = [];

function ArenaView({
  onLeave,
  onNextStranger,
  roomId,
  topic,
}: {
  onLeave: () => void;
  /** Omegle-style: disconnect and search for a new opponent with the same topic. */
  onNextStranger: (roomId: string) => void;
  roomId: string;
  topic: string;
}) {
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<ArenaLogEntry[]>(() => [...DEFAULT_ARENA_LOG]);
  const [sending, setSending] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState("Camera off");
  const [myUserId, setMyUserId] = useState("");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalsRef = useRef<{
    supabase: ReturnType<typeof createSupabaseClient>;
    channel: ReturnType<typeof subscribeSignals>["channel"];
  } | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  function goToNextStranger() {
    void shutdownWebRtc();
    setMessage("");
    setLog([...DEFAULT_ARENA_LOG]);
    onNextStranger(roomId);
  }

  async function startCameraAndSync() {
    if (cameraReady) return;
    if (!roomId) {
      setWebrtcStatus("Room not ready");
      return;
    }
    if (!localVideoRef.current || !remoteVideoRef.current) {
      setWebrtcStatus("Video elements not ready");
      return;
    }

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      const userId =
        !error && data.user
          ? data.user.id
          : `guest_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
      setMyUserId(userId);
      const isGuest = !data.user;
      setGuestMode(isGuest);

      const peer = createDebatePeerConnection();
      peerRef.current = peer;
      localStreamRef.current = await attachLocalMedia(peer, localVideoRef.current);
      peer.ontrack = (event) => {
        const incoming = event.streams[0];
        if (!incoming || !remoteVideoRef.current) return;

        // Safety guard: never render our own local stream in Stranger tile.
        if (localStreamRef.current && incoming.id === localStreamRef.current.id) {
          setWebrtcStatus("Ignoring self-stream in remote tile");
          return;
        }

        remoteVideoRef.current.srcObject = incoming;
      };
      setCameraReady(true);
      setWebrtcStatus("Camera on");

      if (!isGuest) {
        await upsertPresence({
          roomId,
          userId,
          role: "affirmative",
          isOnline: true,
        });
      }

      peer.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          if (isGuest && broadcastRef.current) {
            broadcastRef.current.postMessage({
              roomId,
              senderUserId: userId,
              targetUserId: remoteUserId,
              signal_type: "ice_candidate",
              payload: event.candidate.toJSON(),
            });
          } else {
            await sendSignal({
              roomId,
              senderUserId: userId,
              targetUserId: remoteUserId,
              signalType: "ice_candidate",
              payload: event.candidate.toJSON() as Record<string, unknown>,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setWebrtcStatus(`ICE sync error: ${msg}`);
        }
      };
      const handleSignal = async (signal: {
        sender_user_id: string;
        target_user_id?: string | null;
        signal_type: "offer" | "answer" | "ice_candidate" | "bye";
        payload: Record<string, unknown>;
      }) => {
        try {
          if (signal.sender_user_id === userId) return;
          if (signal.target_user_id && signal.target_user_id !== userId) return;

          if (signal.signal_type === "offer") {
            setRemoteUserId(signal.sender_user_id);
            await peer.setRemoteDescription(
              new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit)
            );
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            if (isGuest && broadcastRef.current) {
              broadcastRef.current.postMessage({
                roomId,
                senderUserId: userId,
                targetUserId: signal.sender_user_id,
                signal_type: "answer",
                payload: answer,
              });
            } else {
              await sendSignal({
                roomId,
                senderUserId: userId,
                targetUserId: signal.sender_user_id,
                signalType: "answer",
                payload: answer as unknown as Record<string, unknown>,
              });
            }
            setWebrtcStatus("Connected");
          } else if (signal.signal_type === "answer") {
            await peer.setRemoteDescription(
              new RTCSessionDescription(signal.payload as unknown as RTCSessionDescriptionInit)
            );
            setWebrtcStatus("Connected");
          } else if (signal.signal_type === "ice_candidate") {
            await peer.addIceCandidate(
              new RTCIceCandidate(signal.payload as unknown as RTCIceCandidateInit)
            );
          } else if (signal.signal_type === "bye") {
            setWebrtcStatus("Peer disconnected");
          } else {
            setWebrtcStatus("Unknown signal received");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setWebrtcStatus(`Signal error: ${msg}`);
        }
      };

      if (isGuest) {
        const bc = new BroadcastChannel(`debate-webrtc-${roomId}`);
        broadcastRef.current = bc;
        bc.onmessage = (event: MessageEvent) => {
          const msg = event.data as {
            roomId: string;
            senderUserId: string;
            targetUserId?: string | null;
            signal_type: "offer" | "answer" | "ice_candidate" | "bye" | "hello";
            payload?: Record<string, unknown>;
          };
          if (!msg || msg.roomId !== roomId || msg.senderUserId === userId) return;
          if (msg.signal_type === "hello") {
            setRemoteUserId(msg.senderUserId);
            if (userId < msg.senderUserId) {
              void (async () => {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                bc.postMessage({
                  roomId,
                  senderUserId: userId,
                  targetUserId: msg.senderUserId,
                  signal_type: "offer",
                  payload: offer,
                });
                setWebrtcStatus("Calling peer...");
              })();
            }
            return;
          }
          if (!msg.payload) return;
          void handleSignal({
            sender_user_id: msg.senderUserId,
            target_user_id: msg.targetUserId ?? null,
            signal_type: msg.signal_type,
            payload: msg.payload,
          });
        };
        bc.postMessage({ roomId, senderUserId: userId, signal_type: "hello" });
        setWebrtcStatus("Guest mode: waiting for peer...");
      } else {
        signalsRef.current = subscribeSignals(roomId, (signal) => {
          void handleSignal(signal);
        });

        const { data: others } = await supabase
          .from("room_presence")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("is_online", true)
          .neq("user_id", userId)
          .order("joined_at", { ascending: true })
          .limit(1);

        const otherUserId = others?.[0]?.user_id as string | undefined;
        if (otherUserId) {
          setRemoteUserId(otherUserId);
          const iAmCaller = userId < otherUserId;
          if (iAmCaller) {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            await sendSignal({
              roomId,
              senderUserId: userId,
              targetUserId: otherUserId,
              signalType: "offer",
              payload: offer as unknown as Record<string, unknown>,
            });
            setWebrtcStatus("Calling peer...");
          } else {
            setWebrtcStatus("Waiting for offer...");
          }
        } else {
          setWebrtcStatus("Waiting for peer...");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWebrtcStatus(`Failed to start camera/sync: ${msg}`);
    }
  }

  async function shutdownWebRtc() {
    if (signalsRef.current) {
      await unsubscribeSignals(signalsRef.current.supabase, signalsRef.current.channel);
      signalsRef.current = null;
    }
    if (broadcastRef.current) {
      broadcastRef.current.close();
      broadcastRef.current = null;
    }
    if (myUserId && roomId) {
      if (!guestMode) {
        try {
          await upsertPresence({
            roomId,
            userId: myUserId,
            role: "affirmative",
            isOnline: false,
          });
        } catch {
          // ignore
        }
      }
    }
    peerRef.current?.close();
    peerRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCameraReady(false);
    setWebrtcStatus("Camera off");
    setRemoteUserId(null);
    setGuestMode(false);
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
      if (signalsRef.current) {
        void unsubscribeSignals(signalsRef.current.supabase, signalsRef.current.channel);
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

  async function endDebate() {
    if (scoring) return;
    if (!topic || !roomId) {
      setLog((current) => [...current, { type: "system", text: "Missing room metadata. Start from a live room first." }]);
      return;
    }
    setScoring(true);

    setLog((current) => [...current, { type: "system", text: "Requesting final score from AI referee..." }]);

    const affirmative = log
      .filter((e) => e.type === "you")
      .map((e) => (e as { text: string }).text)
      .join("\n\n");
    const negative = log
      .filter((e) => e.type === "stranger")
      .map((e) => (e as { text: string }).text)
      .join("\n\n");

    try {
      const res = await fetch("/api/referee/final-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          topic,
          affirmative_transcript: affirmative,
          negative_transcript: negative,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLog((current) => [
          ...current,
          { type: "system", text: `Scoring failed: ${err.error || "Unknown error"}` },
        ]);
      } else {
        const data: FinalScoreResponse = await res.json();
        const r = data.result;
        setLog((current) => [
          ...current,
          { type: "spacer" },
          { type: "system", text: `Final verdict: ${r.winner_recommendation.toUpperCase()} (confidence ${Math.round(r.confidence * 100)}%)` },
          { type: "ai", text: `You: ${r.affirmative.total} pts | Stranger: ${r.negative.total} pts` },
          { type: "ai", text: r.summary },
        ]);
      }
    } catch {
      setLog((current) => [...current, { type: "system", text: "Failed to reach AI referee." }]);
    }

    setScoring(false);
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
        {/* Top row: Stranger | You — stack until ~520px, then two columns (height-capped so chat stays tall). */}
        <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 min-[520px]:grid-cols-2 min-[520px]:gap-4 min-[520px]:content-start lg:gap-5">
          <div className={`${videoShell} border-black/10 bg-zinc-900`}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
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
              <span className="absolute left-2 top-2 z-10 rounded bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">
                {webrtcStatus}
              </span>
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
              Session chat
              <span className="ml-2 font-normal text-zinc-500">· AI moderator</span>
            </span>
            <div className="flex items-center gap-3 self-start min-[420px]:self-auto">
              <button
                type="button"
                onClick={endDebate}
                disabled={scoring}
                className="border border-transparent px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-orange-700 underline decoration-orange-400 underline-offset-2 hover:border-orange-400 hover:bg-orange-100/80 disabled:opacity-50"
              >
                {scoring ? "Scoring..." : "End Debate"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void shutdownWebRtc();
                  onLeave();
                }}
                className="border border-transparent px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 underline decoration-zinc-400 underline-offset-2 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-red-700"
              >
                Disconnect
              </button>
            </div>
          </div>

          <div className="custom-scroll omegle-log arena-chat-log min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#f0ece2] p-3 text-[13px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] min-[480px]:p-4 min-[480px]:text-[13px] md:p-5 lg:p-6">
            <div className="mx-auto max-w-[52rem] space-y-1.5 lg:max-w-none">
              {log.map((item, index) => (
                <OmegleLogLine key={`${item.type}-${index}`} item={item} index={index} />
              ))}
            </div>
          </div>

          <form
            onSubmit={sendMessage}
            className="arena-chat-composer shrink-0 border-t-2 border-zinc-400 bg-gradient-to-b from-zinc-200 to-zinc-300/95 p-2.5 min-[480px]:p-3 sm:p-4 md:p-5"
          >
            <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-2 min-[520px]:max-w-none min-[520px]:flex-row min-[520px]:items-stretch min-[520px]:gap-3 lg:max-w-none">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type your message..."
                rows={1}
                className="min-h-[3rem] min-w-0 flex-1 resize-none border-2 border-t-zinc-500 border-l-zinc-500 border-r-white border-b-white bg-white px-3 py-2.5 font-mono text-sm leading-snug text-zinc-900 outline-none focus:border-t-zinc-600 focus:border-l-zinc-600 min-[480px]:min-h-[3.5rem] min-[480px]:px-3.5 min-[480px]:py-3"
              />
              <div className="flex w-full gap-2 min-[520px]:w-auto min-[520px]:shrink-0">
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
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type View = "landing" | "auth" | "onboarding" | "matchmaking" | "arena";

export default function DebatePlatformPreview() {
  const [view, setView] = useState<View>("landing");
  const [transitioning, setTransitioning] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [, setOnboardingComplete] = useState(false);
  const [pendingTopic, setPendingTopic] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [matchmakingFound, setMatchmakingFound] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Waiting for a stranger...");

  const matchmakingChannelRef = useRef<RealtimeChannel | null>(null);
  const createdWaitingRoomRef = useRef<string | null>(null);
  const guestMatchTimersRef = useRef<number[]>([]);

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

  const cleanupMatchmaking = async () => {
    const roomId = createdWaitingRoomRef.current;
    createdWaitingRoomRef.current = null;

    if (matchmakingChannelRef.current) {
      const supabase = createSupabaseClient();
      await supabase.removeChannel(matchmakingChannelRef.current);
      matchmakingChannelRef.current = null;
    }

    if (roomId) {
      try {
        const supabase = createSupabaseClient();
        await supabase
          .from("debate_rooms")
          .update({ status: "cancelled", ended_at: new Date().toISOString() })
          .eq("id", roomId)
          .eq("status", "waiting");
      } catch {
        // ignore cleanup errors
      }
    }
  };

  const showLanding = () => {
    if (transitioning) return;
    void cleanupMatchmaking();
    setTransitioning(true);
    window.setTimeout(() => {
      setView("landing");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  const showMatchmaking = (room?: LiveRoomCard) => {
    if (transitioning || view === "matchmaking" || view === "arena") return;
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

      setPendingTopic(room?.topic ?? "");
      setMatchmakingFound(false);
      setMatchmakingStatus("Waiting for a stranger...");
      setTransitioning(true);
      window.setTimeout(() => {
        setView("matchmaking");
        window.setTimeout(() => setTransitioning(false), 420);
      }, 520);
    })();
  };

  /** From arena "Next" — same topic, new random match (Omegle-style). */
  const startNextStrangerMatch = (endedRoomId: string) => {
    if (transitioning || view !== "arena") return;
    void (async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && endedRoomId) {
          await supabase
            .from("debate_rooms")
            .update({ status: "completed", ended_at: new Date().toISOString() })
            .eq("id", endedRoomId);
        }
      } catch {
        // best-effort; RLS or guest mode may skip
      }
    })();
    void cleanupMatchmaking();
    setPendingTopic(activeTopic || pendingTopic || "");
    setMatchmakingFound(false);
    setMatchmakingStatus("Looking for someone new...");
    setTransitioning(true);
    window.setTimeout(() => {
      setView("matchmaking");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  const showArena = (roomId: string, topic: string) => {
    createdWaitingRoomRef.current = null;
    setActiveRoomId(roomId);
    setActiveTopic(topic);
    setTransitioning(true);
    window.setTimeout(() => {
      setView("arena");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  useEffect(() => {
    if (view !== "matchmaking") return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    guestMatchTimersRef.current = [];

    const runMatchmaking = async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setMatchmakingStatus("Please log in to start matchmaking.");
          window.setTimeout(() => {
            if (!cancelled) {
              setAuthMode("login");
              setAuthPrompt("Please log in to start matchmaking.");
              setView("auth");
              setTransitioning(false);
            }
          }, 450);
          return;
        }

        setMatchmakingStatus("Joining matchmaking queue...");

        const joinRes = await fetch("/api/matchmaking/join", { method: "POST" });
        const joinData = await joinRes.json();

        if (cancelled) return;

        if (joinData.error) {
          setMatchmakingStatus(joinData.error);
          return;
        }

        if (joinData.matched && joinData.room_id) {
          setMatchmakingFound(true);
          setMatchmakingStatus("Match found. Entering arena...");
          window.setTimeout(() => {
            if (!cancelled) showArena(joinData.room_id, joinData.topic || "Open debate");
          }, 700);
          return;
        }

        setMatchmakingStatus(joinData.reason || "Waiting for opponent...");

        // Poll the status endpoint (read-only, no side effects) until matched
        const pollStatus = async () => {
          if (cancelled) return;

          try {
            const statusRes = await fetch("/api/matchmaking/status");
            const statusData = await statusRes.json();

            if (cancelled) return;

            if (statusData.state === "matched" && statusData.room_id) {
              setMatchmakingFound(true);
              setMatchmakingStatus("Match found. Entering arena...");
              window.setTimeout(() => {
                if (!cancelled) showArena(statusData.room_id, statusData.topic || "Open debate");
              }, 700);
              return;
            }

            if (statusData.state === "idle") {
              // Fell out of queue without a match — re-join once
              const rejoinRes = await fetch("/api/matchmaking/join", { method: "POST" });
              const rejoinData = await rejoinRes.json();
              if (rejoinData.matched && rejoinData.room_id) {
                setMatchmakingFound(true);
                setMatchmakingStatus("Match found. Entering arena...");
                window.setTimeout(() => {
                  if (!cancelled) showArena(rejoinData.room_id, rejoinData.topic || "Open debate");
                }, 700);
                return;
              }
            }

            pollTimer = setTimeout(pollStatus, 2000);
          } catch {
            if (!cancelled) {
              pollTimer = setTimeout(pollStatus, 3000);
            }
          }
        };

        pollTimer = setTimeout(pollStatus, 1500);
      } catch {
        setMatchmakingStatus("Matchmaking unavailable. Try again.");
      }
    };

    void runMatchmaking();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      guestMatchTimersRef.current.forEach((id) => window.clearTimeout(id));
      guestMatchTimersRef.current = [];
      void (async () => {
        try {
          await fetch("/api/matchmaking/leave", { method: "POST" });
        } catch {
          // ignore
        }
      })();
      void cleanupMatchmaking();
    };
  }, [view, pendingTopic]);

  if (view === "landing") {
    return (
      <main className="min-h-screen font-sans antialiased">
        <div
          className={`transition-all duration-500 ease-out ${transitioning ? "scale-[0.992] opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
        >
          <LandingHomeView
            onLogo={showLanding}
            onGoLive={showMatchmaking}
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
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-[#f8f7f4]/95 backdrop-blur-[20px] will-change-transform">
        <div className="mx-auto grid max-w-7xl grid-cols-[340px_1fr_220px] items-center px-6 py-4">
          <LogoButton onClick={showLanding} spinning={transitioning} />
          <div />
          <div className="flex items-center justify-end gap-6">
            {view === "matchmaking" ? (
              <StartSessionButton onClick={showMatchmaking} transitioning={transitioning} />
            ) : null}
          </div>
        </div>
      </nav>

      <div
        className={`transition-all duration-500 ease-out ${transitioning ? "scale-[0.992] opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
      >
        {view === "arena" ? (
          <ArenaView
            key={activeRoomId || "arena"}
            onLeave={showLanding}
            onNextStranger={startNextStrangerMatch}
            roomId={activeRoomId}
            topic={activeTopic}
          />
        ) : (
          <MatchmakingView onCancel={showLanding} found={matchmakingFound} statusText={matchmakingStatus} />
        )}
      </div>
    </main>
  );
}
