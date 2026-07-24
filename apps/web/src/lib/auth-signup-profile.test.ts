import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(join(webRoot, "src/components/app/auth-form.tsx"), "utf-8").replace(
  /\r\n/g,
  "\n"
);
const oauthStart = src.indexOf("async function handleOAuth");
const oauthEnd = src.indexOf("\n  if (confirmSent)", oauthStart);
const oauthHandler = src.slice(oauthStart, oauthEnd);

describe("Web-Registrierung — Pflichtprofil gilt auch für OAuth", () => {
  it("startet Google oder Apple im Registrierungsmodus erst mit Name und Geschlecht", () => {
    expect(oauthHandler).toContain("if (!isLogin && name.trim().length < 2)");
    expect(oauthHandler).toContain("if (!isLogin && !gender)");
  });

  it("merkt Name und Geschlecht vor dem OAuth-Redirect", () => {
    expect(oauthHandler).toMatch(
      /if \(!isLogin\)[\s\S]{0,300}rememberPendingDisplayName\(name\.trim\(\)\);[\s\S]{0,120}rememberPendingGender\(gender!\);/
    );
    expect(oauthHandler.indexOf("rememberPendingGender")).toBeLessThan(
      oauthHandler.indexOf("signInWithOAuth")
    );
  });
});
