import { Octokit } from "@octokit/rest";
import { statusFromGithubError } from "../lib/github-url.js";
import type { GithubUser, RepoInfo, Visibility } from "../lib/types.js";

export class GithubHttpError extends Error {
  status?: number;
  mappedStatus: "repo_missing" | "auth_invalid" | null;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.mappedStatus = statusFromGithubError(status);
  }
}

export interface GithubApi {
  getUser(token: string): Promise<GithubUser>;
  getRepo(token: string, owner: string, name: string): Promise<RepoInfo>;
  createRepo(token: string, input: { name: string; visibility: Visibility; description?: string }): Promise<RepoInfo>;
}

function unwrap(error: unknown): GithubHttpError {
  const err = error as { status?: number; message?: string };
  return new GithubHttpError(err.message || "GitHub API 오류", err.status);
}

function toRepo(data: {
  owner?: { login: string } | null;
  name: string;
  html_url: string;
  private?: boolean;
  visibility?: string;
  default_branch?: string;
  permissions?: { push?: boolean };
}): RepoInfo {
  const visibility: Visibility = data.private || data.visibility === "private" ? "private" : "public";
  return {
    owner: data.owner?.login || "",
    name: data.name,
    htmlUrl: data.html_url.replace(/\.git$/, ""),
    visibility,
    defaultBranch: data.default_branch || "main",
    canPush: Boolean(data.permissions?.push)
  };
}

export function createGithubApi(): GithubApi {
  return {
    async getUser(token) {
      const octokit = new Octokit({ auth: token });
      try {
        const { data } = await octokit.users.getAuthenticated();
        let email = data.email;
        if (!email) {
          try {
            const emails = await octokit.request("GET /user/emails");
            const primary = (emails.data as Array<{ email: string; primary: boolean; verified: boolean }>)
              .find((item) => item.primary && item.verified);
            email = primary?.email ?? null;
          } catch {
            email = `${data.login}@users.noreply.github.com`;
          }
        }
        return {
          login: data.login,
          name: data.name,
          avatarUrl: data.avatar_url,
          email: email || `${data.login}@users.noreply.github.com`,
          id: data.id
        };
      } catch (error) {
        throw unwrap(error);
      }
    },
    async getRepo(token, owner, name) {
      const octokit = new Octokit({ auth: token });
      try {
        const { data } = await octokit.repos.get({ owner, repo: name });
        return toRepo(data);
      } catch (error) {
        throw unwrap(error);
      }
    },
    async createRepo(token, input) {
      const octokit = new Octokit({ auth: token });
      try {
        const { data } = await octokit.repos.createForAuthenticatedUser({
          name: input.name,
          private: input.visibility === "private",
          description: input.description || "janfi-flow garden",
          auto_init: true
        });
        return toRepo(data);
      } catch (error) {
        throw unwrap(error);
      }
    }
  };
}
