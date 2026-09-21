import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { statusFromGitError } from "../lib/github-url.js";
import type { CommitMode, GithubUser } from "../lib/types.js";

export class GitOpError extends Error {
  mappedStatus: "repo_missing" | "auth_invalid" | "push_denied" | null;

  constructor(message: string) {
    super(message);
    this.mappedStatus = statusFromGitError(message);
  }
}

export interface GitOps {
  plant(input: {
    token: string;
    owner: string;
    name: string;
    httpsUrl: string;
    branch: string;
    user: GithubUser;
    message: string;
    mode: CommitMode;
  }): Promise<void>;
}

function authRemote(httpsUrl: string, token: string): string {
  return httpsUrl.replace("https://", `https://x-access-token:${token}@`);
}

export function createGitOps(reposRoot: string): GitOps {
  return {
    async plant({ token, owner, name, httpsUrl, branch, user, message, mode }) {
      const dir = path.join(reposRoot, owner, name);
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      const remote = authRemote(httpsUrl, token);
      const git = simpleGit();
      try {
        if (!fs.existsSync(path.join(dir, ".git"))) {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
          await git.clone(remote, dir);
        }
        const repo = simpleGit(dir);
        await repo.addConfig("user.name", user.name || user.login);
        await repo.addConfig("user.email", user.email || `${user.login}@users.noreply.github.com`);
        await repo.addConfig("user.useConfigOnly", "true");
        await repo.remote(["set-url", "origin", remote]);
        await repo.fetch();
        const branches = await repo.branch();
        const target = branch || branches.current || "main";
        try {
          await repo.checkout(target);
        } catch {
          await repo.checkout(["-B", target]);
        }
        await repo.pull("origin", target).catch(() => undefined);

        if (mode === "log") {
          const gardenDir = path.join(dir, ".janfi");
          fs.mkdirSync(gardenDir, { recursive: true });
          const logPath = path.join(gardenDir, "garden.log");
          fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
          await repo.add(".janfi/garden.log");
          await repo.commit(message);
        } else {
          await repo.commit(message, ["--allow-empty"]);
        }
        await repo.push("origin", target);
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        throw new GitOpError(text);
      } finally {
        if (fs.existsSync(path.join(dir, ".git"))) {
          try {
            await simpleGit(dir).remote(["set-url", "origin", httpsUrl]);
          } catch {
            // keep local repo usable even if cleanup fails
          }
        }
      }
    }
  };
}
