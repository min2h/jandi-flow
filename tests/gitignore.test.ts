import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("secret files stay out of git", () => {
  const ignore = readFileSync(".gitignore", "utf8");

  it("ignores env, data, keys, and node_modules", () => {
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^data\/$/m);
    expect(ignore).toMatch(/^node_modules\/$/m);
    expect(ignore).toMatch(/\*\.pem/);
    expect(ignore).toMatch(/\*\.key/);
  });

  it("example env has no real secret", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("JANFI_SECRET=");
    expect(example).not.toMatch(/JANFI_SECRET=.{8,}/);
    expect(example).not.toContain("ghp_");
  });
});
