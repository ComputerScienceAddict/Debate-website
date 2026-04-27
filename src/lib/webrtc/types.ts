export type SignalType = "offer" | "answer" | "ice_candidate" | "bye";

export type SignalPayload = Record<string, unknown>;

export interface WebRtcSignalRow {
  id: string;
  room_id: string;
  sender_user_id: string;
  target_user_id: string | null;
  signal_type: SignalType;
  payload: SignalPayload;
  created_at: string;
}

export interface PresenceRow {
  room_id: string;
  user_id: string;
  role: "affirmative" | "negative" | "spectator";
  joined_at: string;
  last_seen_at: string;
  is_online: boolean;
}

