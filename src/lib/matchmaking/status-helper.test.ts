import { describe, expect, it } from "vitest";
import { omegleRoomParticipantsValid } from "./status-helper";

describe("omegleRoomParticipantsValid", () => {
  const u1 = "11111111-1111-1111-1111-111111111111";
  const u2 = "22222222-2222-2222-2222-222222222222";

  it("accepts a normal 1v1 row when user is affirmative", () => {
    expect(omegleRoomParticipantsValid(u1, u1, u2)).toBe(true);
  });

  it("accepts when user is negative", () => {
    expect(omegleRoomParticipantsValid(u2, u1, u2)).toBe(true);
  });

  it("rejects missing opponent (null after user delete)", () => {
    expect(omegleRoomParticipantsValid(u1, u1, null)).toBe(false);
    expect(omegleRoomParticipantsValid(u1, null, u2)).toBe(false);
  });

  it("rejects same id on both sides", () => {
    expect(omegleRoomParticipantsValid(u1, u1, u1)).toBe(false);
  });

  it("rejects user not in row", () => {
    const u3 = "33333333-3333-3333-3333-333333333333";
    expect(omegleRoomParticipantsValid(u3, u1, u2)).toBe(false);
  });
});
