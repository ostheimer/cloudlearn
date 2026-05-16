import fs from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const defaultEvidencePath = path.join(appDir, "dashboard-readiness.local.json");

const EXPECTED = {
  appleAppId: "6766691399",
  bundleId: "app.clearn",
  androidPackageName: "app.clearn",
  privacyUrl: "https://clearn-web.vercel.app/privacy",
  supportUrl: "https://clearn-web.vercel.app/support",
  productIds: [
    "ai.clearn.pro.monthly",
    "ai.clearn.pro.annual",
    "ai.clearn.lifetime",
  ],
  revenueCatEntitlements: ["pro", "lifetime"],
  revenueCatOffering: "default",
  supabaseSiteUrl: "https://clearn-web.vercel.app",
  supabaseRedirectUrls: [
    "clearn://auth",
    "https://clearn-web.vercel.app/auth/confirm",
  ],
};

const REQUIRED_CHECKS = [
  ["appStoreConnect.appExists", "App Store Connect app exists"],
  ["appStoreConnect.privacyUrlSet", "App Store Connect privacy URL"],
  ["appStoreConnect.supportUrlSet", "App Store Connect support URL"],
  ["appStoreConnect.reviewNotesTransferred", "App Review notes transferred"],
  ["appStoreConnect.inAppPurchasesCreated", "App Store Connect in-app purchases"],
  ["appStoreConnect.sandboxTesterCreated", "App Store Connect sandbox tester"],
  ["googlePlay.appExists", "Google Play app exists"],
  ["googlePlay.internalTestingEnabled", "Google Play internal testing"],
  ["googlePlay.serviceAccountCreated", "Google Play service account"],
  ["googlePlay.productsCreated", "Google Play products"],
  ["googlePlay.testersAdded", "Google Play testers"],
  ["revenueCat.iosAppConfigured", "RevenueCat iOS app"],
  ["revenueCat.androidAppConfigured", "RevenueCat Android app"],
  ["revenueCat.productsImported", "RevenueCat products"],
  ["revenueCat.proEntitlementConfigured", "RevenueCat pro entitlement"],
  ["revenueCat.lifetimeEntitlementConfigured", "RevenueCat lifetime entitlement"],
  ["revenueCat.defaultOfferingPublished", "RevenueCat default offering"],
  ["revenueCat.webhookSecretCreated", "RevenueCat webhook secret"],
  ["vercel.revenueCatWebhookSecretSet", "Vercel RevenueCat webhook secret"],
  ["vercel.supabaseEnvChecked", "Vercel Supabase env"],
  ["vercel.publicPagesLive", "Vercel public pages"],
  ["vercel.productionDeploysGreen", "Vercel production deploys"],
  ["eas.admobSecretsSet", "EAS AdMob secrets"],
  ["eas.revenueCatSecretsSet", "EAS RevenueCat secrets"],
  ["eas.entitlementEnvSet", "EAS RevenueCat entitlement env"],
  ["supabase.siteUrlSet", "Supabase site URL"],
  ["supabase.redirectUrlsSet", "Supabase redirect URLs"],
  ["supabase.emailTemplatesChecked", "Supabase email templates"],
  ["supabase.googleProviderEnabled", "Supabase Google provider"],
  ["supabase.appleProviderEnabled", "Supabase Apple provider"],
  ["supabase.accountLinkingTested", "Supabase account linking"],
  ["supabase.deletionMigrationApplied", "Supabase deletion migration"],
];

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolveEvidencePath() {
  const requestedPath =
    getArgValue("--file") ?? process.env.DASHBOARD_READINESS_FILE ?? defaultEvidencePath;
  return path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(appDir, requestedPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function getPathValue(value, dottedPath) {
  return dottedPath.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return current[segment];
  }, value);
}

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function looksLikePlaceholder(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("<") ||
    normalized.includes(">") ||
    normalized.includes("todo") ||
    normalized.includes("tbd") ||
    normalized.includes("example")
  );
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function requireString(evidence, field, label, missing) {
  const value = getPathValue(evidence, field);
  if (isBlank(value)) {
    printCheck(false, label, field);
    missing.push(field);
    return;
  }
  if (looksLikePlaceholder(value)) {
    printInvalid(label, "replace placeholder value");
    missing.push(field);
    return;
  }
  printCheck(true, label, value);
}

