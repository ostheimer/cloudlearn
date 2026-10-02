import { spawnSync } from "node:child_process";
import path from "node:path";
import release from "./release-platform.cjs";

const platforms = release.releasePlatforms({ args: process.argv.slice(2) });
const platformArgs = ["--platform", platforms.length === 2 ? "all" : platforms[0]];

const appDir = process.cwd();

function runCheck(label, args) {
  console.log("");
  console.log(`== ${label} ==`);
  console.log("");

  const result = spawnSync(process.execPath, args, {
    cwd: appDir,
    stdio: "inherit",
  });

  return result.status ?? 1;
}

const checks = [
  {
    label: "Submit configuration",
    args: [path.join("scripts", "check-submit-config.mjs"), ...platformArgs],
  },
  {
    label: "Dashboard readiness",
    args: [path.join("scripts", "check-dashboard-readiness.mjs"), ...platformArgs],
  },
  {
    label: "Store metadata",
    args: [path.join("scripts", "check-store-metadata.mjs")],
  },
  {
    label: "TestFlight readiness",
    args: [path.join("scripts", "check-testflight-readiness.mjs")],
  },
];

const failures = [];

for (const check of checks) {
  if (check.label === "TestFlight readiness" && !platforms.includes("ios")) {
    console.log("Android device release evidence is not implemented; release readiness remains blocked.");
    failures.push("Android device release evidence");
    continue;
  }
  const status = runCheck(check.label, check.args);
  if (status !== 0) {
    failures.push(check.label);
  }
}

console.log("");
if (failures.length === 0) {
  console.log("Mobile release readiness checks passed.");
  process.exit(0);
}

console.log("Mobile release readiness is blocked by:");
for (const failure of failures) {
  console.log(`- ${failure}`);
}

process.exit(1);
