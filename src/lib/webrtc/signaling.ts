import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { SignalPayload, SignalType, WebRtcSignalRow } from "./types";

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

