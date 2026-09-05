import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const appDir = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(resolve(tmpdir(), "clearn-release-test-"));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));
const values = (platform: "ios" | "android") => ({
  [`EXPO_PUBLIC_ADMOB_APP_${platform.toUpperCase()}_ID`]: "ca-app-pub-1234567890123456~1234567890",
  [`EXPO_PUBLIC_ADMOB_REWARDED_${platform.toUpperCase()}_ID`]: "ca-app-pub-1234567890123456/1234567890",
  [`EXPO_PUBLIC_REVENUECAT_${platform.toUpperCase()}_API_KEY`]: platform === "ios" ? "appl_fixture123" : "goog_fixture123",
});
function run(args: string[], vars: Record<string, string> = {}, cwd = appDir) {
  // Never inherit real release keys or local evidence from the host.
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH, APP_VARIANT: "production", ...vars },
  });
}
function config(vars: Record<string, string>) {
  return run(["-e", "const c=require('./app.config.js')({config:{}}); console.log(JSON.stringify(c))"], vars);
}
function submit(platform?: string, vars = platform === "android" ? values("android") : values("ios")) {
  const eas = JSON.parse(readFileSync(resolve(appDir, "eas.json"), "utf8"));
  eas.submit.production.android.serviceAccountKeyPath = "account.json";
  if (platform === "android") writeFileSync(resolve(tempDir, "account.json"), "{}");
  else rmSync(resolve(tempDir, "account.json"), { force: true });
  writeFileSync(resolve(tempDir, "eas.json"), JSON.stringify(eas));
  return run([resolve(appDir, "scripts/check-submit-config.mjs"), ...(platform ? ["--platform", platform] : [])], vars, tempDir);
}
function dashboard(platform?: string, missingField?: string) {
  const data = JSON.parse(readFileSync(resolve(appDir, "dashboard-readiness.example.json"), "utf8"));
  if (platform === "ios") { delete data.googlePlay; delete data.revenueCat.androidAppConfigured; }
  if (platform === "android") { delete data.appStoreConnect; delete data.revenueCat.iosAppConfigured; }
  if (missingField) delete data.revenueCat[missingField];
  const file = resolve(tempDir, "evidence.json");
  writeFileSync(file, JSON.stringify(data));
  return run([resolve(appDir, "scripts/check-dashboard-readiness.mjs"), "--file", file, ...(platform ? ["--platform", platform] : [])]);
}

describe("platform-specific release guards", () => {
  for (const platform of ["ios", "android"] as const) {
    it(`${platform} production builds without the other platform's keys`, () => {
      const result = config({ EAS_BUILD_PLATFORM: platform, ...values(platform) });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).not.toContain("3940256099942544");
    });
    it(`${platform} submit checks only its platform`, () => {
      const result = submit(platform);
      expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it(`${platform} dashboard accepts evidence for its platform`, () => {
      const result = dashboard(platform);
      expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it(`${platform} dashboard requires its RevenueCat setup`, () => {
      expect(dashboard(platform, `${platform}AppConfigured`).status).not.toBe(0);
    });
    for (const bad of ["", "invalid", "test_public", "appl_xxxxxxxx", "goog_xxxxxxxx"]) {
      it(`${platform} rejects missing or invalid RevenueCat key ${JSON.stringify(bad)}`, () => {
        const env = { ...values(platform), [`EXPO_PUBLIC_REVENUECAT_${platform.toUpperCase()}_API_KEY`]: bad };
        expect(config({ EAS_BUILD_PLATFORM: platform, ...env }).status).not.toBe(0);
        expect(submit(platform, env).status).not.toBe(0);
      });
    }
    for (const bad of ["", "invalid", "ca-app-pub-3940256099942544/1712485313"]) {
      it(`${platform} rejects invalid rewarded ad ID ${JSON.stringify(bad)}`, () => {
        const env = { ...values(platform), [`EXPO_PUBLIC_ADMOB_REWARDED_${platform.toUpperCase()}_ID`]: bad };
        expect(config({ EAS_BUILD_PLATFORM: platform, ...env }).status).not.toBe(0);
        expect(submit(platform, env).status).not.toBe(0);
      });
    }
    for (const bad of ["", "invalid", "ca-app-pub-3940256099942544~1458002511"]) {
      it(`${platform} rejects invalid AdMob app ID ${JSON.stringify(bad)}`, () => {
        const env = { ...values(platform), [`EXPO_PUBLIC_ADMOB_APP_${platform.toUpperCase()}_ID`]: bad };
        expect(config({ EAS_BUILD_PLATFORM: platform, ...env }).status).not.toBe(0);
        expect(submit(platform, env).status).not.toBe(0);
      });
    }
  }
  it("defaults to requiring both platforms", () => {
    expect(config(values("ios")).status).not.toBe(0);
    expect(submit().status).not.toBe(0);
    expect(config({ ...values("ios"), ...values("android") }).status).toBe(0);
  });
  it("validates values even when both platforms are populated", () => {
    expect(config({ ...values("ios"), ...values("android"), EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "goog_wrongPlatform" }).status).not.toBe(0);
  });
  it("accepts an explicit local release target", () => {
    expect(config({ RELEASE_PLATFORM: "ios", ...values("ios") }).status).toBe(0);
  });
  it("rejects invalid and contradictory platform selections", () => {
    expect(config({ RELEASE_PLATFORM: "oops", ...values("ios"), ...values("android") }).status).not.toBe(0);
    expect(config({ RELEASE_PLATFORM: "ios", EAS_BUILD_PLATFORM: "android", ...values("ios"), ...values("android") }).status).not.toBe(0);
    expect(submit("oops", { ...values("ios"), ...values("android") }).status).not.toBe(0);
    expect(dashboard("oops").status).not.toBe(0);
  });
});
