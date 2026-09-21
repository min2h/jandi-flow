import cron from "node-cron";
import type { SqliteDb } from "./sqlite.js";
import { getSettings } from "./db.js";
import { isDueNow, pickRandomTimeInWindow } from "../lib/schedule.js";

export interface SchedulerHandle {
  stop(): void;
}

export function startScheduler(
  db: SqliteDb,
  runJobs: () => Promise<void>,
  options?: { intervalMs?: number; now?: () => Date }
): SchedulerHandle {
  const intervalMs = options?.intervalMs ?? 30_000;
  const now = options?.now ?? (() => new Date());

  const tick = async () => {
    const settings = getSettings(db);
    if (!settings.schedulerEnabled) return;
    const state = db.prepare("SELECT last_run_key, next_random_hm FROM scheduler_state WHERE id = 1").get() as {
      last_run_key: string | null;
      next_random_hm: string | null;
    };
    const target =
      settings.scheduleMode === "fixed"
        ? settings.fixedTime
        : state.next_random_hm || pickRandomTimeInWindow(settings.randomFrom, settings.randomTo);
    if (settings.scheduleMode === "random" && !state.next_random_hm) {
      db.prepare("UPDATE scheduler_state SET next_random_hm = ? WHERE id = 1").run(target);
    }
    const due = isDueNow(now(), settings.timezone, target, state.last_run_key);
    if (!due.due) return;
    db.prepare("UPDATE scheduler_state SET last_run_key = ? WHERE id = 1").run(due.key);
    if (settings.scheduleMode === "random") {
      const next = pickRandomTimeInWindow(settings.randomFrom, settings.randomTo);
      db.prepare("UPDATE scheduler_state SET next_random_hm = ? WHERE id = 1").run(next);
    }
    await runJobs();
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  const daily = cron.schedule("0 0 * * *", () => {
    const settings = getSettings(db);
    if (settings.scheduleMode === "random") {
      const next = pickRandomTimeInWindow(settings.randomFrom, settings.randomTo);
      db.prepare("UPDATE scheduler_state SET next_random_hm = ? WHERE id = 1").run(next);
    }
  });

  void tick();

  return {
    stop() {
      clearInterval(timer);
      daily.stop();
    }
  };
}
