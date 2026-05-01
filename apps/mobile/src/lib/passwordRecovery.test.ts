import { describe, expect, it } from "vitest";
import {
  getPasswordRecoverySessionId,
  isPasswordRecoverySession,
} from "./passwordRecovery";

function base64UrlEncodeJson(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeToken(payload: unknown) {
  return [
    base64UrlEncodeJson({ alg: "none" }),
    base64UrlEncodeJson(payload),
    "signature",
  ].join(".");
}

describe("password recovery session detection", () => {
  it("detects Supabase recovery sessions from JWT amr", () => {
    const accessToken = makeToken({
      amr: [{ method: "recovery", timestamp: 1777453241 }],
      session_id: "session-123",
    });

    expect(getPasswordRecoverySessionId({ access_token: accessToken })).toBe(
      "session-123"
    );
    expect(isPasswordRecoverySession({ access_token: accessToken })).toBe(true);
  });

  it("ignores regular authenticated sessions", () => {
    const accessToken = makeToken({
      amr: [{ method: "password", timestamp: 1777453241 }],
      session_id: "session-123",
    });

    expect(getPasswordRecoverySessionId({ access_token: accessToken })).toBeNull();
    expect(isPasswordRecoverySession({ access_token: accessToken })).toBe(false);
  });

  it("ignores malformed access tokens", () => {
    expect(getPasswordRecoverySessionId({ access_token: "not-a-jwt" })).toBeNull();
  });
});
