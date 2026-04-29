import { createAdminClient } from "@/lib/supabase/admin";
import {
  type TagPreferenceMap,
  scoreOpponentPair,
} from "@/lib/matchmaking/score";
import type { TagStance } from "@/lib/matchmaking/types";
import { buildFallbackDebateTopic, type TagConflict } from "./topic-fallback";
import type { GenerateTopicRequest, GenerateTopicResponse } from "@/lib/referee/types";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://127.0.0.1:3001";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || "";
const DEBATE_FORMAT = "casual_1v1";

function orderedPair(
  a: string,
  b: string
): { userA: string; userB: string; affirmative: string; negative: string } {
  if (a < b) {
    return { userA: a, userB: b, affirmative: a, negative: b };
  }
  return { userA: b, userB: a, affirmative: b, negative: a };
}

async function loadPreferenceMap(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<TagPreferenceMap> {
  const { data, error } = await admin
    .from("user_tag_preferences")
    .select("tag_id, stance")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const m: TagPreferenceMap = new Map();
  for (const row of data ?? []) {
    m.set(row.tag_id, row.stance as TagStance);
  }
  return m;
}

async function loadTagLabels(
  admin: ReturnType<typeof createAdminClient>,
  tagIds: string[]
): Promise<Map<string, string>> {
  if (tagIds.length === 0) return new Map();
  const { data, error } = await admin
    .from("political_tags")
    .select("id, label")
    .in("id", tagIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id, row.label);
  }
  return map;
}

function buildConflictsFromMaps(
  mapA: TagPreferenceMap,
  mapB: TagPreferenceMap,
  labelById: Map<string, string>
): TagConflict[] {
  const conflicts: TagConflict[] = [];
  for (const tagId of mapA.keys()) {
    if (!mapB.has(tagId)) continue;
    const sa = mapA.get(tagId)!;
    const sb = mapB.get(tagId)!;
    conflicts.push({
      tagLabel: labelById.get(tagId) ?? tagId,
      stanceA: sa,
      stanceB: sb,
    });
  }
  return conflicts;
}

