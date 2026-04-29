import type { TagStance } from "./types";

export type TagConflict = {
  tagLabel: string;
  stanceA: TagStance;
  stanceB: TagStance;
};

/**
 * Deterministic debate topic when AI gateway is unavailable.
 * Uses the strongest opposition pair (support vs oppose) by label order.
 */
export function buildFallbackDebateTopic(conflicts: TagConflict[]): string {
  const oppositions = conflicts.filter(
    (c) =>
      (c.stanceA === "support" && c.stanceB === "oppose") ||
      (c.stanceA === "oppose" && c.stanceB === "support")
  );
  if (oppositions.length === 0) {
    const first = conflicts[0];
    if (first) {
      return `What policy course should the United States take on: ${first.tagLabel}?`;
    }
    return "Resolved: The United States should pursue a major policy shift on a contested national issue.";
  }
  oppositions.sort((a, b) => a.tagLabel.localeCompare(b.tagLabel));
  const top = oppositions[0]!;
  return `Resolved: The United States should prioritize policies that advance ${top.tagLabel}, affirming active government action on this issue rather than limiting or reversing it.`;
}
