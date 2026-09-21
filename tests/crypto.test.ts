import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/lib/crypto.js";

function encryptLegacy(plain: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "janfi-flow-v1", 32), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["jfv1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

describe("crypto", () => {
  it("encrypts and decrypts a PAT", () => {
    const enc = encryptSecret("ghp_example_token", "super-secret");
    expect(enc.startsWith("jdv1.")).toBe(true);
    expect(enc).not.toContain("ghp_example_token");
    expect(decryptSecret(enc, "super-secret")).toBe("ghp_example_token");
  });

  it("decrypts legacy jfv1 tokens", () => {
    const enc = encryptLegacy("ghp_legacy_token", "super-secret");
    expect(decryptSecret(enc, "super-secret")).toBe("ghp_legacy_token");
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
