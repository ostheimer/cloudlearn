# Dashboard Release Handoff

Stand: 2026-05-02

## Ziel

Diese Liste bündelt alle App-Store-relevanten Aufgaben, die nicht vollständig im Repo erledigt werden können.
Sobald ein externer Wert eingetragen wurde, muss der zugehörige Repo-Check erneut ausgeführt werden.

## App Store Connect

- [ ] App `clearn` mit Bundle ID `app.clearn` anlegen oder prüfen.
- [x] `ascAppId` aus App Information → Apple ID kopieren: `6766691399`.
- [x] `ascAppId` in [apps/mobile/eas.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/eas.json) unter `submit.production.ios.ascAppId` eintragen.
- [ ] Datenschutz-URL hinterlegen: `https://clearn-web.vercel.app/privacy`
- [ ] Support-URL hinterlegen: `https://clearn-web.vercel.app/support`
- [ ] Review Notes aus [docs/runbooks/app-store-review-notes.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-review-notes.md) übertragen.
- [ ] In-App-Käufe anlegen:
  - `ai.clearn.pro.monthly`
  - `ai.clearn.pro.annual`
  - `ai.clearn.lifetime`
- [ ] Sandbox-Tester für Kauf-/Restore-Tests anlegen.

## Google Play Console

- [ ] App mit Package Name `app.clearn` anlegen oder prüfen.
- [ ] Interne Testspur aktivieren.
- [ ] Service Account für EAS Submit erzeugen.
- [ ] JSON-Datei lokal als `apps/mobile/google-play-service-account.json` ablegen.
- [ ] Produkte anlegen:
  - `ai.clearn.pro.monthly`
  - `ai.clearn.pro.annual`
  - `ai.clearn.lifetime`
- [ ] Lizenztester / Internal Tester für Kauf-/Restore-Tests hinzufügen.

## RevenueCat

- [ ] iOS-App mit Bundle ID `app.clearn` prüfen.
- [ ] Android-App mit Package Name `app.clearn` prüfen.
- [ ] Store-Produkte importieren oder manuell anlegen.
- [ ] Entitlement `pro` mit Monthly/Annual verbinden.
- [ ] Entitlement `lifetime` mit Lifetime-Produkt verbinden.
- [ ] Offering `default` veröffentlichen.
- [ ] API Keys als EAS Secrets setzen:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- [ ] Webhook-Secret erzeugen.

## Vercel

- [ ] `REVENUECAT_WEBHOOK_SECRET` in `clearn-api` setzen.
- [ ] Supabase URL/Anon Key/Service Role Key für `clearn-api` prüfen.
- [ ] Datenschutz-, Support- und Impressumsseiten im Projekt `clearn-web` live prüfen.
- [ ] Production Deploys für `clearn-api`, `clearn-web` und `cloudlearn` grün prüfen.

## EAS / Build Secrets

- [ ] Produktive AdMob App IDs setzen:
  - `EXPO_PUBLIC_ADMOB_APP_IOS_ID`
  - `EXPO_PUBLIC_ADMOB_APP_ANDROID_ID`
- [ ] Produktive Rewarded-Ad Unit IDs setzen:
  - `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID`
  - `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`
- [ ] RevenueCat Mobile API Keys setzen:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

## Supabase

- [ ] Site URL: `https://clearn-web.vercel.app`
- [ ] Redirect URLs:
  - `clearn://auth`
  - `https://clearn-web.vercel.app/auth/confirm`
- [ ] E-Mail-Templates für Confirmation und Recovery aktiv prüfen.
- [ ] Google Provider aktivieren.
- [ ] Apple Provider aktivieren.
- [ ] Account-Linking-Verhalten mit gleicher verifizierter E-Mail testen.
- [ ] Migration `20260404120000_add_deleted_accounts.sql` auf Ziel-Datenbank anwenden.

## Nach jedem Dashboard-Schritt prüfen

```bash
cd apps/mobile
pnpm submit:check
```

```bash
pnpm test:cloudlearn-smoke
pnpm --filter @clearn/api test
pnpm --filter @clearn/mobile typecheck
```

## Aktuell bekannte externe Blocker

- `apps/mobile/google-play-service-account.json` fehlt lokal noch.
- Store-Produkte und RevenueCat-Offerings müssen real verifiziert werden.
- Supabase OAuth Provider müssen produktiv aktiviert und auf Gerät getestet werden.
- Produktive AdMob IDs müssen vor einem Release-Build gesetzt werden.
