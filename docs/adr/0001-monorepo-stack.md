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
