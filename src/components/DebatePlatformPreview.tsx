"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";

type LogoMarkProps = { spinning?: boolean; size?: "nav" | "large" };

/** TV mark — same asset as welcome hero (`public/debate-room-welcome-mark.png`). */
function LogoMark({ spinning = false, size = "nav" }: LogoMarkProps) {
  const markSize = size === "large" ? "h-20 w-20" : "h-10 w-10";

  return (
    <div
      className={`relative shrink-0 bg-transparent transition-transform duration-500 ease-out group-hover:scale-[1.02] hover:scale-[1.02] ${markSize} ${
        spinning ? "animate-spin" : ""
      }`}
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

/** Black pill CTA — matches product nav / reference styling. */
function StartSessionButton({
  onClick,
  transitioning,
}: {
  onClick: () => void;
  transitioning: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={transitioning}
      className="rounded-full bg-black px-8 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {transitioning ? "Searching..." : "Start Session"}
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

const landingLiveChannels: { title: string; spectating: string }[] = [
  { title: "Politics: Midterms", spectating: "12.4k watching" },
  { title: "AI Ethics 1v1", spectating: "8.1k watching" },
  { title: "Space Exploration", spectating: "5.3k watching" },
];

const landingTopicPills = ["Tech", "Climate", "Philosophy", "Gaming", "Policy", "Ethics"];

const landingLiveGrid: {
  title: string;
  referee: string;
  tags: [string, string];
  viewers: string;
}[] = [
  {
    title: "Copyright in the Generative Era",
    referee: "Referee #902",
    tags: ["Law", "Tech"],
    viewers: "1.4k viewers",
  },
  {
    title: "Nuclear Power: The Path to Net Zero?",
    referee: "Physics Mod Alpha",
    tags: ["Climate", "Energy"],
    viewers: "842 viewers",
  },
  {
    title: "Social Media Bans for Minors",
    referee: "Social Arbiter",
    tags: ["Society", "Youth"],
    viewers: "3.1k viewers",
  },
];

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
}: {
  onLogo: () => void;
  onGoLive: () => void;
  transitioning: boolean;
}) {
  const disabled = transitioning;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 antialiased">
      <nav className="glass-nav fixed left-0 right-0 top-0 z-50 h-[70px] border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-full max-w-full items-center justify-between gap-3 px-4 sm:px-6">
          <LogoButton onClick={onLogo} spinning={transitioning} variant="landing" />

          <div className="flex shrink-0 items-center gap-3 sm:gap-6">
            <StartSessionButton onClick={onGoLive} transitioning={transitioning} />
            <div
              className="hidden h-9 w-9 shrink-0 rounded-full border border-gray-300 bg-gray-200 sm:block"
              aria-hidden
            />
          </div>
        </div>
      </nav>

      <aside className="sidebar fixed bottom-0 left-0 top-[70px] z-40 flex w-[260px] flex-col overflow-hidden border-r border-gray-200 bg-white pl-0 pr-4 max-lg:w-[70px] max-lg:px-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8">
          <p className="sidebar-text mb-4 shrink-0 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 max-lg:hidden">
            Live channels
          </p>
          <nav aria-label="Live channels" className="flex flex-col">
            {landingLiveChannels.map((ch) => (
              <button
                key={ch.title}
                type="button"
                className="group flex w-full items-center gap-0 text-left transition-colors hover:bg-gray-50 max-lg:justify-center max-lg:py-3 lg:min-h-[4.25rem] lg:border-b lg:border-gray-100 lg:last:border-b-0"
              >
                <span
                  className="hidden h-2 w-2 shrink-0 rounded-full bg-red-500 max-lg:block"
                  aria-hidden
                />
                <div className="sidebar-text flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 max-lg:hidden">
                  <span className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-gray-950">
                    {ch.title}
                  </span>
                  <span className="text-xs text-gray-500">{ch.spectating}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-text mt-auto shrink-0 border-t border-gray-100 pb-8 pt-6 max-lg:hidden">
          <p className="mb-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            Topics
          </p>
          <div className="flex flex-wrap gap-2 px-4">
            {landingTopicPills.map((topic) => (
              <span
                key={topic}
                className="rounded-lg bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600"
              >
                {topic}
              </span>
            ))}
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

        <section className="px-6 pb-12 sm:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black tracking-tight text-gray-500 uppercase italic">Live discussions</h2>
            <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:gap-6">
              <button type="button" className="border-b-2 border-orange-600 pb-1 text-orange-600">
                All arena
              </button>
              <button type="button" className="pb-1 text-gray-400 transition-colors hover:text-orange-600">
                Verified only
              </button>
              <button type="button" className="pb-1 text-gray-400 transition-colors hover:text-orange-600">
                High stakes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {landingLiveGrid.map((card) => (
              <div
                key={card.title}
                role="button"
                tabIndex={0}
                onClick={disabled ? undefined : onGoLive}
                onKeyDown={
                  disabled
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onGoLive();
                        }
                      }
                }
                className={`overflow-hidden rounded-2xl border border-gray-200 bg-white ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
              >
                <div className="relative aspect-video overflow-hidden bg-gray-50">
                  <div className="absolute left-3 top-3 z-10 rounded bg-red-500 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                    Live
                  </div>
                  <div className="absolute bottom-3 left-3 z-10 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {card.viewers}
                  </div>
                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                    <PlaceholderPlayGlyph />
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <h3 className="text-base font-bold leading-snug text-gray-900">{card.title}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.referee}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MatchmakingView({ onCancel, onMatched }: { onCancel: () => void; onMatched: () => void }) {
  const [found, setFound] = useState(false);

  useEffect(() => {
    const foundTimer = window.setTimeout(() => setFound(true), 3000);
    const matchTimer = window.setTimeout(onMatched, 4300);

    return () => {
      window.clearTimeout(foundTimer);
      window.clearTimeout(matchTimer);
    };
  }, [onMatched]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#f8f7f4] px-6">
      <div
        className={`flex flex-col items-center text-center transition-all duration-700 ease-out ${found ? "scale-[0.98] opacity-80" : "scale-100 opacity-100"}`}
      >
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#ff4d00]/10 blur-2xl" />
          <div className="absolute h-32 w-32 animate-spin rounded-full border border-[#ff4d00]/20 border-t-[#ff4d00]" />
          <div className="absolute h-24 w-24 animate-pulse rounded-full border border-black/10 border-b-black/30" />
          <LogoMark spinning size="large" />
        </div>

        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 w-1.5 animate-ping rounded-full bg-[#ff4d00]" />
          <h2 className="text-lg font-black uppercase tracking-[0.2em]">{found ? "Match Found" : "Searching"}</h2>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {found ? "Preparing the arena..." : "Waiting for a stranger..."}
        </p>

        <BrandButton
          onClick={onCancel}
          variant="ghost"
          className="mt-12 min-h-[40px] px-4 text-[10px] tracking-widest"
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

const DEFAULT_ARENA_LOG: ArenaLogEntry[] = [
  { type: "system", text: "You are now debating with a random stranger. Say hi!" },
  { type: "system", text: "AI Referee is keeping tabs. Topic: Intellectual Property." },
  { type: "spacer" },
  {
    type: "stranger",
    text: "AI is just a tool, like a brush. The artist who uses the prompt should own the final piece.",
  },
  {
    type: "you",
    text: "But a brush doesn't have its own training data sourced from billions of human works. The machine is doing the heavy lifting.",
  },
  { type: "spacer" },
  { type: "ai", text: "Both sides are clear. Stranger needs limits. You need an example." },
];

function ArenaView({ onLeave }: { onLeave: () => void }) {
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<ArenaLogEntry[]>(() => [...DEFAULT_ARENA_LOG]);

  function goToNextStranger() {
    setMessage("");
    setLog([...DEFAULT_ARENA_LOG]);
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;

    setLog((current) => [
      ...current,
      { type: "you", text: clean },
      { type: "ai", text: "Claim logged. Add evidence or a concrete example next." },
    ]);
    setMessage("");
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
            <div className={`pointer-events-none absolute bottom-2 left-0 right-0 text-center min-[480px]:bottom-4 ${metaLabel} text-white/50`}>
              Stranger
            </div>
          </div>

          <div className={`${videoShell} border-zinc-300 bg-zinc-200`}>
            <div className="flex flex-col items-center opacity-30">
              <div className="mb-1.5 h-9 w-9 rounded-full border-2 border-zinc-400 min-[480px]:mb-2 min-[480px]:h-12 min-[480px]:w-12" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 min-[480px]:text-[10px]">
                Camera On
              </span>
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
            <button
              type="button"
              onClick={onLeave}
              className="self-start border border-transparent px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 underline decoration-zinc-400 underline-offset-2 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-red-700 min-[420px]:self-auto"
            >
              Disconnect
            </button>
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
                  className="h-11 min-w-0 flex-1 border-2 border-t-white border-l-white border-r-zinc-500 border-b-zinc-600 bg-zinc-200 font-mono text-sm font-bold text-zinc-900 hover:bg-zinc-100 active:border-t-zinc-500 active:border-l-zinc-500 active:border-r-white active:border-b-white min-[520px]:h-auto min-[520px]:min-h-[3.5rem] min-[520px]:flex-none min-[520px]:px-6"
                >
                  Send
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

type View = "landing" | "matchmaking" | "arena";

export default function DebatePlatformPreview() {
  const [view, setView] = useState<View>("landing");
  const [transitioning, setTransitioning] = useState(false);

  const showLanding = () => {
    if (transitioning) return;
    setTransitioning(true);
    window.setTimeout(() => {
      setView("landing");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  const showMatchmaking = () => {
    if (transitioning || view === "matchmaking" || view === "arena") return;
    setTransitioning(true);
    window.setTimeout(() => {
      setView("matchmaking");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  const showArena = () => {
    setTransitioning(true);
    window.setTimeout(() => {
      setView("arena");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
  };

  if (view === "landing") {
    return (
      <main className="min-h-screen font-sans antialiased">
        <div
          className={`transition-all duration-500 ease-out ${transitioning ? "scale-[0.992] opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
        >
          <LandingHomeView onLogo={showLanding} onGoLive={showMatchmaking} transitioning={transitioning} />
        </div>
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
          <ArenaView onLeave={showLanding} />
        ) : (
          <MatchmakingView onCancel={showLanding} onMatched={showArena} />
        )}
      </div>
    </main>
  );
}
