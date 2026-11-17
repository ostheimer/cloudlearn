# Project knowledge

CloudLearn is a flashcard learning product: an Expo mobile app (`apps/mobile`), a Next.js web
client and legal pages (`apps/web`), and an API (`apps/api`). Architecture and setup are in
`README.md`; plans in `ROADMAP.md` and `BACKLOG.md`; runbooks in `docs/runbooks/`.

## Commands

```bash
pnpm run ci                       # lint + typecheck + tests of all workspaces
npx vitest run                    # unit + integration tests
npx playwright test               # E2E tests
pnpm --filter @clearn/mobile test # mobile tests
pnpm --filter @clearn/mobile dev  # mobile simulator/dev server
```

## Deploy

- Web and API are deployed by Vercel from `main`. Vercel projects: `clearn-api`
  (`apps/api/vercel.json`, includes two cron jobs), `clearn-web` (`apps/web/vercel.json`) and
  `cloudlearn` (root `vercel.json`, builds the mobile web export to `apps/mobile/dist`).
- The mobile app is not deployed by Vercel. Production is `clearn-api.vercel.app` (live E2E
  and perf workflows run against it).

## Mobile shipping reality (no OTA)

- `expo-updates` is **not installed**: production OTA does not work despite the `updates.url`
  in `app.json`. **Every app change reaches devices only via a new `eas build`**. Code merged
  to main is invisible on phones until then.
- On-device testing runs via `eas build --platform ios --profile preview` from `apps/mobile`
  (internal distribution, registered iPhones install from the build page).
- Production/TestFlight builds need the `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and
  `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` secrets in the EAS environment.
- EAS builds burn paid cloud minutes / plan quota (22 iOS builds in July 2026, 8 on one day).
  Every build costs money; `eas build:list --platform ios --limit 3` shows running builds,
  `eas build:cancel <id>` cancels duplicates.

## featureGates.ts sync

The LP economy (tier limits, LP costs, earn rules, pack prices) is deliberately duplicated
across independently deployed apps. `apps/api/src/lib/featureGates.ts` is the **runtime source
of truth**; clients read live costs from `/usage` instead of hard-coding them.

The code copies are machine-enforced: `packages/testkit/src/lpEconomyConsistency.test.ts`
imports the real exported values and fails CI when they drift apart. When LP economics change,
change all code copies together:

- `apps/api/src/lib/featureGates.ts` (runtime authority)
- `packages/contracts/src/featureGates.ts` (shared-typing mirror, must equal the API)
- `apps/mobile/src/features/paywall/lpPackOffers.ts` (pack IDs and LP amounts; prices come from
  RevenueCat)

These doc mirrors are not covered by the guard and must be updated by hand:
`README.md` section "Monetarisierung" and `docs/monetization/MONETIZATION_CONCEPT.md`.

## Implementation notes

- `apps/api/src/lib/inMemoryStore.ts` is live code, not dead: `scripts/perf-smoke.ts` and
  `apps/api/src/tests/dueCardsOcclusion.test.ts` use it, and `apps/api/src/lib/db.ts` mirrors
  its record shapes. Deleting it breaks both.
- `apps/mobile/src/features/paywall/paywallState.ts` is deprecated (replaced by the
  server-synced `usageStore.ts`), kept only for a test. Use `featureGates.ts` and the
  canonical paywall flow for new work.
- `apps/mobile/app/tracking-preferences.tsx` implements the App Tracking Transparency consent
  flow, reachable from the Profile tab. It is required for App Store compliance and must not
  be removed.
- `apps/web/app/impressum/`, `apps/web/app/privacy/` and `apps/web/app/support/` are required
  routes, separate from the landing page and the learn client.
