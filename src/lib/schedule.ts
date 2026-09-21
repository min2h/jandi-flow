export function parseHm(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("시간은 HH:mm 형식이어야 합니다");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("시간 범위가 올바르지 않습니다");
  }
  return { hours, minutes };
}

export function toMinutes(value: string): number {
  const { hours, minutes } = parseHm(value);
  return hours * 60 + minutes;
}

export function minutesToHm(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function pickRandomTimeInWindow(
  from: string,
  to: string,
  random = Math.random
): string {
  const start = toMinutes(from);
  let end = toMinutes(to);
  if (end === start) return minutesToHm(start);
  if (end < start) end += 1440;
  const span = end - start;
  const picked = start + Math.floor(random() * (span + 1));
  return minutesToHm(picked);
}

export function cronFromFixedTime(time: string): string {
  const { hours, minutes } = parseHm(time);
  return `${minutes} ${hours} * * *`;
}

export function zonedDateParts(date: Date, timeZone: string): { y: number; m: number; d: number; hh: number; mm: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hh: Number(parts.hour),
    mm: Number(parts.minute)
  };
}

export function isDueNow(
  now: Date,
  timeZone: string,
  targetHm: string,
  lastRunKey: string | null
): { due: boolean; key: string } {
  const parts = zonedDateParts(now, timeZone);
  const key = `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")} ${targetHm}`;
  const current = `${String(parts.hh).padStart(2, "0")}:${String(parts.mm).padStart(2, "0")}`;
  return { due: current === targetHm && lastRunKey !== key, key };
}
