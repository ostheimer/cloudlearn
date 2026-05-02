# App Store Privacy & Ads

Stand: 2026-04-05

## Ziel

Dieses Runbook fasst die Privacy- und Ad-Angaben für den App-Store-Release von `clearn` zusammen.
Die wichtigste Regel ist: Die Store-Antworten werden nicht nur aus unserem App-Code abgeleitet, sondern auch aus den eingebundenen SDKs und deren Privacy Manifests.

## Produktregel

- Personalisierte Werbung und darüber hinausgehendes Tracking sind nur nach ausdrücklichem Opt-in aktiv.
- Rewarded Ads bleiben auch ohne Opt-in verfügbar, dann aber nur nicht-personalisiert.
- Der ATT-Dialog erscheint erst kontextuell vor dem ersten relevanten Werbe- oder Tracking-Moment.
- Die ATT-Abfrage wird in v1 nur einmal ausgelöst.

## Was im App Store Connect Privacy Questionnaire berücksichtigt werden muss

- Der Fragebogen muss die eingebundenen SDKs abbilden, nicht nur die eigene App-Logik.
- Für `clearn` sind aktuell relevant:
  - Google Mobile Ads SDK
  - Google User Messaging Platform SDK
- Die von diesen SDKs deklarierten Daten und APIs müssen in die Store-Angaben einfließen.

## Relevante SDK-Hinweise

- Google Mobile Ads SDK deklariert laut eingebettetem Privacy Manifest unter anderem:
  - `Device ID` mit Tracking-Bezug
  - `Advertising Data`
  - `Product Interaction`
  - `Performance Data`
  - `Crash Data`
  - `Other Diagnostic Data`
  - zusätzlich `Coarse Location`
- Google User Messaging Platform SDK deklariert laut eingebettetem Privacy Manifest unter anderem:
  - `Coarse Location`
  - `Performance Data`
  - `Product Interaction`

## Praktische Konsequenz für die Store-Angaben

- Nicht fälschlich "kein Tracking" angeben, nur weil personalisierte Werbung standardmäßig aus ist.
- Stattdessen die tatsächlichen SDK-Daten und den Opt-in-Mechanismus abbilden.
- Die Privacy-Antworten müssen mit dem Privacy Report eines echten iOS-Archives übereinstimmen.
- Wenn ein Nutzer personalisierte Werbung aktiviert, muss die Review-/Privacy-Doku das als Opt-in-Flow erklären.

## Review Notes

- Erklären, dass `clearn` ohne Einwilligung nur nicht-personalisierte Rewarded Ads zeigt.
- Erklären, dass Tracking erst nach ATT-Opt-in aktiviert wird.
- Erklären, dass die App wegen Ad-SDKs relevante Privacy-Manifest-Einträge enthält.
- Auf den Support- und Datenschutzseiten verweisen:
  - [docs/aso/checklist.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/aso/checklist.md)
  - [docs/runbooks/app-store-critical-path.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-critical-path.md)

## Vor Submission prüfen

1. Ein echtes iOS-Archive bauen.
2. Privacy Report prüfen.
3. App Store Connect Privacy Questionnaire mit den SDK-Daten abgleichen.
4. Review Notes und Store-Beschreibung auf die ATT-/Ads-Logik abstimmen.
5. Non-personalized Rewarded-Ads-Fallback auf einem Gerät testen.

## Repo-Audit 2026-05-02

Geprüfte Dateien:

- [apps/mobile/app.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.json)
- [apps/mobile/app.config.js](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.config.js)
- [apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy)
- [apps/mobile/src/features/ads/trackingConsent.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/features/ads/trackingConsent.ts)
- [apps/mobile/src/features/ads/useRewardedAd.native.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/features/ads/useRewardedAd.native.ts)

Ergebnis:

- `NSUserTrackingUsageDescription` ist in `app.json` und im Google-Mobile-Ads-Plugin konfiguriert.
- Die App fragt ATT nicht beim ersten Start ab. Der native Dialog wird erst nach dem In-App-Pre-Prompt ausgelöst, wenn personalisierte Werbung gewählt wird.
- Rewarded Ads werden mit `requestNonPersonalizedAdsOnly: true` geladen, solange kein personalisierter Opt-in aktiv ist.
- Die App-eigene `PrivacyInfo.xcprivacy` deklariert keine eigenen gesammelten Daten und setzt `NSPrivacyTracking` auf `false`.
- Wegen Google Mobile Ads / UMP müssen die SDK-Daten trotzdem im App Store Connect Privacy Questionnaire angegeben werden.

Offen:

- Produktions-AdMob-IDs müssen in EAS/Build-Umgebung gesetzt werden; sonst fällt `app.config.js` auf Google-Test-IDs zurück.
- Ein echtes iOS-Archive muss gebaut und der Privacy Report gegen diese Angaben geprüft werden.
- ATT-Ablehnung, ATT-Opt-in und nicht-personalisierter Rewarded-Ad-Fallback müssen auf einem physischen Gerät getestet werden.
