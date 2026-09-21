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
  if (process.env.JANFI_SECRET && process.env.JANFI_SECRET.trim()) {
    return process.env.JANFI_SECRET.trim();
  }
  const generated = crypto.randomBytes(32).toString("hex");
  process.env.JANFI_SECRET = generated;
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `JANFI_SECRET=${generated}\nPORT=${process.env.PORT || "8787"}\n`, "utf8");
  }
  return generated;
}

try {
  const secret = ensureSecret();
  const port = Number(process.env.PORT || 8787);
  const dataDir = process.env.JANFI_DATA_DIR
    ? path.resolve(process.env.JANFI_DATA_DIR)
    : path.join(root, "data");
  const webDir = path.join(root, "dist", "web");

  fs.mkdirSync(dataDir, { recursive: true });

  const db = await openDb(path.join(dataDir, "janfi.sqlite"));
  const { app, runAll } = createApp({
    db,
    github: createGithubApi(),
    git: createGitOps(path.join(dataDir, "repos")),
    secret,
    webDir: fs.existsSync(webDir) ? webDir : undefined
  });

  const scheduler = startScheduler(db, runAll);

  const server = app.listen(port, () => {
    console.log(`janfi-flow listening on http://127.0.0.1:${port}`);
  });

  const shutdown = () => {
    scheduler.stop();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("janfi-flow failed to start");
  console.error(error);
  process.exit(1);
}
