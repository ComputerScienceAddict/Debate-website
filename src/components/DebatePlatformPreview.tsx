"use client";

import Image from "next/image";
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

type LiveRoomCard = {
  id: string;
  title: string;
  topic: string;
  referee: string;
  viewers: number;
  tags: string[];
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
}: {
  onLogo: () => void;
  onGoLive: (room?: LiveRoomCard) => void;
  transitioning: boolean;
}) {
  const disabled = transitioning;
  const [liveRooms, setLiveRooms] = useState<LiveRoomCard[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

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

  const liveChannels = liveRooms.slice(0, 6).map((room) => ({
    id: room.id,
    title: room.title,
    spectating: `${room.viewers} watching`,
  }));

  const topicPills = Array.from(new Set(liveRooms.map((room) => room.topic))).slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 antialiased">
      <nav className="glass-nav fixed left-0 right-0 top-0 z-50 h-[70px] border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-full max-w-full items-center justify-between gap-3 px-4 sm:px-6">
          <LogoButton onClick={onLogo} spinning={transitioning} variant="landing" />

          <div className="flex shrink-0 items-center gap-3 sm:gap-6">
            <StartSessionButton onClick={() => onGoLive()} transitioning={transitioning} />
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
            {loadingRooms ? (
              <p className="px-4 py-3 text-xs text-gray-400">Loading live channels...</p>
            ) : liveChannels.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No live channels yet.</p>
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
                    <span className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-gray-950">
                      {ch.title}
                    </span>
                    <span className="text-xs text-gray-500">{ch.spectating}</span>
                  </div>
                </button>
              ))
            )}
          </nav>
        </div>

        <div className="sidebar-text mt-auto shrink-0 border-t border-gray-100 pb-8 pt-6 max-lg:hidden">
          <p className="mb-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            Topics
          </p>
          <div className="flex flex-wrap gap-2 px-4">
            {topicPills.length === 0 ? (
              <span className="text-xs text-gray-400">Topics appear when live rooms are available.</span>
            ) : (
              topicPills.map((topic) => (
                <span
                  key={topic}
                  className="rounded-lg bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600"
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
            {loadingRooms ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                Loading live discussions...
              </div>
            ) : liveRooms.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                No live discussions yet. Create a room to populate this list.
              </div>
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
                  className={`overflow-hidden rounded-2xl border border-gray-200 bg-white ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                >
                  <div className="relative aspect-video overflow-hidden bg-gray-50">
                    <div className="absolute left-3 top-3 z-10 rounded bg-red-500 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                      Live
                    </div>
                    <div className="absolute bottom-3 left-3 z-10 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {card.viewers} viewers
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
              ))
            )}
          </div>
        </section>
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
          <h2 className="text-lg font-black uppercase tracking-[0.2em]">{found ? "Room Found" : "Searching"}</h2>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {statusText}
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

type View = "landing" | "matchmaking" | "arena";

export default function DebatePlatformPreview() {
  const [view, setView] = useState<View>("landing");
  const [transitioning, setTransitioning] = useState(false);
  const [pendingTopic, setPendingTopic] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [matchmakingFound, setMatchmakingFound] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState("Waiting for a stranger...");

  const matchmakingChannelRef = useRef<RealtimeChannel | null>(null);
  const createdWaitingRoomRef = useRef<string | null>(null);
  const guestMatchTimersRef = useRef<number[]>([]);

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
    setPendingTopic(room?.topic ?? "");
    setMatchmakingFound(false);
    setMatchmakingStatus("Waiting for a stranger...");
    setTransitioning(true);
    window.setTimeout(() => {
      setView("matchmaking");
      window.setTimeout(() => setTransitioning(false), 420);
    }, 520);
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
    guestMatchTimersRef.current = [];

    const runMatchmaking = async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          // Guest fallback: keep app testable without auth, but not persisted matchmaking.
          setMatchmakingStatus("Guest mode: local test match");
          const t1 = window.setTimeout(() => {
            if (cancelled) return;
            setMatchmakingFound(true);
            setMatchmakingStatus("Preparing the arena...");
            const roomId =
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `room_${Date.now()}`;
            const t2 = window.setTimeout(() => {
              if (cancelled) return;
              showArena(roomId, pendingTopic || "Open debate");
            }, 700);
            guestMatchTimersRef.current.push(t2);
          }, 1200);
          guestMatchTimersRef.current.push(t1);
          return;
        }

        setMatchmakingStatus("Searching Supabase rooms...");

        const { data: waitingRoom } = await supabase
          .from("debate_rooms")
          .select("id, topic, affirmative_user_id")
          .eq("status", "waiting")
          .not("affirmative_user_id", "is", null)
          .neq("affirmative_user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (waitingRoom?.id) {
          const { data: claimed } = await supabase
            .from("debate_rooms")
            .update({
              negative_user_id: user.id,
              status: "active",
              started_at: new Date().toISOString(),
            })
            .eq("id", waitingRoom.id)
            .eq("status", "waiting")
            .is("negative_user_id", null)
            .select("id, topic")
            .maybeSingle();

          if (claimed?.id) {
            if (cancelled) return;
            setMatchmakingFound(true);
            setMatchmakingStatus("Match found. Entering arena...");
            window.setTimeout(() => {
              if (!cancelled) showArena(claimed.id, claimed.topic || pendingTopic || "Open debate");
            }, 700);
            return;
          }
        }

        const topic = pendingTopic || "Open debate";
        const { data: createdRoom } = await supabase
          .from("debate_rooms")
          .insert({
            topic,
            debate_format: "casual_1v1",
            affirmative_user_id: user.id,
            status: "waiting",
          })
          .select("id, topic")
          .single();

        if (!createdRoom?.id || cancelled) return;
        createdWaitingRoomRef.current = createdRoom.id;
        setMatchmakingStatus("Waiting for opponent...");

        matchmakingChannelRef.current = supabase
          .channel(`matchmaking:${createdRoom.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "debate_rooms",
              filter: `id=eq.${createdRoom.id}`,
            },
            (payload) => {
              const room = payload.new as { id: string; status: string; topic: string };
              if (room.status === "active") {
                setMatchmakingFound(true);
                setMatchmakingStatus("Match found. Entering arena...");
                window.setTimeout(() => {
                  if (!cancelled) showArena(room.id, room.topic || topic);
                }, 700);
              }
            }
          )
          .subscribe();
      } catch {
        setMatchmakingStatus("Matchmaking unavailable. Try again.");
      }
    };

    void runMatchmaking();
    return () => {
      cancelled = true;
      guestMatchTimersRef.current.forEach((id) => window.clearTimeout(id));
      guestMatchTimersRef.current = [];
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
          />
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
          <ArenaView
            key={activeRoomId || "arena"}
            onLeave={showLanding}
            onNextStranger={startNextStrangerMatch}
            roomId={activeRoomId}
            topic={activeTopic}
          />
        ) : (
          <MatchmakingView
            onCancel={showLanding}
            found={matchmakingFound}
            statusText={matchmakingStatus}
          />
        )}
      </div>
    </main>
  );
}
