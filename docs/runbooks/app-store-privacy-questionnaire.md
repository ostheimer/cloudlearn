# App Store Privacy Questionnaire

Stand: 2026-09-28. Gilt für den geprüften iOS-Production-Build **1.0 (5)**,
Commit `53bb91f`, EAS-Build `41320cc2-dc75-45c8-a804-c903fcb6aae9`.

## Grundantworten

- Datenschutzrichtlinie: `https://clearn-web.vercel.app/privacy`
- Erfasst diese App Daten? **Ja**.
- Nutzt diese App Tracking? **Nein** für diesen Release.

Konten, gespeicherte Lerninhalte, Käufe, Lernfortschritt, Push-Registrierungen
und der private Freundesgraph werden für die App-Funktionen verarbeitet.
`realAdsEnabled=false` schließt Google Mobile Ads und Google User Messaging
Platform aus dem nativen Production-Build aus. Auch eine ATT-Zustimmung
aktiviert keine Werbung. Die optionale Sentry-Absturzmeldung ist deaktiviert.

## Datentypen für diesen Release

Alle zehn Datentypen sind mit dem Nutzer verknüpft und werden nicht für Tracking
verwendet. Dies ist der gespeicherte ASC-Entwurfsumfang; ein gespeicherter
Entwurf ist noch kein Nachweis der Veröffentlichung des Labels.

| Apple Data Type | Linked to User | Tracking | Zwecke | Datenfluss |
|---|---:|---:|---|---|
| Name | Ja | Nein | App Functionality | Anzeigename im Kontoprofil, für Freunde und Rangliste |
| Email Address | Ja | Nein | App Functionality | Authentifizierung und Kontoverwaltung über Supabase |
| Photos or Videos | Ja | Nein | App Functionality | Ausgewählte Lernbilder und gespeicherte Bildkarten |
| Other User Content | Ja | Nein | App Functionality | Texte, PDFs, importierte Inhalte, Decks und Karten |
| User ID | Ja | Nein | App Functionality | Konto-ID für API, Synchronisierung und RevenueCat |
| Device ID | Ja | Nein | App Functionality | Kontoassoziierter Expo-Push-Token nach Benachrichtigungsfreigabe |
| Purchase History | Ja | Nein | App Functionality | Käufe, Restore und Entitlements über Apple, RevenueCat und API |
| Product Interaction | Ja | Nein | App Functionality | Gespeicherte Reviews, Bewertungen, Lernzeiten und Fortschritte |
| Other Data Types | Ja | Nein | App Functionality, Product Personalization | Freiwillige Geschlechtsangabe für persönliche Anrede |
| Contacts | Ja | Nein | App Functionality | Dauerhaft gespeicherte Freundeverbindungen; kein Geräteadressbuch-Zugriff |

Apple zählt einen sozialen Graphen zu `Contacts`. Die mobile Funktion
`friend-add` sendet einen Freunde-Code an `POST /api/v1/friends/by-code`; der
Server speichert beide Kontobeziehungen in `friend_connections`.

RevenueCats Standardmanifest nennt Kaufhistorie als nicht verknüpft. clearn
übergibt jedoch die Supabase-Konto-ID als `appUserID`; deshalb sind Kaufhistorie
und Nutzer-ID hier **verknüpft**. Der Push-Token bleibt eine Gerätekennung für
App-Funktionalität, auch ohne Werbe-SDK.

## Binary-Evidenz

Das signierte IPA wurde nach Fertigstellung des Builds gelesen:

- Bundle `app.clearn`, Version `1.0`, Build `5`.
- Keine GoogleMobileAds-, UMP- oder RNGoogleMobileAds-Komponenten.
- 15 eingebettete Privacy Manifeste, keine Tracking-Domains und kein globaler
  oder datentypbezogener Tracking-Wert `true`.
- RevenueCat deklariert `Purchase History` für `App Functionality`.
- Sentry ist als native Abhängigkeit samt generischem Manifest vorhanden;
  dieses nennt Crash-, Performance- und sonstige Diagnostikdaten. Im tatsächlichen
  Hermes-Bundle ist `initCrashReporting` jedoch eine leere Funktion und
  `wrapRootLayout` gibt die Komponente unverändert zurück. Die fehlende DSN wurde
  im Production-Bundle wegoptimiert. Das Manifest allein belegt keine aktive
  Diagnostik-Erfassung durch clearn.

Für diesen Release werden deshalb **Advertising Data, Coarse Location und die
drei Diagnostics-Datentypen nicht als aktive Erfassung angegeben**. Der
verbleibende ATT-Berechtigungstext belegt allein kein Tracking. Er blockiert
jedoch in App Store Connect die Veröffentlichung der Antwort „kein Tracking“.
Nach Korrektur der nativen Konfiguration muss das Nachfolge-IPA erneut geprüft
werden. Build 5 ist damit Binary-Evidenz für inaktive Ads/Sentry, kein Nachweis
der gelösten Apple-Metadatenhürde.

## Umfang der Prüfung und spätere Releases

Die Prüfung verbindet Quellcode und signiertes IPA. Sie ersetzt keinen
Netzwerkmitschnitt auf einem physischen Gerät und keine aktuelle Prüfung der
Aufbewahrung von Provider- oder Server-Logs. Daraus werden keine Zusagen zu
deren Löschfristen oder Aufbewahrung abgeleitet. Das app-eigene Manifest allein
bildet die über die API gespeicherten Daten nicht vollständig ab.

Bei jeder Aktivierung von Werbung, Sentry oder weiteren Datenflüssen die
Datenschutzseite, ASC-Angaben und das neue signierte IPA erneut abgleichen.
Lokale Development-/Preview-Pods sind kein Beleg für ein Production-Binary.

## Review Notes

```text
clearn 1.0 (5) zeigt keine Werbung und verwendet kein Tracking. Google Mobile Ads und Google User Messaging Platform sind aus diesem Production-Build ausgeschlossen. Die optionale Sentry-Absturzmeldung ist deaktiviert. Konten, Lerninhalte, Käufe, Lernfortschritt, Push-Benachrichtigungen und Freundeverbindungen werden für die App-Funktionen verarbeitet.
```

## Quellen und Code

- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [RevenueCat Apple App Privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- `apps/mobile/app.config.js` und `apps/mobile/react-native.config.js`: Ads-Ausschluss
- `apps/mobile/src/lib/crashReporting.ts`: Sentry-Gate
- `apps/mobile/src/features/paywall/revenuecat.ts`: kontobezogene RevenueCat-ID
- `apps/mobile/app/_layout.tsx`: Push-Registrierung
- `apps/api/app/api/v1/friends/by-code/route.ts`: Freundesgraph
- [Release-Privacy-Prüfung](app-store-privacy-ads.md)
