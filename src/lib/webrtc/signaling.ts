import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { SignalPayload, SignalType, WebRtcSignalRow } from "./types";

/**
 * Broadcast-based WebRTC signaling — no Supabase Realtime replication required.
 * Messages go directly over the WebSocket (ephemeral, not persisted in the DB).
 *
 * Protocol:
 *   hello  → peer announces presence; lower userId becomes "caller" and sends offer
 *   ack    → non-caller confirms they're ready (triggers caller if hello was missed)
 *   offer  → WebRTC offer SDP  (targeted)
 *   answer → WebRTC answer SDP (targeted)
 *   ice    → ICE candidate      (targeted)
 *   bye    → peer is leaving
 *
 * Usage:
 *   const bc = createBroadcastSignaling(roomId);
 *   bc.on("hello", handler).on("offer", handler)...;
 *   bc.subscribe(() => bc.send("hello", {}));
 *   // later: bc.send("offer", { sdp, target: peerId });
 *   // cleanup: await bc.destroy();
 */
export interface BroadcastSignaling {
  on(event: string, handler: (payload: Record<string, unknown>) => void): BroadcastSignaling;
  subscribe(onReady?: () => void): BroadcastSignaling;
  send(event: string, payload?: Record<string, unknown>): void;
  destroy(): Promise<void>;
}

export function createBroadcastSignaling(roomId: string): BroadcastSignaling {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase.channel(`debate-rtc:${roomId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  const handlers = new Map<string, (p: Record<string, unknown>) => void>();
  let subscribed = false;

  for (const evt of ["hello", "ack", "offer", "answer", "ice", "bye"]) {
    channel.on("broadcast", { event: evt }, ({ payload }) => {
      handlers.get(evt)?.(((payload ?? {}) as Record<string, unknown>));
    });
  }

  const api: BroadcastSignaling = {
    on(event, handler) {
      handlers.set(event, handler);
      return api;
    },
    subscribe(onReady) {
      if (!subscribed) {
        subscribed = true;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") onReady?.();
        });
      }
      return api;
    },
    send(event, payload = {}) {
      void channel.send({ type: "broadcast", event, payload });
    },
    async destroy() {
      await supabase.removeChannel(channel);
    },
  };

  return api;
}

export async function sendSignal(input: {
  roomId: string;
  senderUserId: string;
  targetUserId?: string | null;
  signalType: SignalType;
  payload: SignalPayload;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("webrtc_signals").insert({
    room_id: input.roomId,
    sender_user_id: input.senderUserId,
    target_user_id: input.targetUserId ?? null,
    signal_type: input.signalType,
    payload: input.payload,
  });
  if (error) throw error;
}

export function subscribeSignals(
  roomId: string,
  onSignal: (signal: WebRtcSignalRow) => void
) {
  const supabase = createClient();
  const channel = supabase
    .channel(`webrtc-signals:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "webrtc_signals",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => onSignal(payload.new as WebRtcSignalRow)
    )
    .subscribe();

  return { supabase, channel };
}

export async function unsubscribeSignals(
  supabase: ReturnType<typeof createClient>,
  channel: RealtimeChannel
) {
  await supabase.removeChannel(channel);
}

export async function upsertPresence(input: {
  roomId: string;
  userId: string;
  role: "affirmative" | "negative" | "spectator";
  isOnline: boolean;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("room_presence").upsert(
    {
      room_id: input.roomId,
      user_id: input.userId,
      role: input.role,
      is_online: input.isOnline,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" }
  );
  if (error) throw error;
}

