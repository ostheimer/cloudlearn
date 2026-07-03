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

# Mobile tests
pnpm --filter @clearn/mobile test

# Mobile simulator/dev server
pnpm --filter @clearn/mobile dev
```

## featureGates.ts sync

`packages/contracts/src/featureGates.ts` is the canonical source for tier limits, LP costs, LP earn rules, and LP pack prices.

Keep these mirrors in sync when changing LP economics:
- `apps/api/src/lib/featureGates.ts`
- `apps/mobile/src/features/paywall/lpPackOffers.ts`
- `README.md` section "Monetarisierung"
- `docs/monetization/MONETIZATION_CONCEPT.md`
