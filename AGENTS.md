# Agent Guidance

## Bug workflow

When a bug is reported, don't start by fixing it. Start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.

## Test commands

```bash
# All workspace checks
pnpm run ci

# Unit + integration tests
npx vitest run

# E2E tests
npx playwright test

# Mobile
pnpm --filter @clearn/mobile dev
```

## featureGates.ts — zwei Dateien, eine Wahrheit

`packages/contracts/src/featureGates.ts` ist die **kanonische Quelle** für Tier-Limits, LP-Kosten, LP-Verdienregeln und LP-Pack-Preise. Sie wird workspace-weit importiert.

`apps/api/src/lib/featureGates.ts` ist ein **server-seitiger Spiegel** mit identischen Werten für den Einsatz innerhalb der API ohne Cross-Workspace-Import. Bei Änderungen zuerst `packages/contracts/src/featureGates.ts` anpassen, dann `apps/api/src/lib/featureGates.ts` synchronisieren.

Wenn `docs/monetization/MONETIZATION_CONCEPT.md` von `packages/contracts/src/featureGates.ts` abweicht, ist der Code die Wahrheit — bis eine Produktentscheidung das ändert (nachverfolgt in BACKLOG CL-MON-06).
