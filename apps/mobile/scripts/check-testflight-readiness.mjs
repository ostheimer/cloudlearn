import fs from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const defaultEvidencePath = path.join(appDir, "testflight-readiness.local.json");

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolveEvidencePath() {
  const requestedPath =
    getArgValue("--file") ?? process.env.TESTFLIGHT_READINESS_FILE ?? defaultEvidencePath;
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

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function requireString(evidence, field, label, missing) {
  const value = evidence[field];
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

function requireEmail(evidence, field, label, missing) {
  const value = evidence[field];
  if (isBlank(value)) {
    printCheck(false, label, field);
    missing.push(field);
    return;
  }
  if (!isEmail(value) || looksLikePlaceholder(value)) {
    printInvalid(label, "expected real review/test email");
    missing.push(field);
    return;
  }
  printCheck(true, label, value);
}

function requireBoolean(evidence, field, label, missing) {
  if (evidence[field] !== true) {
    printCheck(false, label, "must be true");
    missing.push(field);
    return;
  }
  printCheck(true, label, "true");
}

function requireChecklist(evidence, missing) {
  const requiredChecks = [
    ["freshInstall", "Fresh install"],
    ["guestMode", "Guest mode"],
    ["emailLogin", "Email login"],
    ["passwordReset", "Password reset"],
    ["oauth", "Apple/Google OAuth"],
    ["coreFlow", "Core learning flow"],
    ["biometricUnlock", "Face ID / Touch ID unlock"],
    ["passkeysNotAdvertised", "Passkeys not advertised"],
    ["trackingAds", "Tracking / rewarded ads"],
    ["paywallPurchases", "Paywall / purchases"],
    ["accountDeletion", "Account deletion"],
  ];

  const checks = evidence.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    printCheck(false, "Smoke checklist", "checks object missing");
    missing.push("checks");
    return;
  }

  for (const [field, label] of requiredChecks) {
    if (checks[field] !== true) {
      printCheck(false, label, `checks.${field} must be true`);
      missing.push(`checks.${field}`);
    } else {
      printCheck(true, label, "passed");
    }
  }
}

const evidencePath = resolveEvidencePath();
const missing = [];

console.log("TestFlight readiness for apps/mobile");
console.log("");
console.log(`Evidence file: ${path.relative(appDir, evidencePath) || evidencePath}`);
console.log("");

if (!fs.existsSync(evidencePath)) {
  printCheck(false, "Evidence file", "copy testflight-readiness.example.json to testflight-readiness.local.json");
  console.log("");
  console.log("Remaining external inputs:");
  console.log("- apps/mobile/testflight-readiness.local.json");
  process.exit(1);
}

const evidence = readJson(evidencePath);

requireString(evidence, "appVersion", "App version", missing);
requireString(evidence, "buildNumber", "Build number", missing);
requireString(evidence, "deviceModel", "Physical device", missing);
requireString(evidence, "osVersion", "iOS version", missing);

if (!isIsoDate(evidence.smokeTestDate)) {
  printInvalid("Smoke test date", "expected YYYY-MM-DD");
  missing.push("smokeTestDate");
} else {
  printCheck(true, "Smoke test date", evidence.smokeTestDate);
}

requireEmail(evidence, "testAccountEmail", "Smoke test account", missing);
requireEmail(evidence, "reviewerDemoEmail", "Reviewer demo account", missing);
requireBoolean(
  evidence,
  "reviewPasswordStoredInPasswordManager",
  "Review password stored outside repo",
  missing
);
requireBoolean(evidence, "reviewNotesReady", "Review notes ready", missing);

if (evidence.smokeResult !== "passed") {
  printInvalid("Smoke result", "expected passed");
  missing.push("smokeResult");
} else {
  printCheck(true, "Smoke result", "passed");
}

if (!Array.isArray(evidence.knownLimitations)) {
  printInvalid("Known limitations", "expected an array, use [] if none");
  missing.push("knownLimitations");
} else {
  printCheck(
    true,
    "Known limitations recorded",
    `${evidence.knownLimitations.length} item(s)`
  );
}

requireChecklist(evidence, missing);

console.log("");
if (missing.length === 0) {
  console.log("TestFlight readiness evidence is complete.");
  process.exit(0);
}

console.log("Remaining external inputs:");
for (const entry of missing) {
  console.log(`- ${entry}`);
}

process.exit(1);
