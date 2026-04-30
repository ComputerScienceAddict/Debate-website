import { describe, expect, it } from "vitest";
import { isIceDisconnectedProvisional, isIceTerminated } from "./ice-policy";

describe("ice-policy", () => {
  it("treats failed and closed as immediate termination", () => {
    expect(isIceTerminated("failed")).toBe(true);
    expect(isIceTerminated("closed")).toBe(true);
    expect(isIceTerminated("disconnected")).toBe(false);
    expect(isIceTerminated("connected")).toBe(false);
  });

  it("flags disconnected as provisional-only", () => {
    expect(isIceDisconnectedProvisional("disconnected")).toBe(true);
    expect(isIceDisconnectedProvisional("failed")).toBe(false);
  });
});
