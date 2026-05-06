# App Store Privacy Questionnaire

Stand: 2026-05-06

## Ziel

Diese Datei ist ein ausfüllbarer Entwurf für den App-Store-Connect-Bereich
`App-Datenschutz`.

Wichtig: Diese Antworten sind absichtlich konservativ. Sie müssen vor der
Einreichung gegen den Privacy Report eines echten iOS-Archives geprüft werden.
Apple verlangt, dass auch Datenpraktiken integrierter Drittanbieter-SDKs
angegeben werden.

## Vor dem Ausfüllen

- [ ] Echtes iOS-Archive mit den finalen EAS-/Produktions-Env-Werten bauen.
- [ ] Privacy Report aus dem Archive exportieren.
- [ ] Google Mobile Ads, Google User Messaging Platform und RevenueCat gegen den
      Privacy Report abgleichen.
- [ ] Prüfen, ob im finalen Build produktive AdMob-IDs statt Test-IDs verwendet
      werden.
- [ ] Prüfen, ob der Rewarded-Ad-Flow ohne ATT-Opt-in weiterhin nur
      nicht-personalisierte Ads lädt.

## App Store Connect — Grundantworten

### Datenschutzrichtlinie

```text
https://clearn-web.vercel.app/privacy
```

### Erfasst diese App Daten?

Antwort: `Ja`

Begründung:

- Konto und Synchronisierung erfassen E-Mail, User-ID und Session-Kontext.
- Lernfunktionen verarbeiten importierte Inhalte, Decks, Karten und Reviews.
- Käufe/Restore laufen über Apple, RevenueCat und die clearn-API.
- Google Mobile Ads und Google User Messaging Platform deklarieren zusätzliche
  SDK-Daten.

### Nutzt diese App Tracking?

Antwort: `Ja`

Begründung:

- Google Mobile Ads deklariert `Device ID` als `Tracking`.
- Personalisierte Werbung ist nur nach ATT-Opt-in aktiv.
- Ohne ATT-Opt-in lädt clearn Rewarded Ads nicht-personalisiert.

Nicht `Nein` wählen, solange Google Mobile Ads eingebunden ist und
personalisierte Werbung nach Zustimmung technisch möglich bleibt.

## Data Types — Entwurf

### Contact Info

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Email Address | Ja | Nein | App Functionality, Account Management, Developer Communications |

Notiz: E-Mail wird für Auth, Konto, Passwort-Zurücksetzung, Support und
Reviewer-/Testkonto-Flows verwendet.

### User Content

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Photos or Videos | Ja | Nein | App Functionality |
| Other User Content | Ja | Nein | App Functionality |

Notiz: Fotos/PDFs/Texte werden verarbeitet, um Karteikarten zu erzeugen.
Decks, Karten, Reviews und importierte Lerninhalte sind nutzergenerierte
Inhalte. Falls der finale Build keine PDFs oder URLs stabil unterstützt, müssen
Store-Text und diese Hinweise enger formuliert werden.

### Purchases

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Purchase History | Ja | Nein | App Functionality |

Notiz: RevenueCat deklariert `Purchase History` nicht als Tracking. Da clearn
Entitlements serverseitig einem Konto zuordnet, ist `Linked to User` hier
konservativ auf `Ja` gesetzt.

### Identifiers

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| User ID | Ja | Nein | App Functionality |
| Device ID | Ja | Ja | Third-Party Advertising, Developer Advertising, Analytics |

Notiz: `Device ID` stammt aus Google Mobile Ads. Das eingebettete
Privacy Manifest deklariert diesen Datentyp als Tracking.

### Usage Data

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Product Interaction | Ja | Nein | App Functionality, Analytics, Third-Party Advertising, Developer Advertising |
| Advertising Data | Ja | Nein | Third-Party Advertising, Developer Advertising, Analytics |

Notiz: Google Mobile Ads deklariert `Product Interaction` und `Advertising Data`
als linked, aber nicht als Tracking. Wenn der Privacy Report oder eine
Produktions-AdMob-Konfiguration davon abweicht, diese Zeile aktualisieren.

### Location

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Coarse Location | Ja | Nein | Third-Party Advertising, Developer Advertising, Analytics, App Functionality |

Notiz: Die App fragt keine Standortberechtigung an. `Coarse Location` stammt aus
den Ad-/Consent-SDKs. Google Mobile Ads deklariert linked, Google User
Messaging Platform deklariert nicht linked. Deshalb ist `Linked to User`
konservativ auf `Ja` gesetzt.

### Diagnostics

| Data Type | Linked to User | Tracking | Zwecke |
|---|---:|---:|---|
| Crash Data | Nein | Nein | Analytics |
| Performance Data | Nein | Nein | Analytics, App Functionality, Third-Party Advertising, Developer Advertising |
| Other Diagnostic Data | Nein | Nein | Analytics, Third-Party Advertising, Developer Advertising |

Notiz: Diese Angaben stammen primär aus den eingebetteten SDK-Privacy-Manifests.

## Nicht angeben, solange sich der Scope nicht ändert

- Precise Location
- Contacts
- Health
- Fitness
- Financial Info
- Sensitive Info
- Browsing History
- Search History
- Audio Data
- Gameplay Content
- Environment Scanning

Wenn später Community-Decks, Social Features, Audio-Upload, eigene Analytics
oder zusätzliche SDKs eingebaut werden, muss dieser Fragebogen neu geprüft
werden.

## Review-/ATT-Erklärung

Für Review Notes und Datenschutzkontext:

```text
clearn zeigt ohne ATT-Opt-in nur nicht-personalisierte Rewarded Ads. Personalisierte Werbung und darüber hinausgehendes Tracking werden erst nach expliziter Zustimmung aktiviert. Der native ATT-Dialog erscheint nicht beim ersten App-Start, sondern kontextuell vor einem relevanten Werbe- oder Tracking-Moment.
```

## Lokale Prüfbefehle

Relevante eingebettete Privacy Manifests prüfen:

```bash
plutil -p apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy
plutil -p apps/mobile/ios/Pods/Google-Mobile-Ads-SDK/Frameworks/GoogleMobileAdsFramework/GoogleMobileAds.xcframework/ios-arm64/GoogleMobileAds.framework/PrivacyInfo.xcprivacy
plutil -p apps/mobile/ios/Pods/GoogleUserMessagingPlatform/Frameworks/Release/UserMessagingPlatform.xcframework/ios-arm64/UserMessagingPlatform.framework/PrivacyInfo.xcprivacy
plutil -p apps/mobile/ios/Pods/RevenueCat/Sources/PrivacyInfo.xcprivacy
plutil -p apps/mobile/ios/Pods/PurchasesHybridCommon/ios/PurchasesHybridCommon/PurchasesHybridCommon/PrivacyInfo.xcprivacy
```

## Quellen

- Apple App Privacy Details:
  `https://developer.apple.com/app-store/app-privacy-details/`
- Apple Manage App Privacy:
  `https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy`
- Apple User Privacy and Data Use:
  `https://developer.apple.com/app-store/user-privacy-and-data-use/`
- Lokaler Audit:
  [docs/runbooks/app-store-privacy-ads.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-privacy-ads.md)
