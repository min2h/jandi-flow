import { describe, expect, it } from "vitest";
import { pickCommitMessage, resolveCommitCount } from "../src/lib/messages.js";
import { RANDOM_MESSAGES } from "../src/lib/types.js";

describe("messages", () => {
  it("returns fixed message", () => {
    expect(pickCommitMessage("fixed", "hello grass")).toBe("hello grass");
  });

  it("rejects empty fixed message", () => {
    expect(() => pickCommitMessage("fixed", "   ")).toThrow();
  });

  it("picks a random catalog message", () => {
    const msg = pickCommitMessage("random", "ignored", () => 0);
    expect(RANDOM_MESSAGES).toContain(msg);
    expect(msg).toBe(RANDOM_MESSAGES[0]);
  });
});

describe("commit count", () => {
  it("uses fixed count clamped 1-20", () => {
    expect(resolveCommitCount("fixed", 3)).toBe(3);
    expect(resolveCommitCount("fixed", 0)).toBe(1);
    expect(resolveCommitCount("fixed", 99)).toBe(20);
  });

  it("uses random count in range", () => {
    expect(resolveCommitCount("random", 5, () => 0)).toBe(1);
    expect(resolveCommitCount("random", 5, () => 0.99)).toBe(5);
  });
});
