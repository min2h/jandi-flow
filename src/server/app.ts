import path from "node:path";
import express from "express";
import cors from "cors";
import { z } from "zod";
import type { SqliteDb } from "./sqlite.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { parseGithubHttpsUrl } from "../lib/github-url.js";
import { resolvePlantPlan, todayKey } from "../lib/burn.js";
import { pickCommitMessage } from "../lib/messages.js";
import { parseHm } from "../lib/schedule.js";
import type { GithubUser, RepoInfo, RepoStatus, Settings } from "../lib/types.js";
import { getSettings, grassDays, listLogs, listRepos, saveSettings } from "./db.js";
import { GithubHttpError, type GithubApi } from "./github.js";
import { GitOpError, type GitOps } from "./git-ops.js";

export interface AppDeps {
  db: SqliteDb;
  github: GithubApi;
  git: GitOps;
  secret: string;
  webDir?: string;
}

const settingsSchema = z.object({
  scheduleMode: z.enum(["fixed", "random"]),
  fixedTime: z.string(),
  randomFrom: z.string(),
  randomTo: z.string(),
  timezone: z.string().min(1),
  messageMode: z.enum(["fixed", "random"]),
  message: z.string(),
  commitMode: z.enum(["empty", "log"]),
  commitsPerDay: z.number().int().min(1).max(20),
  commitsPerDayMode: z.enum(["fixed", "random"]),
  schedulerEnabled: z.boolean(),
  burnEnabled: z.boolean(),
  burnEveryDays: z.number().int().min(1).max(90),
  burnJitterDays: z.number().int().min(0).max(30),
  burnCommits: z.number().int().min(4).max(20)
});

function nowIso(): string {
  return new Date().toISOString();
}

