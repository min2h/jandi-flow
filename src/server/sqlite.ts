import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;

interface TableData {
  [table: string]: Row[];
}

export interface Statement {
  run(...params: unknown[]): { lastInsertRowid: number; changes: number };
  get(...params: unknown[]): Row | undefined;
  all(...params: unknown[]): Row[];
}

export interface SqliteDb {
  exec(sql: string): void;
  pragma(_value: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

function asObject(params: unknown[]): Row {
  if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0])) {
    return params[0] as Row;
  }
  return {};
}

function positional(params: unknown[]): unknown[] {
  if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0])) {
    return [];
  }
  return params;
}

export async function createSqlite(dbPath: string): Promise<SqliteDb> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const jsonPath = dbPath.endsWith(".sqlite") ? dbPath.replace(/\.sqlite$/, ".json") : `${dbPath}.json`;
  const tables: TableData = fs.existsSync(jsonPath)
    ? JSON.parse(fs.readFileSync(jsonPath, "utf8")) as TableData
    : {
        session: [],
        repos: [],
        settings: [],
        job_logs: [],
        scheduler_state: []
      };

  const persist = () => {
    fs.writeFileSync(jsonPath, JSON.stringify(tables, null, 2));
  };

  const nextId = (name: string) => {
    const rows = tables[name] || [];
    return rows.reduce((max, row) => Math.max(max, Number(row.id || 0)), 0) + 1;
  };

  return {
    exec() {
      return undefined;
    },
    pragma() {
      return undefined;
    },
    prepare(sql: string): Statement {
      const text = sql.replace(/\s+/g, " ").trim();
      return {
        run(...params: unknown[]) {
          const named = asObject(params);
          const values = positional(params);
          if (text.startsWith("INSERT INTO session")) {
            tables.session = [{
              id: 1,
              login: named.login,
              name: named.name,
              avatar_url: named.avatarUrl,
              email: named.email,
              token_enc: named.tokenEnc,
              created_at: named.createdAt
            }];
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("INSERT INTO repos")) {
            const id = nextId("repos");
            tables.repos = tables.repos || [];
            tables.repos.push({
              id,
              repo_https_url: values[0],
              owner: values[1],
              name: values[2],
              visibility: values[3],
              default_branch: values[4],
              status: values[5],
              last_health: values[6],
              last_error: values[7],
              last_commit_at: null,
              created_at: values[8]
            });
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }
          if (text.startsWith("INSERT INTO settings")) {
            tables.settings = [{
              id: 1,
              schedule_mode: named.scheduleMode,
              fixed_time: named.fixedTime,
              random_from: named.randomFrom,
              random_to: named.randomTo,
              timezone: named.timezone,
              message_mode: named.messageMode,
              message: named.message,
              commit_mode: named.commitMode,
              commits_per_day: named.commitsPerDay,
              commits_per_day_mode: named.commitsPerDayMode,
              scheduler_enabled: named.schedulerEnabled
            }];
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("INSERT INTO scheduler_state")) {
            tables.scheduler_state = [{ id: 1, last_run_key: null, next_random_hm: null }];
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("INSERT INTO job_logs")) {
            const id = nextId("job_logs");
            tables.job_logs = tables.job_logs || [];
            tables.job_logs.push({
              id,
              repo_id: values[0],
              ok: values[1],
              message: values[2],
              created_at: values[3]
            });
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }
          if (text.startsWith("UPDATE settings")) {
            tables.settings[0] = {
              ...(tables.settings[0] || { id: 1 }),
              schedule_mode: named.scheduleMode,
              fixed_time: named.fixedTime,
              random_from: named.randomFrom,
              random_to: named.randomTo,
              timezone: named.timezone,
              message_mode: named.messageMode,
              message: named.message,
              commit_mode: named.commitMode,
              commits_per_day: named.commitsPerDay,
              commits_per_day_mode: named.commitsPerDayMode,
              scheduler_enabled: named.schedulerEnabled
            };
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("UPDATE scheduler_state SET last_run_key")) {
            tables.scheduler_state[0] = {
              ...(tables.scheduler_state[0] || { id: 1 }),
              last_run_key: values[0]
            };
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("UPDATE scheduler_state SET next_random_hm")) {
            tables.scheduler_state[0] = {
              ...(tables.scheduler_state[0] || { id: 1 }),
              next_random_hm: values[0]
            };
            persist();
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (text.startsWith("UPDATE repos SET owner")) {
            const id = Number(values[7]);
            tables.repos = (tables.repos || []).map((row) =>
              Number(row.id) === id
                ? {
                    ...row,
                    owner: values[0],
                    name: values[1],
                    visibility: values[2],
                    default_branch: values[3],
                    status: values[4],
                    last_health: values[5],
                    last_error: values[6]
                  }
                : row
            );
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }
          if (text.startsWith("UPDATE repos SET status")) {
            const id = Number(values[3]);
            tables.repos = (tables.repos || []).map((row) =>
              Number(row.id) === id
                ? { ...row, status: values[0], last_health: values[1], last_error: values[2] }
                : row
            );
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }
          if (text.startsWith("UPDATE repos SET last_commit_at")) {
            const id = Number(values[1]);
            tables.repos = (tables.repos || []).map((row) =>
              Number(row.id) === id
                ? { ...row, last_commit_at: values[0], status: "connected", last_error: null }
                : row
            );
            persist();
            return { lastInsertRowid: id, changes: 1 };
          }
          if (text.startsWith("DELETE FROM session")) {
            tables.session = [];
            persist();
            return { lastInsertRowid: 0, changes: 1 };
          }
          if (text.startsWith("DELETE FROM repos")) {
            const id = Number(values[0]);
            tables.repos = (tables.repos || []).filter((row) => Number(row.id) !== id);
            persist();
            return { lastInsertRowid: 0, changes: 1 };
          }
          throw new Error(`지원하지 않는 write SQL: ${text}`);
        },
        get(...params: unknown[]) {
          const values = positional(params);
          if (text.startsWith("SELECT * FROM session") || text.startsWith("SELECT * FROM session WHERE id = 1")) {
            return tables.session?.[0];
          }
          if (text.startsWith("SELECT id FROM settings")) {
            return tables.settings?.[0] ? { id: 1 } : undefined;
          }
          if (text.startsWith("SELECT id FROM scheduler_state")) {
            return tables.scheduler_state?.[0] ? { id: 1 } : undefined;
          }
          if (text.startsWith("SELECT * FROM settings")) {
            return tables.settings?.[0];
          }
          if (text.startsWith("SELECT last_run_key")) {
            return tables.scheduler_state?.[0];
          }
          if (text.startsWith("SELECT id FROM repos WHERE repo_https_url")) {
            const found = (tables.repos || []).find((row) => row.repo_https_url === values[0]);
            return found ? { id: found.id } : undefined;
          }
          if (text.startsWith("SELECT * FROM repos WHERE id")) {
            return (tables.repos || []).find((row) => Number(row.id) === Number(values[0]));
          }
          return undefined;
        },
        all(...params: unknown[]) {
          const values = positional(params);
          if (text.startsWith("SELECT * FROM repos")) {
            return [...(tables.repos || [])].sort((a, b) => Number(b.id) - Number(a.id));
          }
          if (text.startsWith("SELECT * FROM job_logs")) {
            const limit = Number(values[0] ?? 40);
            return [...(tables.job_logs || [])].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit);
          }
          if (text.includes("FROM job_logs WHERE ok = 1")) {
            const days = new Set(
              (tables.job_logs || [])
                .filter((row) => Number(row.ok) === 1)
                .map((row) => String(row.created_at).slice(0, 10))
            );
            return [...days].map((day) => ({ day }));
          }
          return [];
        }
      };
    },
    close() {
      persist();
    }
  };
}
