# Dashboard Release Handoff

Stand: 2026-09-28

## Ziel

Diese Liste bündelt alle App-Store-relevanten Aufgaben, die nicht vollständig im Repo erledigt werden können.
Sobald ein externer Wert eingetragen wurde, muss der zugehörige Repo-Check erneut ausgeführt werden.

## App Store Connect

- [x] App `clearn` mit Bundle ID `app.clearn` in App Store Connect geprüft.
- [x] `ascAppId` aus App Information → Apple ID kopieren: `6766691399`.
- [x] `ascAppId` in [apps/mobile/eas.json](/apps/mobile/eas.json) unter `submit.production.ios.ascAppId` eintragen.
- [ ] Datenschutz-URL hinterlegen: `https://clearn-web.vercel.app/privacy`
- [ ] Support-URL hinterlegen: `https://clearn-web.vercel.app/support`
- [ ] Review Notes aus [docs/runbooks/app-store-review-notes.md](/docs/runbooks/app-store-review-notes.md) übertragen.
- [x] In-App-Käufe angelegt (22. September 2026; Store-Prüfung/Freigabe noch offen):
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

- [x] iOS-App mit Bundle ID `app.clearn` und gültigen Apple-In-App-Kauf-Credentials geprüft (22. September 2026).
- [ ] Android-App mit Package Name `app.clearn` prüfen.
- [x] Drei iOS-Store-Produkte manuell angelegt.
- [x] Entitlement `pro` mit Monthly/Annual verbunden.
- [x] Entitlement `lifetime` mit Lifetime-Produkt verbunden.
- [x] Aktives Offering `default` mit `$rc_monthly`, `$rc_annual` und `$rc_lifetime` angelegt.
- [x] Öffentlichen `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` im EAS-Projekt für Development, Preview und Production gesetzt.
- [ ] Android-Key setzen, sobald die Android-App und Play-Produkte eingerichtet sind:
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- [ ] RevenueCat-Webhook mit `https://clearn-api.vercel.app/api/v1/subscription/webhook` und `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` anlegen; Sandbox und Produktion einschließen und eine echte Zustellung prüfen. Im Projekt ist noch kein Webhook gespeichert.

## Vercel

- [x] `REVENUECAT_WEBHOOK_SECRET` ist in `clearn-api` für Production als Secret vorhanden; der Wert wurde nicht offengelegt. Der Live-Webhook lehnt Anfragen ohne Authorization mit HTTP 401 ab.
- Vercel-Secret-Werte sind nach dem Speichern nicht mehr lesbar. Ein leeres Bearbeitungsfeld bedeutet nicht, dass kein Wert gespeichert ist. Einen unbekannten Wert nur durch eine ausdrücklich autorisierte neue gemeinsame Kennung ersetzen; die API-Variable enthält den Wert ohne Präfix, RevenueCats Authorization-Feld `Bearer <Wert>`. Danach API neu deployen und RevenueCats Testzustellung mit HTTP 200 prüfen.
- [ ] Supabase URL/Anon Key/Service Role Key für `clearn-api` prüfen.
- [x] Datenschutz-, Support- und Impressumsseiten im Projekt `clearn-web` antworten live mit HTTP 200 (28. September 2026).
- [x] Production Deploys für `clearn-api`, `clearn-web` und `cloudlearn` zeigen Commit `857b48c` und sind „Ready“ (28. September 2026).

## EAS / Build Secrets

- [ ] Nur bei `realAdsEnabled=true`: produktive AdMob App IDs setzen:
  - `EXPO_PUBLIC_ADMOB_APP_IOS_ID`
  - `EXPO_PUBLIC_ADMOB_APP_ANDROID_ID`
- [ ] Nur bei `realAdsEnabled=true`: produktive Rewarded-Ad Unit IDs setzen:
  - `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID`
  - `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`
- [x] RevenueCat-iOS-SDK-Key für Development, Preview und Production gesetzt.
- [ ] RevenueCat-Android-SDK-Key setzen:
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- [ ] RevenueCat Entitlement IDs in EAS prüfen:
  - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO=pro`
  - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME=lifetime`

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
- [x] Migration `20260927222222_session_progress_card_ids.sql` auf der clearn-Zieldatenbank angewendet; nullable `uuid[]`-Spalte und Migrationsversion gelesen.

## Nach jedem Dashboard-Schritt prüfen

Vollständiger Mobile-Release-Check:

```bash
pnpm release:mobile:check
```

Der vollständige Check erwartet lokale Nachweisdateien, die nicht ins Repo gehören:

```bash
cp apps/mobile/dashboard-readiness.example.json apps/mobile/dashboard-readiness.local.json
cp apps/mobile/testflight-readiness.example.json apps/mobile/testflight-readiness.local.json
```

`apps/mobile/dashboard-readiness.local.json` enthält nur boolesche Dashboard-Nachweise
und kanonische IDs/URLs, aber keine Secrets. Nach jedem erledigten Dashboard-Schritt
die Datei aktualisieren und erneut `pnpm release:mobile:check` ausführen.

Einzelchecks bei Bedarf:

```bash
cd apps/mobile
pnpm submit:check
pnpm dashboard:check
pnpm store:check
```

```bash
pnpm test:cloudlearn-smoke
pnpm --filter @clearn/api test
pnpm --filter @clearn/mobile typecheck
pnpm --filter @clearn/mobile testflight:check
```

## Aktuell bekannte externe Blocker

- `apps/mobile/google-play-service-account.json` fehlt lokal noch.
- `apps/mobile/dashboard-readiness.local.json` fehlt bis die externen Dashboard-Schritte wirklich nachgewiesen sind.
- `apps/mobile/testflight-readiness.local.json` fehlt bis zum ersten echten TestFlight-Smoke.
- Store-Produkte und RevenueCat-Offering sind konfiguriert; ein echter Sandbox-Kauf und die Webhook-Zustellung müssen noch geprüft werden.
- Der iOS-RevenueCat-Key ist in EAS gesetzt. Android-Key und Google-Play-Konfiguration bleiben für einen späteren Android-Build offen.
- Für den App-Store-Produktionsbuild fehlt das App-Store-Provisioning-Profil für `app.clearn` in Expo. Das vorhandene Ad-hoc-Profil ersetzt es nicht.
- Supabase OAuth Provider müssen produktiv aktiviert und auf Gerät getestet werden.
- Echte Ads sind für dieses iOS-Paket deaktiviert. Produktive AdMob-IDs sind dafür nicht erforderlich; vor einer späteren Aktivierung muss die vollständige AdMob-/SSV-Konfiguration geprüft werden.
