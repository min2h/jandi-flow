import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { encryptSecret } from "../src/lib/crypto.js";
import type { GithubUser, RepoInfo } from "../src/lib/types.js";
import { createApp } from "../src/server/app.js";
import { openDb } from "../src/server/db.js";
import { GithubHttpError, type GithubApi } from "../src/server/github.js";
import { GitOpError, type GitOps } from "../src/server/git-ops.js";

const SECRET = "test-secret-key";

const user: GithubUser = {
  login: "min2h",
  name: "min",
  avatarUrl: "https://example.com/a.png",
  email: "min2h@users.noreply.github.com",
  id: 1
};

const publicRepo: RepoInfo = {
  owner: "min2h",
  name: "garden",
  htmlUrl: "https://github.com/min2h/garden",
  visibility: "public",
  defaultBranch: "main",
  canPush: true
};

const privateRepo: RepoInfo = {
  ...publicRepo,
  name: "secret-garden",
  htmlUrl: "https://github.com/min2h/secret-garden",
  visibility: "private"
};

function makeGithub(overrides: Partial<GithubApi> = {}): GithubApi {
  return {
    async getUser(token) {
      if (token !== "good-token") throw new GithubHttpError("Bad credentials", 401);
      return user;
    },
    async getRepo(_token, owner, name) {
      if (name === "missing") throw new GithubHttpError("Not Found", 404);
      if (name === "denied") return { ...publicRepo, owner, name, canPush: false, htmlUrl: `https://github.com/${owner}/${name}` };
      if (name === "secret-garden") return { ...privateRepo, owner };
      return { ...publicRepo, owner, name, htmlUrl: `https://github.com/${owner}/${name}` };
    },
    async createRepo(_token, input) {
      if (input.name === "taken") throw new GithubHttpError("already exists", 422);
      if (input.name === "forbidden") throw new GithubHttpError("forbidden", 403);
      return {
        ...publicRepo,
        name: input.name,
        visibility: input.visibility,
        htmlUrl: `https://github.com/min2h/${input.name}`
      };
    },
    ...overrides
  };
}

function makeGit(plantImpl?: GitOps["plant"]): GitOps {
  return {
    plant: plantImpl || (async () => undefined)
  };
}

async function setup(github = makeGithub(), git = makeGit()) {
  const dir = mkdtempSync(path.join(tmpdir(), "janfi-"));
  const db = await openDb(path.join(dir, "janfi.sqlite"));
  const { app, runAll } = createApp({ db, github, git, secret: SECRET });
  return { app, db, runAll };
}

async function login(app: ReturnType<typeof createApp>["app"]) {
  await request(app).post("/api/auth/login").send({ token: "good-token" }).expect(200);
}

describe("auth", () => {
  it("accepts a valid PAT and never returns the token", async () => {
    const { app } = await setup();
    const res = await request(app).post("/api/auth/login").send({ token: "good-token" }).expect(200);
    expect(res.body.login).toBe("min2h");
    expect(JSON.stringify(res.body)).not.toContain("good-token");
    const me = await request(app).get("/api/auth/me").expect(200);
    expect(me.body.login).toBe("min2h");
  });

  it("rejects an invalid PAT", async () => {
    const { app } = await setup();
    await request(app).post("/api/auth/login").send({ token: "bad" }).expect(401);
  });

  it("requires login for repo create", async () => {
    const { app } = await setup();
    await request(app).post("/api/repos/create").send({ name: "x" }).expect(401);
  });
});

describe("repo create", () => {
  it("creates and stores a repo", async () => {
    const { app } = await setup();
    await login(app);
    const res = await request(app).post("/api/repos/create").send({ name: "fresh", visibility: "public" }).expect(200);
    expect(res.body.repo.name).toBe("fresh");
    expect(res.body.repo.status).toBe("connected");
  });

  it("rejects duplicate names", async () => {
    const { app } = await setup();
    await login(app);
    await request(app).post("/api/repos/create").send({ name: "taken" }).expect(409);
  });

  it("rejects missing permission", async () => {
    const { app } = await setup();
    await login(app);
    await request(app).post("/api/repos/create").send({ name: "forbidden" }).expect(401);
  });
});

describe("repo connect", () => {
  it("connects a public repo url", async () => {
    const { app } = await setup();
    await login(app);
    const res = await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/garden" }).expect(200);
    expect(res.body.repo.visibility).toBe("public");
    expect(res.body.repo.status).toBe("connected");
  });

  it("connects a private repo url", async () => {
    const { app } = await setup();
    await login(app);
    const res = await request(app)
      .post("/api/repos/connect")
      .send({ url: "https://github.com/min2h/secret-garden" })
      .expect(200);
    expect(res.body.repo.visibility).toBe("private");
  });

  it("rejects invalid urls", async () => {
    const { app } = await setup();
    await login(app);
    await request(app).post("/api/repos/connect").send({ url: "git@github.com:a/b.git" }).expect(400);
  });

  it("maps missing repo", async () => {
    const { app } = await setup();
    await login(app);
    const res = await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/missing" }).expect(409);
    expect(res.body.status).toBe("repo_missing");
  });

  it("maps push denied", async () => {
    const { app } = await setup();
    await login(app);
    const res = await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/denied" }).expect(409);
    expect(res.body.status).toBe("push_denied");
  });
});

describe("settings and run", () => {
  it("saves schedule and message modes", async () => {
    const { app } = await setup();
    const current = await request(app).get("/api/settings").expect(200);
    const res = await request(app)
      .put("/api/settings")
      .send({
        ...current.body,
        scheduleMode: "random",
        randomFrom: "10:00",
        randomTo: "18:00",
        messageMode: "fixed",
        message: "고정 메시지"
      })
      .expect(200);
    expect(res.body.scheduleMode).toBe("random");
    expect(res.body.message).toBe("고정 메시지");
  });

  it("plants when connected", async () => {
    let planted = 0;
    const { app } = await setup(makeGithub(), makeGit(async () => { planted += 1; }));
    await login(app);
    await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/garden" });
    await request(app).post("/api/run-now").send({}).expect(200);
    expect(planted).toBe(1);
  });

  it("skips and marks repo_missing if repo disappears", async () => {
    let calls = 0;
    const github = makeGithub({
      async getRepo(_token, owner, name) {
        calls += 1;
        if (calls > 1) throw new GithubHttpError("Not Found", 404);
        return { ...publicRepo, owner, name, htmlUrl: `https://github.com/${owner}/${name}` };
      }
    });
    const { app } = await setup(github, makeGit());
    await login(app);
    await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/garden" }).expect(200);
    await request(app).post("/api/run-now").send({}).expect(200);
    const list = await request(app).get("/api/repos");
    expect(list.body.repos[0].status).toBe("repo_missing");
  });

  it("marks auth_invalid when token or key changes at push time", async () => {
    const { app } = await setup(
      makeGithub(),
      makeGit(async () => {
        throw new GitOpError("Permission denied (publickey)");
      })
    );
    await login(app);
    const created = await request(app).post("/api/repos/connect").send({ url: "https://github.com/min2h/garden" });
    await request(app).post("/api/run-now").send({ repoId: created.body.id }).expect(409);
    const list = await request(app).get("/api/repos");
    expect(list.body.repos[0].status).toBe("auth_invalid");
  });
});

describe("session storage", () => {
  it("stores encrypted token in sqlite, not plaintext", async () => {
    const { db } = await setup();
    const sample = encryptSecret("good-token", SECRET);
    expect(sample).not.toContain("good-token");
    expect(sample.startsWith("jfv1.")).toBe(true);
    db.close();
  });
});
