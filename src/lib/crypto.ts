import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "jdv1";
const LEGACY_PREFIX = "jfv1";
const SALT = "jandi-flow-v1";
const LEGACY_SALT = "janfi-flow-v1";

function deriveKey(secret: string, salt = SALT): Buffer {
  return scryptSync(secret, salt, 32);
}

export function encryptSecret(plain: string, secret: string): string {
  if (!plain) throw new Error("암호화할 값이 없습니다");
  if (!secret) throw new Error("JANDI_SECRET이 필요합니다");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string, secret: string): string {
  if (!payload) throw new Error("복호화할 값이 없습니다");
  if (!secret) throw new Error("JANDI_SECRET이 필요합니다");
  const [prefix, ivB64, tagB64, dataB64] = payload.split(".");
  if ((prefix !== PREFIX && prefix !== LEGACY_PREFIX) || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("토큰 형식이 올바르지 않습니다");
  }
  const salt = prefix === LEGACY_PREFIX ? LEGACY_SALT : SALT;
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, salt), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
