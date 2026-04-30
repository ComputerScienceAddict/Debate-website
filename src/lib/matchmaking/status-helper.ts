import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type ValidActiveRoomRow = {
  id: string;
  topic: string | null;
  affirmative_user_id: string;
  negative_user_id: string;
};

/** Pure check: 1v1 row has two distinct users and this user is one of them (testable). */
export function omegleRoomParticipantsValid(
  userId: string,
  aff: string | null,
  neg: string | null
): boolean {
  const iAmParticipant = aff === userId || neg === userId;
  const twoParticipants =
    typeof aff === "string" &&
    aff.length > 0 &&
    typeof neg === "string" &&
    neg.length > 0 &&
    aff !== neg;
  return twoParticipants && iAmParticipant;
}

/**
 * Fetches Omegle-style active match for this user only if both slots are filled,
 * participant IDs differ, and the row is fully linked — otherwise completes the broken row (best-effort)
 * so the client cannot get "matched" with a ghost stranger.
 */
export async function fetchValidActiveMatchedRoomOrHeal(
  admin: Admin,
  userId: string
): Promise<ValidActiveRoomRow | null> {
  const endedNow = new Date().toISOString();

  const { data: row } = await admin
    .from("debate_rooms")
    .select("id, topic, affirmative_user_id, negative_user_id")
    .or(`affirmative_user_id.eq.${userId},negative_user_id.eq.${userId}`)
    .eq("status", "active")
    .not("match_record_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.id) return null;

  const aff = row.affirmative_user_id as string | null;
  const neg = row.negative_user_id as string | null;

  if (
    omegleRoomParticipantsValid(userId, aff, neg)
  ) {
    return {
      id: row.id as string,
      topic: row.topic as string | null,
      affirmative_user_id: aff as string,
      negative_user_id: neg as string,
    };
  }

  await admin
    .from("debate_rooms")
    .update({ status: "completed", ended_at: endedNow })
    .eq("id", row.id as string)
    .eq("status", "active");
  return null;
}
