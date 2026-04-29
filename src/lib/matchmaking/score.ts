import type { TagStance } from "./types";

/** Weight for direct opposition (support vs oppose). */
const OPPOSITION_WEIGHT = 10;
/** Penalty when both agree on the same side (reduces "controversy" score). */
const AGREEMENT_PENALTY = 2;
/** Small weight when one side is neutral (less informative). */
const NEUTRAL_WEIGHT = 0.5;

export type TagPreferenceMap = Map<string, TagStance>;

/**
 * Requires at least this many shared tags (both users have a row for the tag)
 * where at least one stance is non-neutral, to qualify as a match candidate.
 */
export const MIN_SHARED_NON_NEUTRAL_TAGS = 2;

/**
 * Disagreement score for opposition-first pairing. Higher = better debate tension.
 */
export function disagreementScoreForTagPair(
  a: TagStance,
  b: TagStance
): number {
  if (a === "neutral" && b === "neutral") return 0;
  if (a === "neutral" || b === "neutral") {
    return NEUTRAL_WEIGHT;
  }
  if (a !== b) {
    if (
      (a === "support" && b === "oppose") ||
      (a === "oppose" && b === "support")
    ) {
      return OPPOSITION_WEIGHT;
    }
  }
  return -AGREEMENT_PENALTY;
}

/** Tags where at least one user is non-neutral (interest signal). */
export function overlapNonNeutralCount(
  mapA: TagPreferenceMap,
  mapB: TagPreferenceMap
): number {
  let n = 0;
  const smaller = mapA.size <= mapB.size ? mapA : mapB;
  const other = mapA.size <= mapB.size ? mapB : mapA;
  for (const tagId of smaller.keys()) {
    const sa = smaller.get(tagId);
    const sb = other.get(tagId);
    if (sa === undefined || sb === undefined) continue;
    if (sa !== "neutral" || sb !== "neutral") n += 1;
  }
  return n;
}

/** Tags where both users chose a non-neutral stance (strong overlap for matching). */
export function bothNonNeutralOverlapCount(
  mapA: TagPreferenceMap,
  mapB: TagPreferenceMap
): number {
  let n = 0;
  for (const tagId of sharedTagIds(mapA, mapB)) {
    const sa = mapA.get(tagId)!;
    const sb = mapB.get(tagId)!;
    if (sa !== "neutral" && sb !== "neutral") n += 1;
  }
  return n;
}

export function sharedTagIds(mapA: TagPreferenceMap, mapB: TagPreferenceMap): string[] {
  const out: string[] = [];
  const smaller = mapA.size <= mapB.size ? mapA : mapB;
  const other = mapA.size <= mapB.size ? mapB : mapA;
  for (const tagId of smaller.keys()) {
    if (other.has(tagId)) out.push(tagId);
  }
  return out;
}

export type PairScoreResult = {
  disagreementScore: number;
  sharedTagCount: number;
  overlapNonNeutral: number;
  bothNonNeutralOverlap: number;
  meetsOverlapRule: boolean;
};

export function scoreOpponentPair(
  mapA: TagPreferenceMap,
  mapB: TagPreferenceMap
): PairScoreResult {
  let disagreementScore = 0;
  const shared = sharedTagIds(mapA, mapB);
  for (const tagId of shared) {
    const sa = mapA.get(tagId)!;
    const sb = mapB.get(tagId)!;
    disagreementScore += disagreementScoreForTagPair(sa, sb);
  }
  const overlapNonNeutral = overlapNonNeutralCount(mapA, mapB);
  const bothNonNeutral = bothNonNeutralOverlapCount(mapA, mapB);
  const meetsOverlapRule =
    shared.length >= 2 && bothNonNeutral >= MIN_SHARED_NON_NEUTRAL_TAGS;
  return {
    disagreementScore,
    sharedTagCount: shared.length,
    overlapNonNeutral,
    bothNonNeutralOverlap: bothNonNeutral,
    meetsOverlapRule,
  };
}
