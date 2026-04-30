import { describe, expect, it } from "vitest";
import { isWebrtcCaller } from "./caller-selection";

describe("isWebrtcCaller", () => {
  it("makes lexicographically lower id the caller", () => {
    const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    expect(isWebrtcCaller(a, b)).toBe(true);
    expect(isWebrtcCaller(b, a)).toBe(false);
  });

  it("is stable when both are valid UUID-ish strings", () => {
    const x = "10000000-0000-0000-0000-000000000001";
    const y = "20000000-0000-0000-0000-000000000002";
    expect(isWebrtcCaller(x, y)).toBe(true);
  });
});
