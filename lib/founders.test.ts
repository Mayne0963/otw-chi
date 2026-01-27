import { describe, expect, it, vi } from "vitest";

describe("founders", () => {
  it("matches founder emails from env", async () => {
    vi.resetModules();
    vi.stubEnv("FOUNDER_DRIVER_EMAILS", "a@otw.com, B@otw.com");
    const mod = await import("./founders");
    expect(mod.isFounderDriverEmail("a@otw.com")).toBe(true);
    expect(mod.isFounderDriverEmail("b@otw.com")).toBe(true);
    expect(mod.isFounderDriverEmail("c@otw.com")).toBe(false);
  });
});

