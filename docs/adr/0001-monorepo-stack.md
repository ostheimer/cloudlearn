# ADR 0001: Monorepo und Kernstack

- Status: Accepted
- Datum: 2026-02-09

## Kontext

Das Projekt benötigt parallele Entwicklung durch mehrere Agents, stabile Schnittstellen und wiederverwendbare Logik.

## Entscheidung

- Monorepo mit `pnpm` Workspaces.
- API auf Next.js Route Handlers (Vercel-kompatibel).
- Mobile mit Expo Router.
- Verträge zentral in `packages/contracts`.
- Kernlogik in `packages/domain`.

## Konsequenzen

- Schnellere Parallelisierung durch klare Paketgrenzen.
- Konsistente Typen zwischen Mobile und API.
- Höhere Anfangsinvestition in Struktur, dafür bessere Skalierbarkeit.

## Update (2026-07-08): shared packages are not imported (issue #78)

`packages/contracts` and `packages/domain` are currently **not imported by any app**. Each app keeps its own local copy of the relevant schemas/logic so Vercel and Expo builds stay isolated and independently deployable:

- `apps/api` has local supersets (`src/lib/contracts.ts`, `src/lib/domain.ts`) that intentionally extend the package schemas.
- `apps/mobile` defines its own API/response types.
- `apps/web/src/lib/learningModes.ts` is a byte-identical copy of `packages/domain/src/learningModes.ts`, guarded against drift by a consistency test in `packages/testkit` (`packageDrift.test.ts`).

This duplication is a deliberate trade-off (build isolation), not the single shared layer originally described above.
