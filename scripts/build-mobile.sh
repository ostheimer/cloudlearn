#!/usr/bin/env bash
set -euo pipefail

echo "[clearn] Running mobile preflight checks..."
pnpm --filter @clearn/mobile lint
pnpm --filter @clearn/mobile typecheck
pnpm --filter @clearn/mobile test

echo "[clearn] Mobile preflight checks passed."
echo "[clearn] Next step: run EAS build in CI or local release machine."
