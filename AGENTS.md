# Agent Guidance

## Bug workflow

When a bug is reported, write a test that reproduces it first. Then fix the bug and confirm the test passes.

## Code style

- TypeScript everywhere; Deutsch für User-facing UI-Text.
- Produktname: **clearn.ai** — konsistent in Code, Commits und Docs verwenden.
- API unter `apps/api/app/api/v1/*`; Mobile in `apps/mobile`; Web-Landing in `apps/web`.

## Monetarisierung

Das aktive Monetarisierungsmodell nutzt LP (Lernpunkte). Kanonische Quelle für Limits, Kosten und Tier-Definitionen ist `packages/contracts/src/featureGates.ts`. Preistabellen in README.md und ROADMAP.md sind historische Referenzen — sie wurden als das Modell auf LP umgestellt nicht mehr synchron gehalten.

## Testing

- API: Vitest Unit- und Integrationstests in `apps/api`.
- Mobile: Vitest Unit-Tests in `apps/mobile/src`.
- E2E: Playwright in `e2e/`.
- Alle Tests vom Repo-Root: `npx vitest run`.
