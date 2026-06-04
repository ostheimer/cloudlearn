# Agent Guidance

## Bug workflow

When a bug is reported, don't start by fixing it. Start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.

## Known documentation discrepancies (to fix in next doc pass)

### ROADMAP.md Phase 2 — internal inconsistency

`ROADMAP.md` Phase 2 lists the following as `[ ]` (open), but the **Feature-Prioritäten** table in the same file marks them as `✅ Done`:

- `[ ] Statistiken-Dashboard (CL-B02)` → should be `[x]` (Stats are fully functional per Ist-Stand)
- `[ ] Streaks + Push-Notifications (CL-B01, CL-B04)` → should be `[x]` (both Done per Feature-Prioritäten)

The Phase 2 header `(TODO — Scaffold vorhanden, nicht funktionsfähig)` is also outdated; Priorität A + B are complete, which was the Phase 2 prerequisite.

### README.md "Nächste Schritte" — outdated priorities

The "Nächste Schritte" section still lists Prioritäten A, B, and C as upcoming work. All A, B, and C tickets are ✅ Done per `ROADMAP.md`. Only **Priorität D** items remain open:

- D1 — Offline-Lernen / SQLite (`CL-D01`)
- D2 — PDF-Import echtes Parsing (`CL-D02`)
- D3/D4 — Anki-Import/-Export (`CL-D03`, `CL-D04`)
- D5 — Apple/Google Sign-In (`CL-D05`)
- D7 — Community-Decks (`CL-D07`)
- CL-MON-01/02 — App Store Produkte live stellen

### README.md Monetarisierung — veraltete Tabelle

The pricing table in README.md has an inline note saying it's outdated since 2026-03 (switched to LP system). The authoritative model is in `packages/contracts/src/featureGates.ts`.

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
