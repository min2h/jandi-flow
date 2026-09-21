import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { saveSettings, getSettings, openDb } from "../src/server/db.js";
import { startScheduler } from "../src/server/scheduler.js";

describe("scheduler", () => {
  it("runs at the fixed time once", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "janfi-sched-"));
    const db = await openDb(path.join(dir, "janfi.sqlite"));
    const settings = getSettings(db);
    saveSettings(db, { ...settings, scheduleMode: "fixed", fixedTime: "09:00", timezone: "Asia/Seoul", schedulerEnabled: true });
    let runs = 0;
    const handle = startScheduler(db, async () => { runs += 1; }, {
      intervalMs: 10_000,
      now: () => new Date("2026-03-01T00:00:00.000Z")
    });
    await vi.waitFor(() => expect(runs).toBe(1));
    handle.stop();
    db.close();
  });

  it("does not run when scheduler is disabled", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "janfi-sched-"));
    const db = await openDb(path.join(dir, "janfi.sqlite"));
    const settings = getSettings(db);
    saveSettings(db, { ...settings, schedulerEnabled: false, fixedTime: "09:00", timezone: "Asia/Seoul" });
    let runs = 0;
    const handle = startScheduler(db, async () => { runs += 1; }, {
      intervalMs: 10_000,
      now: () => new Date("2026-03-01T00:00:00.000Z")
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(runs).toBe(0);
    handle.stop();
    db.close();
  });
});
