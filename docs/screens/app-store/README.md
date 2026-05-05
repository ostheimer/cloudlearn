# App-Store-Screenshots

Stand: 2026-05-06

## Ziel

Diese Mappe hält den reproduzierbaren Screenshot-Workflow für App Store Connect.
Die finalen Upload-Bilder werden aus echten App-Screens erzeugt und auf
`1242 x 2688` gerendert.

## Warum neue Screens nötig sind

Die älteren Screens in [docs/screens/screenshots](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/screens/screenshots)
sind echte Simulator-Screens, aber nicht mehr final für den Store:

- Login zeigt nicht den aktuellen OAuth-/Gastmodus-Stand.
- Paywall enthält noch eine RevenueCat-Konfigurationswarnung.
- Einige Produktzustände sind für Review/Conversion zu technisch oder zu leer.
- Die Maße `1206 x 2622` sind nicht direkt die in App Store Connect angezeigten
  Upload-Größen.

## Benötigte Rohscreens

Lege die finalen Rohscreens hier ab:

```text
docs/screens/app-store/raw/de-DE/01-home.png
docs/screens/app-store/raw/de-DE/02-scan.png
docs/screens/app-store/raw/de-DE/03-deck.png
docs/screens/app-store/raw/de-DE/04-learn.png
docs/screens/app-store/raw/de-DE/05-profile.png
```

Die Rohscreens sollen aus einem echten TestFlight- oder Release-nahen Build
kommen. Keine roten Debug-Screens, keine Test-Key-Warnungen, keine leeren
Scaffold-Zustände.

## Shotlist

1. `01-home.png`: Home mit Tagesziel, Streak und primärer Lernaktion
2. `02-scan.png`: Scan/Text/PDF-Einstieg ohne kaputte Login- oder Berechtigungszustände
3. `03-deck.png`: Deck- oder Karten-Ergebnis nach einem erfolgreichen Import
4. `04-learn.png`: aktive Lernsession mit Karte und Bewertungsaktionen
5. `05-profile.png`: Profil mit Konto, Datenschutz, Face ID, Support und Abo-Verwaltung

## Erzeugen

```bash
pnpm --filter @clearn/mobile screenshots:store
```

Output:

```text
docs/screens/app-store/ios/de-DE/01-home.png
docs/screens/app-store/ios/de-DE/02-scan.png
docs/screens/app-store/ios/de-DE/03-deck.png
docs/screens/app-store/ios/de-DE/04-learn.png
docs/screens/app-store/ios/de-DE/05-profile.png
```

## Draft aus alten Screens

Nur zur Layoutkontrolle, nicht für Upload:

```bash
pnpm --filter @clearn/mobile screenshots:store -- --legacy-doc-screens --output /tmp/clearn-app-store-draft
```

## Upload-Regel

- Finalbilder müssen `1242 x 2688` haben.
- Format: `.png`.
- Deutsche sichtbare Texte müssen echte Umlaute verwenden.
- Vor Upload jedes Bild öffnen und prüfen, ob die App-Zustände dem aktuellen
  Build entsprechen.

## Quellen

- Apple Screenshot-Spezifikationen:
  `https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications`
- Apple Upload-Hinweise:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots`
