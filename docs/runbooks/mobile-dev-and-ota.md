# Mobile: Simulator-Test & Auslieferung (OTA vs. Build)

Dieses Runbook beschreibt, **wie man die clearn Mobile-App (`apps/mobile`, Expo/React Native) lokal testet und aufs Handy bringt**. Es existiert, weil dieser Ablauf vorher nirgends klar dokumentiert war und in neuen Sessions immer wieder neu erraten wurde.

## Umgebung (der Entwicklungs-Mac)

Auf dem verwendeten Mac ist alles vorhanden — ein Agent hier **kann diese Schritte selbst ausführen**, es braucht keine zweite Person:

| Werkzeug | Status |
|----------|--------|
| Xcode + iOS-Simulatoren | installiert (iPhone 16/17, iOS 26.x) |
| CocoaPods (`pod`) | installiert |
| EAS CLI (`eas`) | installiert, **eingeloggt als `aostheimer` (office@ostheimer.at)** |
| Expo (lokal in `apps/mobile`) | SDK 54 |
| Node | v20 |

Weil der EAS-CLI hier eingeloggt ist, laufen `eas build`, `eas submit` und (sobald aktiviert) `eas update` **direkt von diesem Mac**.

## Lokal im Simulator testen

Die App nutzt eigene Native-Module (expo-camera, expo-local-authentication, RevenueCat, AdMob …). **Expo Go reicht daher nicht** — es braucht einen Dev-Build.

```bash
cd apps/mobile
# Einmalig bzw. nach Native-Änderungen: Dev-Build kompilieren und im Simulator installieren
npx expo run:ios --device "iPhone 16 Pro"     # erstes Mal: Prebuild + pod install + xcodebuild (mehrere Minuten)

# Danach für reine JS/TS-Änderungen nur den Metro-Server:
pnpm --filter @clearn/mobile dev              # = expo start; Änderungen laden live in den Dev-Build
```

### Einen bestimmten Screen / Deep-Link testen

Deep-Links (Schema `clearn://`) lassen sich im laufenden Simulator direkt öffnen — ideal, um z. B. den „Geteiltes Deck"-Screen ohne Klickweg zu prüfen:

```bash
xcrun simctl openurl booted "clearn://deck/share/<share-token>"
xcrun simctl io booted screenshot /tmp/screen.png   # Screenshot zur Kontrolle
```

## Aufs Handy bringen: die zwei Wege

```
Änderung  ─┬─  nur JS/TS (Screens, Knöpfe, Logik, expo-router-Routen)
           │      → OTA-Update (eas update)  → schnell, ohne App Store
           │        ⚠️ AKTUELL NICHT AKTIV — siehe unten
           │
           └─  Native (neues Modul, Berechtigung, SDK-/Version-Bump)
                  → eas build  → TestFlight / Store  → langsamer
```

### ⚠️ Wichtiger Ist-Zustand: OTA ist NICHT verdrahtet

`app.json` enthält zwar einen `updates.url`-Block, **aber das Paket `expo-updates` ist NICHT installiert.** Damit greifen Produktions-OTA-Updates (`eas update`) **nicht** — die Konfiguration ist derzeit wirkungslos.

Was bisher „over the air" war, war der **Dev-Workflow**: ein per Kabel installierter Dev-Build, der seinen JS-Code über den Metro-Server (WLAN/Tunnel) nachlädt. Das ist reines Entwickeln, **kein** Produktions-OTA für Endnutzer.

**Solange `expo-updates` fehlt, erreicht JEDE App-Änderung das Handy nur über einen neuen `eas build` (+ Installation/TestFlight), nicht über `eas update`.**

### Echtes OTA aktivieren (wenn gewünscht)

```bash
cd apps/mobile
npx expo install expo-updates      # Paket hinzufügen
# danach EINMAL neu bauen, damit der Updates-Runtime im Binary steckt:
eas build --profile preview --platform ios
# ab dann greifen JS-only-Updates über:
eas update --channel preview -m "Beschreibung"
```

Die Kanäle sind in `eas.json` definiert (`preview`, `production`); `runtimeVersion.policy = "appVersion"` — ein OTA-Update erreicht nur Builds mit passender Runtime-Version.

## Auslieferungs-Historie (Stand zuletzt geprüft)

- Bisher existiert mindestens ein **EAS-Build** (Android, Profil `preview`, SDK 54).
- **Keine** produktiven `eas update`-OTA-Updates (mangels `expo-updates`).

Prüfen mit:
```bash
eas build:list --limit 5 --non-interactive
eas update:list --limit 5     # (braucht branch/channel)
```

## Testbarkeit in Agent-Sessions

- **Web/API**: lokal + gegen Live-Deployments voll testbar (Playwright, Preview-Server).
- **Mobile-Screens**: im **iOS-Simulator auf diesem Mac** testbar (`expo run:ios` + `simctl openurl`). In Umgebungen ohne diesen Mac/Simulator nicht visuell testbar — dann auf `typecheck` + API-E2E stützen und das offen sagen.
