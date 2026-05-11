import fs from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const easJsonPath = path.join(appDir, "eas.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(appDir, relativePath));
}

function printCheck(ok, label, detail) {
  const prefix = ok ? "OK" : "MISSING";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${prefix}: ${label}${suffix}`);
}

function printInvalid(label, detail) {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`INVALID: ${label}${suffix}`);
}

const GOOGLE_ADMOB_TEST_IDS = new Set([
  "ca-app-pub-3940256099942544~1458002511",
  "ca-app-pub-3940256099942544~3347511713",
  "ca-app-pub-3940256099942544/1712485313",
  "ca-app-pub-3940256099942544/5224354917",
]);

const REVENUECAT_API_KEYS = [
  {
    name: "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
    pattern: /^appl_[A-Za-z0-9_]+$/,
    detail: "expected RevenueCat iOS public key, e.g. appl_...",
  },
  {
    name: "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
    pattern: /^goog_[A-Za-z0-9_]+$/,
    detail: "expected RevenueCat Android public key, e.g. goog_...",
  },
];

const REVENUECAT_ENTITLEMENTS = [
  {
    name: "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO",
    expected: "pro",
  },
  {
    name: "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME",
    expected: "lifetime",
  },
];

let productionBuildEnv = {};

function readEnv(name) {
  return (
    process.env[name]?.trim() ??
    (typeof productionBuildEnv[name] === "string"
      ? productionBuildEnv[name].trim()
      : "")
  );
}

function looksLikePlaceholder(value) {
  return (
    value.includes("xxxxxxxx") ||
    value.includes("XXXXXXXX") ||
    value.startsWith("your-")
  );
}

const easJson = readJson(easJsonPath);
const submitProfile = easJson.submit?.production ?? {};
const ios = submitProfile.ios ?? {};
const android = submitProfile.android ?? {};
productionBuildEnv = easJson.build?.production?.env ?? {};

const missing = [];

console.log("Submit readiness for apps/mobile");
console.log("");

printCheck(Boolean(ios.appleId), "iOS appleId", ios.appleId ?? "");
if (!ios.appleId) missing.push("submit.production.ios.appleId");

printCheck(Boolean(ios.ascAppId), "iOS ascAppId", ios.ascAppId ?? "In App Store Connect unter App Information > Apple ID");
if (!ios.ascAppId) missing.push("submit.production.ios.ascAppId");

printCheck(Boolean(ios.appleTeamId), "iOS appleTeamId", ios.appleTeamId ?? "Aus Apple Developer / App Store Connect Team");
if (!ios.appleTeamId) missing.push("submit.production.ios.appleTeamId");

printCheck(Boolean(ios.sku), "iOS sku", ios.sku ?? "");
if (!ios.sku) missing.push("submit.production.ios.sku");

printCheck(
  Boolean(android.applicationId),
  "Android applicationId",
  android.applicationId ?? ""
);
if (!android.applicationId) missing.push("submit.production.android.applicationId");

printCheck(
  Boolean(android.serviceAccountKeyPath),
  "Android serviceAccountKeyPath",
  android.serviceAccountKeyPath ?? ""
);
if (!android.serviceAccountKeyPath) {
  missing.push("submit.production.android.serviceAccountKeyPath");
}

if (android.serviceAccountKeyPath) {
  printCheck(
    fileExists(android.serviceAccountKeyPath),
    "Android service account file exists",
    android.serviceAccountKeyPath
  );
  if (!fileExists(android.serviceAccountKeyPath)) {
    missing.push(`missing file: ${android.serviceAccountKeyPath}`);
  }
}

printCheck(Boolean(android.track), "Android track", android.track ?? "");
if (!android.track) missing.push("submit.production.android.track");

printCheck(Boolean(android.releaseStatus), "Android releaseStatus", android.releaseStatus ?? "");
if (!android.releaseStatus) missing.push("submit.production.android.releaseStatus");

console.log("");
console.log("Production build environment");
console.log("");

for (const name of [
  "EXPO_PUBLIC_ADMOB_APP_IOS_ID",
  "EXPO_PUBLIC_ADMOB_APP_ANDROID_ID",
  "EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID",
  "EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID",
]) {
  const value = readEnv(name);
  const present = Boolean(value);
  const isTestId = GOOGLE_ADMOB_TEST_IDS.has(value);

  if (!present) {
    printCheck(false, name, "Set as EAS secret");
    missing.push(`EAS secret: ${name}`);
  } else if (isTestId) {
    printInvalid(name, "Google test ID is not allowed in production");
    missing.push(`production must not use Google test ID: ${name}`);
  } else {
    printCheck(true, name, "set");
  }
}

for (const { name, pattern, detail } of REVENUECAT_API_KEYS) {
  const value = readEnv(name);
  if (!value) {
    printCheck(false, name, "Set as EAS secret");
    missing.push(`EAS secret: ${name}`);
  } else if (!pattern.test(value) || looksLikePlaceholder(value)) {
    printInvalid(name, detail);
    missing.push(`invalid RevenueCat API key: ${name}`);
  } else {
    printCheck(true, name, "set");
  }
}

for (const { name, expected } of REVENUECAT_ENTITLEMENTS) {
  const value = readEnv(name);
  if (!value) {
    printCheck(false, name, `Set to ${expected}`);
    missing.push(`EAS env: ${name}`);
  } else if (value !== expected) {
    printInvalid(name, `expected ${expected}`);
    missing.push(`invalid RevenueCat entitlement: ${name}`);
  } else {
    printCheck(true, name, value);
  }
}

console.log("");
if (missing.length === 0) {
  console.log("All repo-side submit values are present.");
  process.exit(0);
}

console.log("Remaining external inputs:");
for (const entry of missing) {
  console.log(`- ${entry}`);
}

process.exit(1);
