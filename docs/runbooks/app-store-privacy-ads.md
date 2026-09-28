# App Store Privacy & Ads

Stand: 2026-09-28. Geprüfter iOS-Production-Release **1.0 (5)**,
Commit `53bb91f`, EAS-Build `41320cc2-dc75-45c8-a804-c903fcb6aae9`.

## Aktueller Release

- `apps/mobile/ads-mode.json` setzt `realAdsEnabled=false`.
- `app.config.js` lässt im Production-Profil das Google-Mobile-Ads-Plugin und
  die AdMob-App-ID weg. `react-native.config.js` schließt zusätzlich das native
  Autolinking aus. Google Mobile Ads und Google User Messaging Platform sind
  im geprüften signierten IPA nicht enthalten.
- Der Rewarded-Ad-Flow kehrt vor Anzeigenanfrage und Werbeeinwilligung zurück.
  Es gibt keine Werbung und kein Tracking in diesem Release. Eine freiwillige
  ATT-Zustimmung im Einstellungsweg aktiviert keine Werbung.
- Ohne Sentry-DSN ist `initCrashReporting` im tatsächlichen Hermes-Bundle eine
  leere Funktion; `wrapRootLayout` bleibt unverändert. Die optionale automatische
  Absturzmeldung ist deaktiviert.

## Manifest- und Quellcodeabgleich

Das IPA enthält 15 Privacy Manifeste. Keines deklariert Tracking `true`; es gibt
keine Tracking-Domains. RevenueCat deklariert Kaufhistorie für App-Funktionalität.
Sentrys generisches Manifest ist weiterhin vorhanden und nennt Diagnostikdaten,
obwohl die App dessen Initialisierung im geprüften Bundle nicht ausführt. Die
SDK-Präsenz allein wird deshalb nicht mit aktiver Erfassung gleichgesetzt.

Der Fragebogen muss außerdem die eigenen Datenflüsse abbilden: Konten und
Anzeigenamen, Lerninhalte und Bilder, Reviews und Lernzeiten, kontobezogene
Käufe, Push-Token, Geschlechtsangabe und private Freundeverbindungen. Kaufhistorie
ist durch clearns eigene RevenueCat-Konto-ID verknüpft; Push-Token sind für
App-Funktionalität gespeicherte Gerätekennungen. Apples Kategorie `Contacts`
umfasst den gespeicherten sozialen Graphen, auch ohne Adressbuchzugriff.

Die zehn ASC-Datentypen und ihre Zwecke stehen im
[App Store Privacy Questionnaire](app-store-privacy-questionnaire.md).
Für Build 5 werden keine Werbe-, Standort- oder aktiven Diagnostik-Datentypen
angegeben.

## Grenzen der Evidenz

Geprüft wurden Quellcode und das fertige signierte IPA. Nicht nachgewiesen sind
Netzwerkverkehr auf einem physischen Gerät oder aktuelle Provider- und
Server-Log-Aufbewahrung. Keine Lösch- oder Aufbewahrungszusagen daraus ableiten.
Ein gespeicherter ASC-Entwurf ist kein Nachweis eines veröffentlichten Labels.
Build 5 enthält noch `NSUserTrackingUsageDescription`; App Store Connect
blockiert damit die Veröffentlichung der Antwort „kein Tracking“. Die native
Korrektur und der erneute Abgleich des Nachfolge-IPAs stehen noch aus.

## Falls Werbung später aktiviert wird

Dies ist eine spätere Release-Änderung, kein aktiver Umfang von Build 5:

1. AdMob-SSV und produktive App-/Rewarded-Ad-Unit-IDs vollständig konfigurieren.
2. `realAdsEnabled=true` erst nach entsprechender Freigabe und Verifikation setzen.
3. Dann ist das native Ads-SDK wieder enthalten; dessen neue Manifeste und
   tatsächliche Datenflüsse gegen Datenschutzseite und ASC-Angaben prüfen.
4. ATT-Opt-in, Ablehnung und nicht-personalisierten Fallback auf Gerät prüfen.

Auch eine spätere Sentry-Aktivierung erfordert einen neuen Abgleich der
Diagnostik-Angaben. Development-/Preview-Konfigurationen und ihre lokalen Pods
dürfen nicht als Production-Release-Evidenz verwendet werden.