function httpError(res: express.Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const getSession = () =>
    deps.db.prepare("SELECT * FROM session WHERE id = 1").get() as
      | { login: string; name: string | null; avatar_url: string; email: string | null; token_enc: string }
      | undefined;

  const requireToken = (): { user: GithubUser; token: string } => {
    const session = getSession();
    if (!session) {
      const error = new Error("로그인이 필요합니다");
      (error as Error & { status: number }).status = 401;
      throw error;
    }
    return {
      token: decryptSecret(session.token_enc, deps.secret),
      user: {
        login: session.login,
        name: session.name,
        avatarUrl: session.avatar_url,
        email: session.email,
        id: 0
      }
    };
  };

  const upsertRepo = (info: RepoInfo, status: RepoStatus, error: string | null) => {
    const existing = deps.db.prepare("SELECT id FROM repos WHERE repo_https_url = ?").get(info.htmlUrl) as
      | { id: number }
      | undefined;
    if (existing) {
      deps.db.prepare(`
        UPDATE repos SET
          owner = ?, name = ?, visibility = ?, default_branch = ?,
          status = ?, last_health = ?, last_error = ?
        WHERE id = ?
      `).run(info.owner, info.name, info.visibility, info.defaultBranch, status, nowIso(), error, existing.id);
      return existing.id;
    }
    const result = deps.db.prepare(`
      INSERT INTO repos (
        repo_https_url, owner, name, visibility, default_branch, status, last_health, last_error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(info.htmlUrl, info.owner, info.name, info.visibility, info.defaultBranch, status, nowIso(), error, nowIso());
    return Number(result.lastInsertRowid);
  };

  const healthRepo = async (token: string, owner: string, name: string): Promise<{ info?: RepoInfo; status: RepoStatus; error: string | null }> => {
    try {
      const info = await deps.github.getRepo(token, owner, name);
      if (!info.canPush) {
        return { info, status: "push_denied", error: "이 계정으로 push 권한이 없습니다" };
      }
      return { info, status: "connected", error: null };
    } catch (error) {
      if (error instanceof GithubHttpError && error.mappedStatus) {
        const message =
          error.mappedStatus === "repo_missing"
            ? "레포를 찾을 수 없습니다. 삭제되었거나 URL이 바뀌었습니다"
            : "인증이 만료되었거나 키가 변경되어 연결할 수 없습니다";
        return { status: error.mappedStatus, error: message };
      }
      return { status: "auth_invalid", error: error instanceof Error ? error.message : "연결 검증 실패" };
    }
  };

  const addLog = (repoId: number | null, ok: boolean, message: string) => {
    deps.db.prepare("INSERT INTO job_logs (repo_id, ok, message, created_at) VALUES (?, ?, ?, ?)").run(
      repoId,
      ok ? 1 : 0,
      message,
      nowIso()
    );
  };

  const plantOne = async (repoId: number, forceBurn = false) => {
    const { token, user } = requireToken();
    const repo = deps.db.prepare("SELECT * FROM repos WHERE id = ?").get(repoId) as Record<string, unknown> | undefined;
    if (!repo) throw Object.assign(new Error("연결된 레포가 없습니다"), { status: 404 });
    const owner = String(repo.owner);
    const name = String(repo.name);
    const checked = await healthRepo(token, owner, name);
    deps.db.prepare("UPDATE repos SET status = ?, last_health = ?, last_error = ? WHERE id = ?").run(
      checked.status,
      nowIso(),
      checked.error,
      repoId
    );
    if (checked.status !== "connected" || !checked.info) {
      addLog(repoId, false, checked.error || "연결 검증 실패");
      throw Object.assign(new Error(checked.error || "연결 검증 실패"), { status: 409, mapped: checked.status });
    }
    const settings = getSettings(deps.db);
    const state = deps.db.prepare("SELECT last_run_key, next_random_hm, next_burn_day FROM scheduler_state WHERE id = 1").get() as {
      next_burn_day?: string | null;
    } | undefined;
    const plan = resolvePlantPlan({
      burnEnabled: settings.burnEnabled,
      burnEveryDays: settings.burnEveryDays,
      burnJitterDays: settings.burnJitterDays,
      burnCommits: settings.burnCommits,
      nextBurnDay: state?.next_burn_day || null,
      today: todayKey(new Date(), settings.timezone),
      forceBurn
    });
    deps.db.prepare("UPDATE scheduler_state SET next_burn_day = ? WHERE id = 1").run(plan.nextBurnDay || null);
    const count = plan.count;
    try {
      for (let i = 0; i < count; i += 1) {
        const message = pickCommitMessage(settings.messageMode, settings.message);
        await deps.git.plant({
          token,
          owner,
          name,
          httpsUrl: checked.info.htmlUrl,
          branch: checked.info.defaultBranch,
          user,
          message,
          mode: settings.commitMode
        });
      }
    } catch (error) {
      if (error instanceof GitOpError && error.mappedStatus) {
        deps.db.prepare("UPDATE repos SET status = ?, last_health = ?, last_error = ? WHERE id = ?").run(
          error.mappedStatus,
          nowIso(),
          error.message,
          repoId
        );
      }
      addLog(repoId, false, error instanceof Error ? error.message : "심기 실패");
      throw error;
    }
    deps.db.prepare("UPDATE repos SET last_commit_at = ?, status = 'connected', last_error = NULL WHERE id = ?").run(
      nowIso(),
      repoId
    );
    addLog(
      repoId,
      true,
      plan.intensity === "burn"
        ? `${checked.info.owner}/${checked.info.name} 에 불타는 잔디 ${count}회`
        : `${checked.info.owner}/${checked.info.name} 에 연한 잔디 ${count}회`
    );
  };

  const runAll = async () => {
    const session = getSession();
    if (!session) return;
    const repos = listRepos(deps.db);
    for (const repo of repos) {
      try {
        await plantOne(repo.id);
      } catch {
        // plantOne already writes status + logs
      }
    }
  };

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "jandi-flow" });
  });

  app.post("/api/auth/login", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) return httpError(res, 400, "GitHub PAT를 입력하세요");
    try {
      const user = await deps.github.getUser(token);
      const tokenEnc = encryptSecret(token, deps.secret);
      deps.db.prepare(`
        INSERT INTO session (id, login, name, avatar_url, email, token_enc, created_at)
        VALUES (1, @login, @name, @avatarUrl, @email, @tokenEnc, @createdAt)
        ON CONFLICT(id) DO UPDATE SET
          login = @login, name = @name, avatar_url = @avatarUrl, email = @email, token_enc = @tokenEnc
      `).run({
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        email: user.email,
        tokenEnc,
        createdAt: nowIso()
      });
      res.json({ login: user.login, name: user.name, avatarUrl: user.avatarUrl, email: user.email });
    } catch (error) {
      if (error instanceof GithubHttpError) {
        return httpError(res, error.status === 401 || error.status === 403 ? 401 : 400, "PAT가 유효하지 않습니다");
      }
      return httpError(res, 400, error instanceof Error ? error.message : "로그인 실패");
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    deps.db.prepare("DELETE FROM session WHERE id = 1").run();
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (_req, res) => {
    const session = getSession();
    if (!session) return res.status(401).json({ error: "로그인이 필요합니다" });
    res.json({
      login: session.login,
      name: session.name,
      avatarUrl: session.avatar_url,
      email: session.email
    });
  });

  app.post("/api/repos/create", async (req, res) => {
    try {
      const { token } = requireToken();
      const name = String(req.body?.name || "").trim();
      const visibility = req.body?.visibility === "private" ? "private" : "public";
      const description = String(req.body?.description || "").trim();
      if (!name) return httpError(res, 400, "레포 이름을 입력하세요");
      const info = await deps.github.createRepo(token, { name, visibility, description });
      const checked = info.canPush
        ? { status: "connected" as const, error: null, info }
        : await healthRepo(token, info.owner, info.name);
      const id = upsertRepo(checked.info || info, checked.status, checked.error);
      res.json({ id, repo: listRepos(deps.db).find((item) => item.id === id) });
    } catch (error) {
      if ((error as { status?: number }).status === 401) return httpError(res, 401, "로그인이 필요합니다");
      if (error instanceof GithubHttpError && error.status === 422) {
        return httpError(res, 409, "같은 이름의 레포가 이미 있습니다");
      }
      if (error instanceof GithubHttpError && error.mappedStatus === "auth_invalid") {
        return httpError(res, 401, "레포를 만들 권한이 없습니다");
      }
      return httpError(res, 400, error instanceof Error ? error.message : "레포 생성 실패");
    }
  });

  app.post("/api/repos/connect", async (req, res) => {
    try {
      const { token } = requireToken();
      let parsed;
      try {
        parsed = parseGithubHttpsUrl(String(req.body?.url || ""));
      } catch (error) {
        return httpError(res, 400, error instanceof Error ? error.message : "URL이 올바르지 않습니다");
      }
      const checked = await healthRepo(token, parsed.owner, parsed.name);
      if (!checked.info) {
        return res.status(409).json({ error: checked.error, status: checked.status });
      }
      const info = { ...checked.info, htmlUrl: parsed.httpsUrl };
      const id = upsertRepo(info, checked.status, checked.error);
      if (checked.status !== "connected") {
        return res.status(409).json({
          error: checked.error,
          status: checked.status,
          repo: listRepos(deps.db).find((item) => item.id === id)
        });
      }
      res.json({ id, repo: listRepos(deps.db).find((item) => item.id === id) });
    } catch (error) {
      if ((error as { status?: number }).status === 401) return httpError(res, 401, "로그인이 필요합니다");
      return httpError(res, 400, error instanceof Error ? error.message : "연결 실패");
    }
  });

  app.get("/api/repos", (_req, res) => {
    res.json({ repos: listRepos(deps.db) });
  });

  app.delete("/api/repos/:id", (req, res) => {
    deps.db.prepare("DELETE FROM repos WHERE id = ?").run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/repos/:id/health", async (req, res) => {
    try {
      const { token } = requireToken();
      const repo = deps.db.prepare("SELECT * FROM repos WHERE id = ?").get(Number(req.params.id)) as
        | Record<string, unknown>
        | undefined;
      if (!repo) return httpError(res, 404, "연결된 레포가 없습니다");
      const checked = await healthRepo(token, String(repo.owner), String(repo.name));
      deps.db.prepare("UPDATE repos SET status = ?, last_health = ?, last_error = ? WHERE id = ?").run(
        checked.status,
        nowIso(),
        checked.error,
        Number(req.params.id)
      );
      res.json({ status: checked.status, error: checked.error, repo: listRepos(deps.db).find((item) => item.id === Number(req.params.id)) });
    } catch (error) {
      if ((error as { status?: number }).status === 401) return httpError(res, 401, "로그인이 필요합니다");
      return httpError(res, 400, error instanceof Error ? error.message : "검증 실패");
    }
  });

  app.get("/api/settings", (_req, res) => {
    res.json(getSettings(deps.db));
  });

  app.put("/api/settings", (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return httpError(res, 400, "설정 값이 올바르지 않습니다");
    try {
      parseHm(parsed.data.fixedTime);
      parseHm(parsed.data.randomFrom);
      parseHm(parsed.data.randomTo);
    } catch (error) {
      return httpError(res, 400, error instanceof Error ? error.message : "시간 형식이 올바르지 않습니다");
    }
    const next: Settings = parsed.data;
    res.json(saveSettings(deps.db, next));
  });

  app.get("/api/logs", (_req, res) => {
    const grass = grassDays(deps.db);
    res.json({ logs: listLogs(deps.db), grass: [...grass.light, ...grass.burn], grassBurn: grass.burn });
  });

  app.post("/api/run-now", async (req, res) => {
    try {
      requireToken();
      const repoId = req.body?.repoId ? Number(req.body.repoId) : null;
      const forceBurn = Boolean(req.body?.forceBurn);
      if (repoId) {
        await plantOne(repoId, forceBurn);
      } else {
        const repos = listRepos(deps.db);
        for (const repo of repos) {
          try {
            await plantOne(repo.id, forceBurn);
          } catch {
            // plantOne already writes status + logs
          }
        }
      }
      res.json({ ok: true, repos: listRepos(deps.db), logs: listLogs(deps.db) });
    } catch (error) {
      if ((error as { status?: number }).status === 401) return httpError(res, 401, "로그인이 필요합니다");
      if (error instanceof GitOpError && error.mappedStatus) {
        return res.status(409).json({ error: error.message, status: error.mappedStatus });
      }
      return httpError(res, (error as { status?: number }).status || 400, error instanceof Error ? error.message : "실행 실패");
    }
  });

  if (deps.webDir) {
    app.use(express.static(deps.webDir));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(deps.webDir as string, "index.html"));
    });
  }

  return { app, runAll };
}
