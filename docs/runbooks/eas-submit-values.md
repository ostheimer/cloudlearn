# EAS Submit Values

Stand: 2026-04-05

## Ziel

Dieses Runbook hält nur die wenigen externen Werte fest, die für eine nicht-interaktive Store-Submission noch außerhalb des Repos ergänzt werden müssen.

Repo-seitig ist der Submit-Pfad in [apps/mobile/eas.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/eas.json) bereits vorbereitet.

## Bereits im Repo gesetzt

- iOS:
  - `appleId`: `office@ostheimer.at`
  - `sku`: `app.clearn`
- Android:
  - `applicationId`: `app.clearn`
  - `track`: `internal`
  - `releaseStatus`: `completed`
  - `serviceAccountKeyPath`: `./google-play-service-account.json`

## Noch extern zu besorgen

### iOS

- `ascAppId`
  - Quelle: App Store Connect → App auswählen → App Store → App Information → `Apple ID`
  - Ziel: `submit.production.ios.ascAppId` in [apps/mobile/eas.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/eas.json)
- `appleTeamId`
  - Quelle: Apple Developer / App Store Connect Team
  - Ziel: `submit.production.ios.appleTeamId` in [apps/mobile/eas.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/eas.json)

### Android

- `google-play-service-account.json`
  - Quelle: Google Play Console → Setup → API access
  - Zielpfad: [google-play-service-account.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/google-play-service-account.json)
  - Die Datei ist bereits in `.gitignore`.

## Prüfen

Im Mobile-Verzeichnis:

```bash
pnpm submit:check
```

Der Check schlägt absichtlich fehl, solange `ascAppId`, `appleTeamId` oder die Play-Service-Datei fehlen.

## Submission-Befehle

### iOS

```bash
cd apps/mobile
pnpm submit:ios
```

### Android

```bash
cd apps/mobile
pnpm submit:android
```

## Expo-Referenz

- Expo-Doku zu `eas.json` Submit-Profilen: [Configure EAS Submit with eas.json](https://docs.expo.dev/submit/eas-json/)
- Expo-Doku zu iOS-Submission inkl. `ascAppId`: [Submit to the Apple App Store](https://docs.expo.dev/submit/ios/)
