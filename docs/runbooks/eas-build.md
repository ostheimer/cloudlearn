# EAS Build – Runbook

Dieses Runbook beschreibt alle Schritte für den ersten EAS-Build und die Einreichung im App Store / Play Store.

## Voraussetzungen

| Was | Wo erstellen |
|-----|-------------|
| **Expo-Account** | [expo.dev](https://expo.dev) – Konto: `aostheimer` |
| **Apple Developer Account** | [developer.apple.com](https://developer.apple.com) (99 USD/Jahr) |
| **Google Play Console** | [play.google.com/console](https://play.google.com/console) (einmalig 25 USD) |
| **AdMob-Account** | [admob.google.com](https://admob.google.com) |
| **RevenueCat-Account** | [revenuecat.com](https://revenuecat.com) |

---

## Schritt 1 – AdMob einrichten

1. **AdMob-App registrieren:**
   - iOS: AdMob → Apps → App hinzufügen → iOS → App-Name: "clearn" → App-ID notieren (`ca-app-pub-XXXX~XXXX`)
   - Android: gleich für Android

2. **Ad Unit erstellen:**
   - Typ: "Rewarded" → Name: "clearn Rewarded" → Ad Unit ID notieren (`ca-app-pub-XXXX/XXXX`)

3. **Env-Variablen in EAS Secrets setzen:**
   ```bash
   eas secret:create --name EXPO_PUBLIC_ADMOB_APP_IOS_ID --value "ca-app-pub-XXXX~XXXX" --scope project
   eas secret:create --name EXPO_PUBLIC_ADMOB_APP_ANDROID_ID --value "ca-app-pub-XXXX~XXXX" --scope project
   eas secret:create --name EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID --value "ca-app-pub-XXXX/XXXX" --scope project
   eas secret:create --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID --value "ca-app-pub-XXXX/XXXX" --scope project
   ```

4. **`app.json` aktualisieren** – ersetze die Test-App-IDs durch die echten (werden auch in `app.config.js` für Production-Builds gesetzt).

---

## Schritt 2 – google-services.json erstellen (Android Firebase)

Für Push Notifications und Google Services:

1. [Firebase Console](https://console.firebase.google.com) → Neues Projekt → "clearn"
2. Android-App registrieren → Package: `app.clearn`
3. `google-services.json` herunterladen → nach `apps/mobile/google-services.json` kopieren
4. Die Datei ist in `.gitignore` – muss vor jedem Build vorhanden sein.

> **Hinweis:** Für Expo Push Notifications (ohne FCM direkt) ist Firebase optional.
> EAS übernimmt APNs/FCM-Zertifikate automatisch.

---

## Schritt 3 – Credentials konfigurieren (automatisch via EAS)

EAS verwaltet iOS-Zertifikate und Android-Keystore automatisch:

```bash
# Im apps/mobile Verzeichnis
cd apps/mobile

# iOS Credentials einrichten (Apple Developer Login nötig)
eas credentials --platform ios

# Android Keystore (EAS generiert automatisch)
eas credentials --platform android
```

---

## Schritt 4 – Ersten Build starten

```bash
cd apps/mobile

# Development Build (für internes Testen mit Expo Go-Ersatz)
eas build --profile development --platform all

# Preview Build (APK für interne Tester)
eas build --profile preview --platform android

# Production Build (für App Store / Play Store)
eas build --profile production --platform all
```

> Build-Status verfolgen: [expo.dev/accounts/aostheimer/projects/clearn/builds](https://expo.dev/accounts/aostheimer/projects/clearn/builds)

---

## Schritt 5 – App einreichen

```bash
# Nach erfolgreichem Production-Build:

# iOS → App Store Connect (TestFlight)
eas submit --platform ios --latest

# Android → Play Store (Internal Testing Track)
eas submit --platform android --latest
```

Für `eas submit --platform ios`:
- `appleId`: `office@ostheimer.at` (bereits in `eas.json` konfiguriert)
- `ascAppId`: App Store Connect App ID (wird bei erster Einreichung erstellt)
- `appleTeamId`: Aus Apple Developer Account
- Runbook mit den exakten Restwerten: [docs/runbooks/eas-submit-values.md](/docs/runbooks/eas-submit-values.md)

Für `eas submit --platform android`:
- Service Account JSON erstellen (Play Console → Setup → API access)
- Nach `apps/mobile/google-play-service-account.json` speichern (in `.gitignore`)

---

## Schritt 6 – OTA-Updates (nach initialem Release)

```bash
# Ohne neuen Store-Release – direkt an Nutzer ausliefern:
eas update --channel production --message "Bugfix: ..."

# Preview-Update:
eas update --channel preview --message "Feature-Test: ..."
```

---

## Wichtige Bundle-IDs / Package Names

| Platform | ID |
|----------|----|
| iOS Bundle ID | `app.clearn` |
| Android Package | `app.clearn` |
| EAS Project ID | `5495e637-0223-4924-a778-8683dafaf264` |
| Expo-Konto | `aostheimer` |

---

## Checkliste vor erstem Production-Build

- [ ] Apple Developer Account aktiv (99 USD/Jahr bezahlt)
- [ ] Google Play Console Account aktiv (25 USD einmalig bezahlt)
- [ ] AdMob App-IDs (iOS + Android) in EAS Secrets gesetzt
- [ ] `google-services.json` vorhanden (aus Firebase Console)
- [ ] RevenueCat iOS + Android Keys in `.env.local` / EAS Secrets
- [ ] App-Icons erstellt (`icon.png` 1024×1024, `adaptive-icon.png` 1024×1024)
- [ ] Screenshots für App Store (6.7" + 5.5" iPhone, optionale iPad)
- [ ] App-Beschreibung (DE + EN) für App Store / Play Store vorbereitet
- [ ] Datenschutzerklärung URL vorhanden (Pflicht für App Store)
- [ ] ATT-Text in `app.json`, `app.config.js` und `Info.plist` ist deckungsgleich und beschreibt zustimmungsbasierte personalisierte Werbung
- [ ] App Store Connect Privacy Questionnaire ist anhand der eingebundenen SDK-Privacy-Manifests geprüft
- [ ] Ein echter iOS-Archive-/Privacy-Report wurde gegen Google Mobile Ads und UMP gegengeprüft
- [ ] `ascAppId` und `appleTeamId` in `eas.json` `submit` eingetragen
- [ ] TestFlight-Smoke wurde auf einem physischen iPhone bestanden und lokal mit `pnpm --filter @clearn/mobile testflight:check` verifiziert
