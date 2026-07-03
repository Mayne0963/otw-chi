import { afterEach, describe, expect, it, vi } from "vitest";
import { getHereAllowedOrigins, getHereRequestHeaderCandidates } from "./hereEnv";

describe("hereEnv origin candidates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("collects both request and deployment origins for HERE retries", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "otw-chi-two.vercel.app");

    const request = new Request("https://ontheeway.com/api/navigation/pois", {
      headers: {
        origin: "https://ontheeway.com",
        referer: "https://ontheeway.com/order",
      },
    });

    expect(getHereAllowedOrigins(request)).toEqual([
      "https://ontheeway.com",
      "https://otw-chi-two.vercel.app",
    ]);
  });

  it("adds an empty-header fallback after origin candidates", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ontheeway.com");

    const request = new Request("https://ontheeway.com/api/navigation/pois");

    expect(getHereRequestHeaderCandidates(request)).toEqual([
      {
        Origin: "https://ontheeway.com",
        Referer: "https://ontheeway.com/",
      },
      {},
    ]);
  });
});
