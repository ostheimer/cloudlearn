import { spawnSync } from "node:child_process";
import path from "node:path";

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
    args: [path.join("scripts", "check-submit-config.mjs")],
  },
  {
    label: "TestFlight readiness",
    args: [path.join("scripts", "check-testflight-readiness.mjs")],
  },
];

const failures = [];

for (const check of checks) {
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
