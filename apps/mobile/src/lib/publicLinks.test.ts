import { describe, expect, it } from "vitest";
import {
  IMPRESSUM_URL,
  PRIVACY_URL,
  PUBLIC_WEB_URL,
  SUPPORT_URL,
} from "./publicLinks";

describe("public links", () => {
  it("uses the canonical marketing web origin for public release links", () => {
    expect(PUBLIC_WEB_URL).toBe("https://clearn-web.vercel.app");
    expect(SUPPORT_URL).toBe(`${PUBLIC_WEB_URL}/support`);
    expect(PRIVACY_URL).toBe(`${PUBLIC_WEB_URL}/privacy`);
    expect(IMPRESSUM_URL).toBe(`${PUBLIC_WEB_URL}/impressum`);
  });

  it("does not point public users to an unconfigured clearn.app domain", () => {
    const allLinks = [PUBLIC_WEB_URL, SUPPORT_URL, PRIVACY_URL, IMPRESSUM_URL].join("\n");

    expect(allLinks).not.toContain("clearn.app");
  });
});
