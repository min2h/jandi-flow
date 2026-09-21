import { describe, expect, it } from "vitest";
import { appendGardenJournal, GARDEN_RELATIVE_PATH } from "../src/lib/garden-journal.js";

describe("garden journal", () => {
  it("creates a readable markdown file on first write", () => {
    const at = new Date("2026-09-21T06:31:00.000Z");
    const text = appendGardenJournal("", at, "오늘도 잔디 한 칸");
    expect(GARDEN_RELATIVE_PATH).toBe(".jandi/GARDEN.md");
    expect(text).toContain("# jandi-flow garden");
    expect(text).toContain("## 기록");
    expect(text).toContain("2026-09-21 06:31:00 UTC · 오늘도 잔디 한 칸");
  });

  it("appends another day without losing previous lines", () => {
    const first = appendGardenJournal("", new Date("2026-09-21T06:31:00.000Z"), "첫 칸");
    const second = appendGardenJournal(first, new Date("2026-09-22T01:00:00.000Z"), "둘째 칸");
    expect(second).toContain("첫 칸");
    expect(second).toContain("둘째 칸");
    expect(second.match(/## 기록/g)?.length).toBe(1);
  });
});
