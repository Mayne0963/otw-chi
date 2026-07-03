import { describe, expect, it } from "vitest";
import { analyzeRequestText, classifyComplaint, enhanceEta, generateDriverCoaching } from "./assist";

describe("lib/ai/assist", () => {
  it("analyzes request text into structured flags", async () => {
    const result = await analyzeRequestText("Fragile glass. Two people needed. Stairs to 3rd floor.");
    expect(result).toHaveProperty("flags");
    expect(result.flags.isFragile).toBe(true);
    expect(result.flags.hasStairs).toBe(true);
    expect(result.flags.requiresTwoPeople).toBe(true);
  });

  it("classifies common complaint types", async () => {
    await expect(classifyComplaint("Driver was late and slow")).resolves.toMatchObject({
      category: "LATE",
    });
    await expect(classifyComplaint("Item was damaged and scratched")).resolves.toMatchObject({
      category: "DAMAGED",
    });
    await expect(classifyComplaint("Very rude and unprofessional")).resolves.toMatchObject({
      category: "RUDE",
    });
  });

  it("enhances ETA without reducing it", async () => {
    const enhancement = await enhanceEta(30, { weather: "rain", traffic: "heavy", timeOfDay: "rush_hour" });
    expect(enhancement.originalEtaMinutes).toBe(30);
    expect(enhancement.adjustedEtaMinutes).toBeGreaterThanOrEqual(30);
    expect(enhancement.factorsApplied.length).toBeGreaterThan(0);
    expect(enhancement.confidenceScore).toBeGreaterThan(0);
  });

  it("generates safe driver coaching suggestions", async () => {
    const coaching = await generateDriverCoaching({ rating: 4.6, onTimeRate: 0.95, cancelRate: 0.05 });
    expect(coaching.focusArea).toBeTruthy();
    expect(Array.isArray(coaching.tips)).toBe(true);
    expect(coaching.tips.length).toBeGreaterThan(0);
  });
});

