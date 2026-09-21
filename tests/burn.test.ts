import { describe, expect, it } from "vitest";
import { addDaysKey, nextBurnOffset, resolvePlantPlan } from "../src/lib/burn.js";

describe("burn grass", () => {
  it("keeps light green every day when disabled", () => {
    const plan = resolvePlantPlan({
      burnEnabled: false,
      burnEveryDays: 7,
      burnJitterDays: 2,
      burnCommits: 8,
      nextBurnDay: "2026-03-01",
      today: "2026-03-01",
      random: () => 0
    });
    expect(plan.intensity).toBe("light");
    expect(plan.count).toBe(1);
  });

  it("schedules the first burn after interval +/- jitter", () => {
    const plan = resolvePlantPlan({
      burnEnabled: true,
      burnEveryDays: 7,
      burnJitterDays: 0,
      burnCommits: 8,
      nextBurnDay: null,
      today: "2026-03-01",
      random: () => 0
    });
    expect(plan.intensity).toBe("light");
    expect(plan.count).toBe(1);
    expect(plan.nextBurnDay).toBe("2026-03-08");
  });

  it("burns on the due day then moves the next window irregularly", () => {
    const plan = resolvePlantPlan({
      burnEnabled: true,
      burnEveryDays: 7,
      burnJitterDays: 2,
      burnCommits: 10,
      nextBurnDay: "2026-03-08",
      today: "2026-03-08",
      random: () => 1
    });
    expect(plan.intensity).toBe("burn");
    expect(plan.count).toBe(10);
    expect(plan.nextBurnDay).toBe(addDaysKey("2026-03-08", nextBurnOffset(7, 2, () => 1)));
  });

  it("forceBurn plants dark green immediately", () => {
    const plan = resolvePlantPlan({
      burnEnabled: true,
      burnEveryDays: 14,
      burnJitterDays: 0,
      burnCommits: 8,
      nextBurnDay: "2026-04-01",
      today: "2026-03-01",
      forceBurn: true,
      random: () => 0
    });
    expect(plan.intensity).toBe("burn");
    expect(plan.count).toBe(8);
  });
});
