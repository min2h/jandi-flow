import { zonedDateParts } from "./schedule.js";

export function todayKey(now: Date, timeZone: string): string {
  const parts = zonedDateParts(now, timeZone);
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function addDaysKey(fromKey: string, days: number): string {
  const [year, month, day] = fromKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextBurnOffset(everyDays: number, jitterDays: number, random = Math.random): number {
  const every = Math.min(90, Math.max(1, Math.floor(everyDays || 7)));
  const jitter = Math.min(30, Math.max(0, Math.floor(jitterDays || 0)));
  const delta = jitter === 0 ? 0 : Math.round((random() * 2 - 1) * jitter);
  return Math.max(1, every + delta);
}

export function resolvePlantPlan(input: {
  burnEnabled: boolean;
  burnEveryDays: number;
  burnJitterDays: number;
  burnCommits: number;
  nextBurnDay: string | null;
  today: string;
  forceBurn?: boolean;
  random?: () => number;
}): { count: number; intensity: "light" | "burn"; nextBurnDay: string } {
  const random = input.random ?? Math.random;
  const burnCount = Math.min(20, Math.max(4, Math.floor(input.burnCommits || 8)));
  if (!input.burnEnabled) {
    return { count: 1, intensity: "light", nextBurnDay: input.nextBurnDay || "" };
  }
  let next = input.nextBurnDay;
  if (!next) {
    next = addDaysKey(input.today, nextBurnOffset(input.burnEveryDays, input.burnJitterDays, random));
  }
  const burn = Boolean(input.forceBurn) || input.today >= next;
  if (!burn) {
    return { count: 1, intensity: "light", nextBurnDay: next };
  }
  return {
    count: burnCount,
    intensity: "burn",
    nextBurnDay: addDaysKey(input.today, nextBurnOffset(input.burnEveryDays, input.burnJitterDays, random))
  };
}
