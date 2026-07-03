import { describe, expect, it } from "vitest";
import { hashStringFNV1a } from "./hybrid-storage/hash";
import { getFreshness } from "./hybrid-storage/freshness";

describe("hybrid-storage", () => {
  it("hashStringFNV1a is deterministic", () => {
    expect(hashStringFNV1a("abc")).toBe(hashStringFNV1a("abc"));
    expect(hashStringFNV1a("abc")).not.toBe(hashStringFNV1a("abcd"));
  });

  it("getFreshness respects ttl and maxStale", () => {
    const now = 1_000_000;
    const key = "membershipPlansPublic" as const;
    expect(getFreshness(key, now - 1, now)).toBe("fresh");
    expect(getFreshness(key, now - 7 * 60 * 60 * 1000, now)).toBe("stale");
    expect(getFreshness(key, now - 20 * 24 * 60 * 60 * 1000, now)).toBe("expired");
  });
});
