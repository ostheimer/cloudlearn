# Internal Testing Runbook (CL-304)

## Ziel

Reproduzierbare interne Test-Builds für iOS/Android mit dokumentiertem Smoke-Test.

## Build-Vorbereitung

1. `pnpm install --no-frozen-lockfile`
2. `pnpm run ci`
3. `./scripts/build-mobile.sh`

## Smoke-Test Checklist

- App startet ohne Crash.
- Login funktioniert mit Demo-Account.
- Scan-Screen: Kamera/Galerie Mock-Flow erreichbar.
- OCR-Editor: Text laden, editieren, speichern.
- Lern-Session: Reveal + Again/Hard/Good/Easy durchspielbar.
- Paywall: Free-Limit wird erreicht, Upgrade-Flow sichtbar.

## Freigabe

- Build-Tag setzen (`mobile-internal-<date>-<buildnr>`).
- Testergruppe informieren.
- Gefundene Bugs in Backlog mit Severity dokumentieren.
