import { describe, expect, it } from "vitest";
import { getAuthRedirectRouteFromUrl } from "./authRedirects";

describe("getAuthRedirectRouteFromUrl", () => {
  it("normalizes two-slash password recovery links", () => {
    expect(
      getAuthRedirectRouteFromUrl(
        "clearn://reset-password?code=abc&type=recovery"
      )
    ).toBe("/reset-password?code=abc&type=recovery");
  });

  it("normalizes triple-slash password recovery links", () => {
    expect(
      getAuthRedirectRouteFromUrl(
        "clearn:///reset-password?code=abc&type=recovery"
      )
    ).toBe("/reset-password?code=abc&type=recovery");
  });

  it("routes recovery callbacks to reset-password", () => {
    expect(
      getAuthRedirectRouteFromUrl(
        "clearn://auth-callback?code=abc&type=recovery"
      )
    ).toBe("/reset-password?code=abc&type=recovery");
  });

  it("preserves auth callback links for regular auth", () => {
    expect(getAuthRedirectRouteFromUrl("clearn://auth-callback?code=abc")).toBe(
      "/auth-callback?code=abc"
    );
  });

  it("ignores unrelated app links", () => {
    expect(getAuthRedirectRouteFromUrl("clearn://deck/123")).toBeNull();
  });
});
