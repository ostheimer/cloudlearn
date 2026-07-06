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

# Mobile simulator/dev server (Metro; needs a dev build already installed)
pnpm --filter @clearn/mobile dev
```

## Mobile app (Expo) — testing & shipping

Full guide: [`docs/runbooks/mobile-dev-and-ota.md`](docs/runbooks/mobile-dev-and-ota.md). Key facts an agent needs from the start:

- **This Mac is the mobile dev machine**: Xcode + iOS simulators, CocoaPods, and the EAS CLI **logged in as `aostheimer`** are all present — an agent here can build, test in the simulator, and ship itself.
- **Test a screen locally**: `cd apps/mobile && npx expo run:ios --device "iPhone 16 Pro"` (first run compiles a dev build — Expo Go won't work, the app has custom native modules). Then drive it, e.g. open a deep link: `xcrun simctl openurl booted "clearn://deck/share/<token>"`.
- **Shipping reality**: `expo-updates` is **not installed**, so production OTA (`eas update`) does **not** work despite the `updates.url` in `app.json`. Until it's added + a rebuild, **every app change reaches devices only via a new `eas build`** (not OTA). "Over the air" so far = the Metro dev server, i.e. dev-time only.

## featureGates.ts sync

`packages/contracts/src/featureGates.ts` is the canonical source for tier limits, LP costs, LP earn rules, and LP pack prices.

Keep these mirrors in sync when changing LP economics:
- `apps/api/src/lib/featureGates.ts`
- `apps/mobile/src/features/paywall/lpPackOffers.ts`
- `README.md` section "Monetarisierung"
- `docs/monetization/MONETIZATION_CONCEPT.md`