async function callGenerateTopic(
  body: GenerateTopicRequest
): Promise<GenerateTopicResponse | null> {
  if (!AI_GATEWAY_KEY) return null;
  try {
    const response = await fetch(`${AI_GATEWAY_URL}/referee/generate-topic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-key": AI_GATEWAY_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as GenerateTopicResponse;
  } catch {
    return null;
  }
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
 * Attempts to pair the user with another queued user (opposition-first).
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

  // First check if user was already matched by someone else (or has an active room)
  const { data: existingRoom } = await admin
    .from("debate_rooms")
    .select("id, topic")
    .or(`affirmative_user_id.eq.${userId},negative_user_id.eq.${userId}`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRoom?.id) {
    // User already has an active room - they were matched!
    // Clean up queue entry if exists
    await admin.from("matchmaking_queue").delete().eq("user_id", userId);
    return {
      matched: true,
      room_id: existingRoom.id as string,
      match_record_id: "",
      topic: (existingRoom.topic as string) || "Open debate",
      disagreement_score: 0,
    };
  }

  // Check current queue status before upserting
  const { data: currentQueueEntry } = await admin
    .from("matchmaking_queue")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  // Only upsert if not currently matched (prevent overwriting matched status)
  if (!currentQueueEntry || currentQueueEntry.status !== "matched") {
    const { error: selfErr } = await admin.from("matchmaking_queue").upsert(
      {
        user_id: userId,
        status: "waiting",
        queued_at: currentQueueEntry ? undefined : new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (selfErr) {
      return { error: selfErr.message, status: 500 };
    }
  }

  const { data: waiting, error: qErr } = await admin
    .from("matchmaking_queue")
    .select("user_id")
    .eq("status", "waiting")
    .neq("user_id", userId)
    .order("queued_at", { ascending: true });

  if (qErr) {
    return { error: qErr.message, status: 500 };
  }

  const candidateIds = (waiting ?? []).map((r) => r.user_id as string);
  if (candidateIds.length === 0) {
    return { matched: false, queued: true };
  }

  const selfMap = await loadPreferenceMap(admin, userId);
  let best:
    | {
        oppId: string;
        disagreement: number;
        pair: ReturnType<typeof scoreOpponentPair>;
      }
    | undefined;
  let fallbackCandidate:
    | { oppId: string; pair: ReturnType<typeof scoreOpponentPair> }
    | undefined;

  for (const oppId of candidateIds) {
    const oppMap = await loadPreferenceMap(admin, oppId);
    const pair = scoreOpponentPair(selfMap, oppMap);

    // Track first candidate as fallback (in case no one meets overlap rule)
    if (!fallbackCandidate) {
      fallbackCandidate = { oppId, pair };
    }

    if (!pair.meetsOverlapRule) continue;

    if (
      best === undefined ||
      pair.disagreementScore > best.disagreement ||
      (pair.disagreementScore === best.disagreement &&
        oppId.localeCompare(best.oppId) < 0)
    ) {
      best = {
        oppId,
        disagreement: pair.disagreementScore,
        pair,
      };
    }
  }

  // If no ideal match but there's a waiting candidate, match anyway (fallback for better UX)
  if (best === undefined && fallbackCandidate) {
    best = {
      oppId: fallbackCandidate.oppId,
      disagreement: fallbackCandidate.pair.disagreementScore,
      pair: fallbackCandidate.pair,
    };
  }

  if (best === undefined) {
    return {
      matched: false,
      queued: true,
      reason:
        "No opponent with sufficient overlapping tags yet. Stay in queue.",
    };
  }

  const oppId = best.oppId;

  // Atomically claim the opponent by DELETING their queue row.
  // If delete returns 0 rows, someone else claimed them first.
  const { data: claimedRows, error: claimErr } = await admin
    .from("matchmaking_queue")
    .delete()
    .eq("user_id", oppId)
    .eq("status", "waiting")
    .select("user_id");

  if (claimErr || !claimedRows || claimedRows.length === 0) {
    // Opponent was already claimed by someone else or left queue
    return {
      matched: false,
      queued: true,
      reason: "Opponent just matched with someone else. Searching again...",
    };
  }

  // Remove self from queue too — we have our opponent
  await admin.from("matchmaking_queue").delete().eq("user_id", userId);

  const oppMap = await loadPreferenceMap(admin, oppId);
  const o = orderedPair(userId, oppId);

  const tagIdsForLabels = new Set([...selfMap.keys(), ...oppMap.keys()]);
  const labelById = await loadTagLabels(admin, Array.from(tagIdsForLabels));
  const conflicts = buildConflictsFromMaps(selfMap, oppMap, labelById);

  const disagreementScore = best.disagreement;
  const compatibilityScore = Math.max(
    -5,
    Math.min(5, -(best.pair.disagreementScore / 10))
  );

  const { data: roomRow, error: roomErr } = await admin
    .from("debate_rooms")
    .insert({
      topic: "Generating debate topic…",
      debate_format: DEBATE_FORMAT,
      affirmative_user_id: o.affirmative,
      negative_user_id: o.negative,
      status: "active",
    })
    .select("id")
    .single();

  if (roomErr || !roomRow) {
    // Both already deleted from queue; just clean up the failed room
    return { error: roomErr?.message ?? "Failed to create room", status: 500 };
  }

  const roomId = roomRow.id as string;

  const { data: matchRow, error: matchErr } = await admin
    .from("match_records")
    .insert({
      user_a_id: o.userA,
      user_b_id: o.userB,
      room_id: roomId,
      disagreement_score: disagreementScore,
      compatibility_score: compatibilityScore,
    })
    .select("id")
    .single();

  if (matchErr || !matchRow) {
    await admin.from("debate_rooms").delete().eq("id", roomId);
    return { error: matchErr?.message ?? "Failed to create match record", status: 500 };
  }

  const matchRecordId = matchRow.id as string;

  const { error: linkErr } = await admin
    .from("debate_rooms")
    .update({ match_record_id: matchRecordId })
    .eq("id", roomId);

  if (linkErr) {
    return { error: linkErr.message, status: 500 };
  }

  const profileByUser = await loadDisplayNames(admin, [userId, oppId]);
  const conflictsPayload: GenerateTopicRequest["conflicts"] = conflicts.map(
    (c) => ({
      tag_label: c.tagLabel,
      stance_a: c.stanceA,
      stance_b: c.stanceB,
    })
  );
  const generateBody: GenerateTopicRequest = {
    room_id: roomId,
    debate_format: DEBATE_FORMAT,
    user_a_name: profileByUser.get(userId) ?? "Participant A",
    user_b_name: profileByUser.get(oppId) ?? "Participant B",
    conflicts: conflictsPayload,
  };

  const ai = await callGenerateTopic(generateBody);
  let topic: string;
  let meta: Record<string, unknown>;

  if (ai?.topic && ai.topic.length > 0) {
    topic = ai.topic;
    meta = {
      source: "ai",
      model: ai.model,
      rationale: ai.rationale ?? null,
      resolution: ai.resolution ?? null,
    };
  } else {
    topic = buildFallbackDebateTopic(conflicts);
    meta = { source: "fallback", conflicts };
  }

  const { error: upRoomErr } = await admin
    .from("debate_rooms")
    .update({ topic, generated_topic_meta: meta })
    .eq("id", roomId);

  if (upRoomErr) {
    return { error: upRoomErr.message, status: 500 };
  }

  return {
    matched: true,
    room_id: roomId,
    match_record_id: matchRecordId,
    topic,
    disagreement_score: disagreementScore,
  };
}

async function loadDisplayNames(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  if (error) return new Map();
  const m = new Map<string, string>();
  for (const row of data ?? []) {
    const name = (row.display_name as string)?.trim();
    if (row.id && name) m.set(row.id as string, name);
  }
  return m;
}