function requireExact(evidence, field, label, expected, missing) {
  const value = getPathValue(evidence, field);
  if (value !== expected) {
    printInvalid(label, `expected ${expected}`);
    missing.push(field);
    return;
  }
  printCheck(true, label, value);
}

function requireArrayIncludes(evidence, field, label, expectedValues, missing) {
  const value = getPathValue(evidence, field);
  if (!Array.isArray(value)) {
    printInvalid(label, `expected array containing ${expectedValues.join(", ")}`);
    missing.push(field);
    return;
  }

  const missingValues = expectedValues.filter((expected) => !value.includes(expected));
  if (missingValues.length > 0) {
    printInvalid(label, `missing ${missingValues.join(", ")}`);
    missing.push(field);
    return;
  }

  printCheck(true, label, `${value.length} item(s)`);
}

function requireBoolean(evidence, field, label, missing) {
  const value = getPathValue(evidence, field);
  if (value !== true) {
    printCheck(false, label, `${field} must be true`);
    missing.push(field);
    return;
  }
  printCheck(true, label, "true");
}

const evidencePath = resolveEvidencePath();
const missing = [];

console.log("Dashboard readiness for apps/mobile");
console.log("");
console.log(`Evidence file: ${path.relative(appDir, evidencePath) || evidencePath}`);
console.log("");

if (!fs.existsSync(evidencePath)) {
  printCheck(
    false,
    "Evidence file",
    "copy dashboard-readiness.example.json to dashboard-readiness.local.json"
  );
  console.log("");
  console.log("Remaining external inputs:");
  console.log("- apps/mobile/dashboard-readiness.local.json");
  process.exit(1);
}

const evidence = readJson(evidencePath);

requireString(evidence, "recordedBy", "Recorded by", missing);

if (!isIsoDate(evidence.recordedAt)) {
  printInvalid("Recorded date", "expected YYYY-MM-DD");
  missing.push("recordedAt");
} else {
  printCheck(true, "Recorded date", evidence.recordedAt);
}

console.log("");
console.log("Canonical identifiers");
console.log("");

requireExact(evidence, "appStoreConnect.appleAppId", "Apple app ID", EXPECTED.appleAppId, missing);
requireExact(evidence, "appStoreConnect.bundleId", "iOS bundle ID", EXPECTED.bundleId, missing);
requireExact(
  evidence,
  "googlePlay.packageName",
  "Android package name",
  EXPECTED.androidPackageName,
  missing
);
requireExact(evidence, "appStoreConnect.privacyUrl", "Privacy URL", EXPECTED.privacyUrl, missing);
requireExact(evidence, "appStoreConnect.supportUrl", "Support URL", EXPECTED.supportUrl, missing);
requireArrayIncludes(
  evidence,
  "appStoreConnect.productIds",
  "App Store product IDs",
  EXPECTED.productIds,
  missing
);
requireArrayIncludes(
  evidence,
  "googlePlay.productIds",
  "Google Play product IDs",
  EXPECTED.productIds,
  missing
);
requireArrayIncludes(
  evidence,
  "revenueCat.entitlementIds",
  "RevenueCat entitlement IDs",
  EXPECTED.revenueCatEntitlements,
  missing
);
requireExact(
  evidence,
  "revenueCat.offeringId",
  "RevenueCat offering ID",
  EXPECTED.revenueCatOffering,
  missing
);
requireExact(evidence, "supabase.siteUrl", "Supabase site URL", EXPECTED.supabaseSiteUrl, missing);
requireArrayIncludes(
  evidence,
  "supabase.redirectUrls",
  "Supabase redirect URLs",
  EXPECTED.supabaseRedirectUrls,
  missing
);

console.log("");
console.log("External dashboard checklist");
console.log("");

for (const [field, label] of REQUIRED_CHECKS) {
  requireBoolean(evidence, field, label, missing);
}

if (!Array.isArray(evidence.notes)) {
  printInvalid("Notes", "expected an array, use [] if none");
  missing.push("notes");
} else {
  printCheck(true, "Notes recorded", `${evidence.notes.length} item(s)`);
}

console.log("");
if (missing.length === 0) {
  console.log("Dashboard readiness evidence is complete.");
  process.exit(0);
}

console.log("Remaining external inputs:");
for (const entry of missing) {
  console.log(`- ${entry}`);
}

process.exit(1);
