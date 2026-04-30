import { createAdminClient } from "@/lib/supabase/admin";

const DEBATE_FORMAT = "casual_1v1";

/** Ends every active Omegle-style room row this user participates in (service role). */
export async function closeActiveDebatesForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<void> {
  const endedNow = new Date().toISOString();
  await admin
    .from("debate_rooms")
    .update({ status: "completed", ended_at: endedNow })
    .or(`affirmative_user_id.eq.${userId},negative_user_id.eq.${userId}`)
    .eq("status", "active");
}

function orderedPair(
  a: string,
  b: string
): { userA: string; userB: string; affirmative: string; negative: string } {
  if (a < b) {
    return { userA: a, userB: b, affirmative: a, negative: b };
  }
  return { userA: b, userB: a, affirmative: b, negative: a };
}

export type JoinMatchResult =
  | { matched: false; queued: true; reason?: string }
  | {
      matched: true;
      room_id: string;
      match_record_id: string;
      topic: string;
      disagreement_score: number;
    }
  | { error: string; status: number };

/**
 * Pure FIFO matchmaking: claim first waiting user, create room, done.
 * Requires SUPABASE_SERVICE_ROLE_KEY for server-side writes.
 */
export async function joinMatchmaking(userId: string): Promise<JoinMatchResult> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Matchmaking requires SUPABASE_SERVICE_ROLE_KEY on the server. Add it to your environment.",
      status: 503,
    };
  }

  // Close any in-progress Omegle room before re-joining the queue (Next / peer left).
  // Client-side updates hit RLS; without this the next GET /matchmaking/status still
  // returns "matched" and the UI never keeps searching.
  await closeActiveDebatesForUser(admin, userId);

  // Try to claim the longest-waiting user (FIFO)
  const { data: candidates } = await admin
    .from("matchmaking_queue")
    .select("user_id")
    .eq("status", "waiting")
    .neq("user_id", userId)
    .order("queued_at", { ascending: true })
    .limit(1);

  const oppId = candidates?.[0]?.user_id as string | undefined;

  if (oppId) {
    // Atomic claim: DELETE their row. Only one caller wins if both race.
    const { data: claimed } = await admin
      .from("matchmaking_queue")
      .delete()
      .eq("user_id", oppId)
      .eq("status", "waiting")
      .select("user_id");

    if (claimed && claimed.length > 0) {
      // We won the claim — remove self from queue and create the room
      await admin.from("matchmaking_queue").delete().eq("user_id", userId);

      const o = orderedPair(userId, oppId);
      const topic = "Open debate";

      const { data: roomRow, error: roomErr } = await admin
        .from("debate_rooms")
        .insert({
          topic,
          debate_format: DEBATE_FORMAT,
          affirmative_user_id: o.affirmative,
          negative_user_id: o.negative,
          status: "active",
        })
        .select("id")
        .single();

      if (roomErr || !roomRow) {
        return { error: roomErr?.message ?? "Failed to create room", status: 500 };
      }

      const roomId = roomRow.id as string;

      const { data: matchRow, error: matchErr } = await admin
        .from("match_records")
        .insert({
          user_a_id: o.userA,
          user_b_id: o.userB,
          room_id: roomId,
          disagreement_score: 0,
          compatibility_score: 0,
        })
        .select("id")
        .single();

      if (matchErr || !matchRow) {
        await admin.from("debate_rooms").delete().eq("id", roomId);
        return { error: matchErr?.message ?? "Failed to create match record", status: 500 };
      }

      await admin
        .from("debate_rooms")
        .update({ match_record_id: matchRow.id })
        .eq("id", roomId);

      return {
        matched: true,
        room_id: roomId,
        match_record_id: matchRow.id as string,
        topic,
        disagreement_score: 0,
      };
    }
    // Claim lost — fall through to queue self
  }

  // No opponent available — join the queue
  const { error: selfErr } = await admin.from("matchmaking_queue").upsert(
    {
      user_id: userId,
      status: "waiting",
      queued_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (selfErr) {
    return { error: selfErr.message, status: 500 };
  }

  return { matched: false, queued: true };
}
