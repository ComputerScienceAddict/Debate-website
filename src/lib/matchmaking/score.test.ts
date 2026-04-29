import { describe, expect, it } from "vitest";
import {
  MIN_SHARED_NON_NEUTRAL_TAGS,
  scoreOpponentPair,
  type TagPreferenceMap,
} from "./score";

function mapFrom(
  pairs: Array<[string, "support" | "oppose" | "neutral"]>
): TagPreferenceMap {
  return new Map(pairs);
}

describe("scoreOpponentPair", () => {
  it("rewards support vs oppose on overlapping tags", () => {
    const a = mapFrom([
      ["t1", "support"],
      ["t2", "support"],
    ]);
    const b = mapFrom([
      ["t1", "oppose"],
      ["t2", "oppose"],
    ]);
    const r = scoreOpponentPair(a, b);
    expect(r.sharedTagCount).toBe(2);
    expect(r.bothNonNeutralOverlap).toBe(2);
    expect(r.meetsOverlapRule).toBe(true);
    expect(r.disagreementScore).toBeGreaterThan(0);
  });

  it("penalizes agreement on overlapping tags", () => {
    const a = mapFrom([
      ["t1", "support"],
      ["t2", "support"],
    ]);
    const b = mapFrom([
      ["t1", "support"],
      ["t2", "support"],
    ]);
    const r = scoreOpponentPair(a, b);
    expect(r.disagreementScore).toBeLessThan(0);
  });

  it("requires MIN_SHARED_NON_NEUTRAL_TAGS for overlap rule when neutral hides strength", () => {
    const a = mapFrom([
      ["t1", "support"],
      ["t2", "neutral"],
    ]);
    const b = mapFrom([
      ["t1", "neutral"],
      ["t2", "oppose"],
    ]);
    const r = scoreOpponentPair(a, b);
    expect(r.sharedTagCount).toBe(2);
    expect(r.bothNonNeutralOverlap).toBeLessThan(MIN_SHARED_NON_NEUTRAL_TAGS);
    expect(r.meetsOverlapRule).toBe(false);
  });
});
