export interface ParsedGithubUrl {
  owner: string;
  name: string;
  httpsUrl: string;
}

const GITHUB_HTTPS =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;

export function parseGithubHttpsUrl(raw: string): ParsedGithubUrl {
  const value = raw.trim();
  if (!value) {
    throw new Error("레포 URL을 입력하세요");
  }
  if (value.startsWith("git@") || value.startsWith("ssh://")) {
    throw new Error("SSH URL은 지원하지 않습니다. HTTPS URL을 입력하세요");
  }
  const match = value.match(GITHUB_HTTPS);
  if (!match) {
    throw new Error("GitHub HTTPS URL만 연결할 수 있습니다. 예: https://github.com/owner/repo");
  }
  const owner = match[1];
  const name = match[2];
  if (owner.toLowerCase() === "orgs" || name.toLowerCase() === "settings") {
    throw new Error("올바른 저장소 URL이 아닙니다");
  }
  return {
    owner,
    name,
    httpsUrl: `https://github.com/${owner}/${name}`
  };
}

export function statusFromGithubError(status: number | undefined): "repo_missing" | "auth_invalid" | null {
  if (status === 404) return "repo_missing";
  if (status === 401 || status === 403) return "auth_invalid";
  return null;
}

export function statusFromGitError(message: string): "repo_missing" | "auth_invalid" | "push_denied" | null {
  const text = message.toLowerCase();
  if (text.includes("repository not found") || text.includes("not found")) {
    return "repo_missing";
  }
  if (
    text.includes("authentication failed") ||
    text.includes("invalid username") ||
    text.includes("bad credentials") ||
    text.includes("could not read username") ||
    text.includes("permission denied") && text.includes("publickey")
  ) {
    return "auth_invalid";
  }
  if (text.includes("permission denied") || text.includes("protected branch") || text.includes("read-only")) {
    return "push_denied";
  }
  return null;
}
