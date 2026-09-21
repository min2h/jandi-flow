import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { createGithubApi } from "./github.js";
import { createGitOps } from "./git-ops.js";
import { startScheduler } from "./scheduler.js";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env") });

function ensureSecret(): string {
  const fromEnv = (process.env.JANDI_SECRET || process.env.JANFI_SECRET || "").trim();
  if (fromEnv) return fromEnv;
  const generated = crypto.randomBytes(32).toString("hex");
  process.env.JANDI_SECRET = generated;
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `JANDI_SECRET=${generated}\nPORT=${process.env.PORT || "8787"}\n`, "utf8");
  }
  return generated;
}

function resolveStorePath(dataDir: string): string {
  const next = path.join(dataDir, "jandi.sqlite");
  const nextJson = path.join(dataDir, "jandi.json");
  const prevJson = path.join(dataDir, "janfi.json");
  if (!fs.existsSync(nextJson) && fs.existsSync(prevJson)) {
    fs.copyFileSync(prevJson, nextJson);
  }
  return next;
}

try {
  const secret = ensureSecret();
  const port = Number(process.env.PORT || 8787);
  const host = (process.env.HOST || "127.0.0.1").trim() || "127.0.0.1";
  const uiUser = (process.env.JANDI_UI_USER || "").trim();
  const uiPass = process.env.JANDI_UI_PASS || "";
  const uiAuth = uiUser && uiPass ? { user: uiUser, pass: uiPass } : undefined;
  if (host !== "127.0.0.1" && host !== "::1" && !uiAuth) {
    throw new Error("HOST가 로컬이 아니면 JANDI_UI_USER / JANDI_UI_PASS 가 필요합니다");
  }
  const dataDir = process.env.JANDI_DATA_DIR || process.env.JANFI_DATA_DIR
    ? path.resolve((process.env.JANDI_DATA_DIR || process.env.JANFI_DATA_DIR) as string)
    : path.join(root, "data");
  const webDir = path.join(root, "dist", "web");

  fs.mkdirSync(dataDir, { recursive: true });

  const db = await openDb(resolveStorePath(dataDir));
  const { app, runAll } = createApp({
    db,
    github: createGithubApi(),
    git: createGitOps(path.join(dataDir, "repos")),
    secret,
    webDir: fs.existsSync(webDir) ? webDir : undefined,
    uiAuth
  });

  const scheduler = startScheduler(db, runAll);

  const server = app.listen(port, host, () => {
    console.log(`jandi-flow listening on http://${host}:${port}`);
  });

  const shutdown = () => {
    scheduler.stop();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("jandi-flow failed to start");
  console.error(error);
  process.exit(1);
}
