import { timingSafeEqual } from "node:crypto";

export interface UiAuth {
  user: string;
  pass: string;
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkBasicAuth(header: string | undefined, expected: UiAuth): boolean {
  if (!header || !header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return same(decoded.slice(0, sep), expected.user) && same(decoded.slice(sep + 1), expected.pass);
}
