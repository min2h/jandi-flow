import { describe, expect, it } from "vitest";
import { parseGithubHttpsUrl, statusFromGitError, statusFromGithubError } from "../src/lib/github-url.js";

describe("parseGithubHttpsUrl", () => {
  it("accepts public https urls with or without .git", () => {
    expect(parseGithubHttpsUrl("https://github.com/min2h/jandi-flow")).toEqual({
      owner: "min2h",
      name: "jandi-flow",
      httpsUrl: "https://github.com/min2h/jandi-flow"
    });
    expect(parseGithubHttpsUrl("https://github.com/min2h/jandi-flow.git/").name).toBe("jandi-flow");
  });

  it("rejects empty, ssh, and non-github urls", () => {
    expect(() => parseGithubHttpsUrl("")).toThrow(/입력/);
    expect(() => parseGithubHttpsUrl("git@github.com:min2h/jandi-flow.git")).toThrow(/SSH/);
    expect(() => parseGithubHttpsUrl("https://gitlab.com/a/b")).toThrow(/HTTPS/);
    expect(() => parseGithubHttpsUrl("not-a-url")).toThrow();
  });
});

describe("status mapping", () => {
  it("maps github http statuses", () => {
    expect(statusFromGithubError(404)).toBe("repo_missing");
    expect(statusFromGithubError(401)).toBe("auth_invalid");
    expect(statusFromGithubError(403)).toBe("auth_invalid");
    expect(statusFromGithubError(500)).toBeNull();
  });

  it("maps git push failures including public key change", () => {
    expect(statusFromGitError("Repository not found")).toBe("repo_missing");
    expect(statusFromGitError("Authentication failed")).toBe("auth_invalid");
    expect(statusFromGitError("Permission denied (publickey)")).toBe("auth_invalid");
    expect(statusFromGitError("protected branch")).toBe("push_denied");
  });
});
