import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/lib/crypto.js";

describe("crypto", () => {
  it("encrypts and decrypts a PAT", () => {
    const enc = encryptSecret("ghp_example_token", "super-secret");
    expect(enc.startsWith("jfv1.")).toBe(true);
    expect(enc).not.toContain("ghp_example_token");
    expect(decryptSecret(enc, "super-secret")).toBe("ghp_example_token");
  });

  it("rejects wrong secret", () => {
    const enc = encryptSecret("ghp_example_token", "super-secret");
    expect(() => decryptSecret(enc, "other")).toThrow();
  });

  it("rejects empty values", () => {
    expect(() => encryptSecret("", "x")).toThrow();
    expect(() => encryptSecret("tok", "")).toThrow();
    expect(() => decryptSecret("bad", "x")).toThrow();
  });
});
