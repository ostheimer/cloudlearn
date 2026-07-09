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

## Live implementation notes

**inMemoryStore.ts is active:** `apps/api/src/lib/inMemoryStore.ts` is still used for community decks, B2B features, and beta feedback. It is not dead code — do not delete it. When Supabase persistence is added for one of these areas, update this note.

**paywallState.ts is deprecated:** `apps/mobile/src/features/paywall/paywallState.ts` is marked deprecated but not yet removed. Do not add new features to it — use `featureGates.ts` and the canonical paywall flow instead.

**Free-tier limits are not enforced server-side yet:** `countUserDecks()` and `countUserCards()` exist in `apps/api/src/lib/db.ts` but `POST /api/v1/decks` and `POST /api/v1/cards` do not yet call them. Enforcing this is tracked as CL-MON-03.

**Tracking Preferences screen:** `apps/mobile/app/tracking-preferences.tsx` implements the App Tracking Transparency (ATT) consent flow. It is accessible from the Profile tab. This screen is required for App Store compliance and must not be removed.

**Web legal pages:** `apps/web/app/impressum/`, `apps/web/app/privacy/`, and `apps/web/app/support/` are deployed and required routes. They are separate from the main landing page and the learn client.
