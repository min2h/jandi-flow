import { DEFAULT_SETTINGS, type ConnectedRepo, type JobLog, type Settings } from "../lib/types.js";
import { createSqlite, type SqliteDb } from "./sqlite.js";

export interface SessionRow {
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
  token_enc: string;
}

export async function openDb(dbPath: string): Promise<SqliteDb> {
  const db = await createSqlite(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      login TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT NOT NULL,
      email TEXT,
      token_enc TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_https_url TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      status TEXT NOT NULL,
      last_health TEXT,
      last_error TEXT,
      last_commit_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schedule_mode TEXT NOT NULL,
      fixed_time TEXT NOT NULL,
      random_from TEXT NOT NULL,
      random_to TEXT NOT NULL,
      timezone TEXT NOT NULL,
      message_mode TEXT NOT NULL,
      message TEXT NOT NULL,
      commit_mode TEXT NOT NULL,
      commits_per_day INTEGER NOT NULL,
      commits_per_day_mode TEXT NOT NULL,
      scheduler_enabled INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER,
      ok INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduler_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_run_key TEXT,
      next_random_hm TEXT
    );
  `);
  const settings = db.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (!settings) {
    db.prepare(`
      INSERT INTO settings (
        id, schedule_mode, fixed_time, random_from, random_to, timezone,
        message_mode, message, commit_mode, commits_per_day, commits_per_day_mode, scheduler_enabled
      ) VALUES (1, @scheduleMode, @fixedTime, @randomFrom, @randomTo, @timezone,
        @messageMode, @message, @commitMode, @commitsPerDay, @commitsPerDayMode, @schedulerEnabled)
    `).run({
      ...DEFAULT_SETTINGS,
      schedulerEnabled: DEFAULT_SETTINGS.schedulerEnabled ? 1 : 0
    });
  }
  const state = db.prepare("SELECT id FROM scheduler_state WHERE id = 1").get();
  if (!state) {
    db.prepare("INSERT INTO scheduler_state (id, last_run_key, next_random_hm) VALUES (1, NULL, NULL)").run();
  }
  return db;
}

export function rowToRepo(row: Record<string, unknown>): ConnectedRepo {
  return {
    id: Number(row.id),
    repoHttpsUrl: String(row.repo_https_url),
    owner: String(row.owner),
    name: String(row.name),
    visibility: row.visibility === "private" ? "private" : "public",
    defaultBranch: String(row.default_branch),
    status: row.status as ConnectedRepo["status"],
    lastHealth: (row.last_health as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    lastCommitAt: (row.last_commit_at as string | null) ?? null,
    createdAt: String(row.created_at)
  };
}

export function getSettings(db: SqliteDb): Settings {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, unknown>;
  return {
    scheduleMode: row.schedule_mode === "random" ? "random" : "fixed",
    fixedTime: String(row.fixed_time),
    randomFrom: String(row.random_from),
    randomTo: String(row.random_to),
    timezone: String(row.timezone),
    messageMode: row.message_mode === "fixed" ? "fixed" : "random",
    message: String(row.message),
    commitMode: row.commit_mode === "log" ? "log" : "empty",
    commitsPerDay: Number(row.commits_per_day),
    commitsPerDayMode: row.commits_per_day_mode === "random" ? "random" : "fixed",
    schedulerEnabled: Boolean(row.scheduler_enabled),
    burnEnabled: Boolean(row.burn_enabled),
    burnEveryDays: Number(row.burn_every_days || 7),
    burnJitterDays: Number(row.burn_jitter_days ?? 2),
    burnCommits: Number(row.burn_commits || 8)
  };
}

export function saveSettings(db: SqliteDb, settings: Settings): Settings {
  db.prepare(`
    UPDATE settings SET
      schedule_mode = @scheduleMode,
      fixed_time = @fixedTime,
      random_from = @randomFrom,
      random_to = @randomTo,
      timezone = @timezone,
      message_mode = @messageMode,
      message = @message,
      commit_mode = @commitMode,
      commits_per_day = @commitsPerDay,
      commits_per_day_mode = @commitsPerDayMode,
      scheduler_enabled = @schedulerEnabled,
      burn_enabled = @burnEnabled,
      burn_every_days = @burnEveryDays,
      burn_jitter_days = @burnJitterDays,
      burn_commits = @burnCommits
    WHERE id = 1
  `).run({
    ...settings,
    schedulerEnabled: settings.schedulerEnabled ? 1 : 0,
    burnEnabled: settings.burnEnabled ? 1 : 0
  });
  return getSettings(db);
}

export function listRepos(db: SqliteDb): ConnectedRepo[] {
  return db.prepare("SELECT * FROM repos ORDER BY id DESC").all().map((row) => rowToRepo(row as Record<string, unknown>));
}

export function listLogs(db: SqliteDb, limit = 40): JobLog[] {
  return db.prepare("SELECT * FROM job_logs ORDER BY id DESC LIMIT ?").all(limit).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: Number(row.id),
      repoId: row.repo_id == null ? null : Number(row.repo_id),
      ok: Boolean(row.ok),
      message: String(row.message),
      createdAt: String(row.created_at)
    };
  });
}

export function grassDays(db: SqliteDb): { light: string[]; burn: string[] } {
  const rows = db.prepare(
    "SELECT message, substr(created_at, 1, 10) AS day FROM job_logs WHERE ok = 1"
  ).all() as Array<{ message: string; day: string }>;
  const burn = new Set<string>();
  const light = new Set<string>();
  for (const row of rows) {
    if (String(row.message).includes("불타는")) burn.add(row.day);
    else light.add(row.day);
  }
  return { light: [...light], burn: [...burn] };
}
