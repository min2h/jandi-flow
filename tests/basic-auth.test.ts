import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "../src/lib/basic-auth.js";

const expected = { user: "garden", pass: "gate" };

describe("basic auth", () => {
  it("accepts the matching header", () => {
    const header = `Basic ${Buffer.from("garden:gate").toString("base64")}`;
    expect(checkBasicAuth(header, expected)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const header = `Basic ${Buffer.from("garden:nope").toString("base64")}`;
    expect(checkBasicAuth(header, expected)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(checkBasicAuth(undefined, expected)).toBe(false);
  });
});
