# Aktuelle lokale Production-Rohaufnahmen

Aufgenommen am 28. September 2026 aus unverändertem App-Quellstand
`53bb91fbe616ce1d4cfa4e8cd53b523db42b8386`.

## Verifizierte Dateien

| Datei | Pixelmaß | Kontext |
| --- | --- | --- |
| `01-home-guest-1242x2688.png` | 1242 × 2688 | iPhone 11 Pro Max, deutsche Gast-Home, keine Anmeldung |
| `01-home-guest-1179x2556.png` | 1179 × 2556 | iPhone 15, deutsche Gast-Home, keine Anmeldung; Devpost-Rohaufnahme |

Beide Dateien wurden direkt mit `xcrun simctl io … screenshot` erstellt und
visuell geprüft. Keine Skalierung, kein Geräte-Rahmen, keine nachgebaute UI,
keine Marketing-Overlays. Der Simulator-Statusbalken wurde auf 9:41, volles
WLAN und vollen Akku gesetzt. Die Home ist scrollbar; das Bild zeigt den
tatsächlich sichtbaren ersten Ausschnitt.

Eine separate Aufnahme mit der iOS-Bestätigung „In clearn öffnen?“ wurde
nicht in dieses Paket übernommen; sie ist kein Storematerial.

## Build-Kontext

- Kostenloser lokaler Release-Compile, Production-Variablen mittels
  `eas env:exec production`, kein EAS-Cloud-Build gestartet.
- `APP_VARIANT=production`, `EXPO_PUBLIC_APP_VARIANT=production`,
  `RELEASE_PLATFORM=ios`, `.env`-Laden deaktiviert.
- Native Production-Konfiguration: kein Google-Mobile-Ads-Pod und kein
  Google-Mobile-Ads-Bundle im erzeugten App-Paket.
- Eingebettetes `main.jsbundle`, kein Metro und keine Dev-Client-Oberfläche.
- App-Paket: `clearn`, Bundle-ID `app.clearn`, Version 1.0, lokale Buildnummer 1.
  Die lokale Nummer wurde nicht auf Apples Cloud-Buildnummer 5 gesetzt.
- Xcode 27.0, iOS-26.5-Simulatoren, Ad-hoc-Simulator-Signatur.
- Nur lokale Kompatibilitätsmaßnahmen: Deployment-Target per Build-Argument
  auf 15.1; in der ignorierten RevenueCat-5.57.1-Pod-Kopie wurde der private
  `PaywallColor`-Initializer in den Struct verschoben, um den Swift-Compilerfehler
  zu beheben. Kein getrackter App-Code und keine UI wurden geändert.
- Erzeugte native Dateien bleiben unter dem ignorierten `apps/mobile/ios/`.

## Grenzen und Fortsetzung

Der lokale Production-Build startet erfolgreich. Weitere Routen sind derzeit
durch die Systembestätigung beim Entwickler-Deeplink blockiert. Die echte
Xcode-Auswahl lautet `/Applications/Xcode.app/Contents/Developer`; eine
`Simulator.app` existiert innerhalb dieses Xcode-Bundles nicht. CUA meldet für
den vollständigen erwarteten Pfad „Invalid app“. Keine Registry- oder
Berechtigungsänderung wurde vorgenommen.

Bibliothek/Lernen zeigen als Gast laut aktuellem Quellcode Anmeldehinweise;
vollständige Bibliotheks- und Lernsessionaufnahmen sind noch nicht erstellt.
Das bestätigte Review-Konto wurde hier nicht angemeldet, sein privater
Credential-Dateiinhalt wurde nicht gelesen. Kein neuer Film wurde erstellt.

Privacy-Manifest lokal gelesen: RevenueCat deklariert PurchaseHistory mit
linked=false und tracking=false sowie global NSPrivacyTracking=false; keine
Geräte-ID. Das ist Pod-Evidenz, keine vollständige App-Datenschutzdeklaration.

Die beiden sauberen Home-Aufnahmen wurden in das Release-Nachweispaket
übernommen. Die 1242-×-2688-Aufnahme wurde anschließend laut ASC-Readback als
erstes Storebild hochgeladen. Ihre Herkunft bleibt der lokale Release-Build 1,
nicht das Store-IPA von Build 5; der Upload ändert diese Prüfgrenze nicht.
