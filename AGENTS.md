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
