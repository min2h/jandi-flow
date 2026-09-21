import { describe, expect, it } from "vitest";
import { cronFromFixedTime, isDueNow, parseHm, pickRandomTimeInWindow, toMinutes } from "../src/lib/schedule.js";

describe("schedule", () => {
  it("parses HH:mm and rejects invalid", () => {
    expect(parseHm("09:00")).toEqual({ hours: 9, minutes: 0 });
    expect(() => parseHm("25:00")).toThrow();
    expect(() => parseHm("abc")).toThrow();
  });

  it("builds cron from fixed time", () => {
    expect(cronFromFixedTime("09:07")).toBe("7 9 * * *");
  });

  it("picks random time inside window", () => {
    const picked = pickRandomTimeInWindow("09:00", "10:00", () => 0);
    expect(picked).toBe("09:00");
    const end = pickRandomTimeInWindow("09:00", "10:00", () => 0.999);
    expect(toMinutes(end)).toBeGreaterThanOrEqual(toMinutes("09:00"));
    expect(toMinutes(end)).toBeLessThanOrEqual(toMinutes("10:00"));
  });

  it("supports overnight windows", () => {
    const picked = pickRandomTimeInWindow("22:00", "01:00", () => 0);
    expect(picked).toBe("22:00");
  });

  it("is due only once per timezone day+time", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const first = isDueNow(now, "Asia/Seoul", "09:00", null);
    expect(first.due).toBe(true);
    const again = isDueNow(now, "Asia/Seoul", "09:00", first.key);
    expect(again.due).toBe(false);
  });
});
