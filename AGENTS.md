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

## Mobile shipping reality (no OTA)

- `expo-updates` is **not installed**: production OTA does not work despite the
  `updates.url` in `app.json`. **Every app change reaches devices only via a new
  `eas build`** — code merged to main is invisible on phones until then.
- The current dev machine is Windows (no Xcode/simulators). On-device testing
  runs via `eas build --platform ios --profile preview` from `apps/mobile`
  (internal distribution; the registered iPhones install from the build page).
- Production/TestFlight builds are currently blocked: the required
  `EXPO_PUBLIC_REVENUECAT_*` keys are not set in the EAS environment.

### Build frugality (builds cost money — mandatory)

EAS builds burn paid cloud minutes / plan quota (22 iOS builds in July 2026,
8 on a single day — that is the anti-pattern). Every agent must:

1. **Only build when the user wants to test.** Never auto-build after each
   merge — collect finished work and ship ONE build at the end.
2. **Check for a running build first**: `eas build:list --platform ios
   --limit 3` — if a build for the same commit is NEW/IN_PROGRESS, use its
   build page instead of starting another. Cancel accidental duplicates
   (`eas build:cancel <id>`).
3. **Tell the user before spending.** Lara is a student and does not know
   cloud pricing models — anything that costs money or quota (builds, paid
   APIs) must be flagged to her *before* doing it, unprompted.

## featureGates.ts sync

The LP economy (tier limits, LP costs, earn rules, pack prices) is deliberately
duplicated across independently-deployed apps. `apps/api/src/lib/featureGates.ts`
is the **runtime source of truth** — the server is authoritative. Clients read
live costs from `/usage` rather than hard-coding them.

The code copies are now **machine-enforced**: `packages/testkit/src/lpEconomyConsistency.test.ts`
imports the real exported values and fails CI (#212) the moment any drift apart.
So when you change LP economics, change **both** code copies together — the guard
tells you which one you missed:
- `apps/api/src/lib/featureGates.ts` (runtime authority)
- `packages/contracts/src/featureGates.ts` (shared-typing mirror — must equal the API)
- `apps/mobile/src/features/paywall/lpPackOffers.ts` (pack IDs + LP amounts; prices come from RevenueCat, not from us)

These doc mirrors are **not** covered by the guard — update them by hand:
- `README.md` section "Monetarisierung"
- `docs/monetization/MONETIZATION_CONCEPT.md`

## Live implementation notes

**inMemoryStore.ts is active:** `apps/api/src/lib/inMemoryStore.ts` is used by `scripts/perf-smoke.ts` and `apps/api/src/tests/dueCardsOcclusion.test.ts`, and `apps/api/src/lib/db.ts` mirrors its record shapes. It is not dead code — do not delete it. (This note previously claimed community decks, B2B and beta feedback used it. That was never true: each of those kept its own module-level array. Community and B2B were removed in #425; beta feedback still has its own array in `betaFeedbackService.ts`.)

**paywallState.ts is deprecated:** `apps/mobile/src/features/paywall/paywallState.ts` is marked deprecated but not yet removed. Do not add new features to it — use `featureGates.ts` and the canonical paywall flow instead.

**Free-tier limits are not enforced server-side yet:** `countUserDecks()` and `countUserCards()` exist in `apps/api/src/lib/db.ts` but `POST /api/v1/decks` and `POST /api/v1/cards` do not yet call them. Enforcing this is tracked as CL-MON-03.

**Tracking Preferences screen:** `apps/mobile/app/tracking-preferences.tsx` implements the App Tracking Transparency (ATT) consent flow. It is accessible from the Profile tab. This screen is required for App Store compliance and must not be removed.

**Web legal pages:** `apps/web/app/impressum/`, `apps/web/app/privacy/`, and `apps/web/app/support/` are deployed and required routes. They are separate from the main landing page and the learn client.
