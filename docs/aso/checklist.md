# ASO Checklist

## Store Assets

- App-Name lokalisiert (DE/EN).
- Untertitel mit Kernversprechen.
- Screenshots für Scan, OCR-Korrektur, Review-Flow, Paywall.
- App Preview Video für iOS/Android.
- Screenshots für Auth, Deck-Bibliothek, Offline-Lernen und PDF-Import-MVP.
- TestFlight-/Closed-Beta-Build mit derselben Copy wie Store-Eintrag.

## Metadata

- Primäre Keywords für DACH-Lernmarkt.
- Changelog-Template pro Release.
- Datenschutz- und Support-URL aktuell.
- TestFlight-/Beta-Beschreibung erklärt Kernflow in 2-3 Sätzen.
- Paywall-Text und Store-Beschreibung verwenden dieselben Produktbegriffe.
- Store-Metadata-Entwurf: [docs/aso/store-metadata-draft.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/aso/store-metadata-draft.md)

## Privacy / Ads

- ATT-Flow ist in Review Notes beschrieben: erst kontextueller Pre-Prompt, dann native ATT-Abfrage nur bei Bedarf.
- Rewarded Ads werden in den Store-Texten als nicht-personalisierte Fallback-Variante beschrieben, wenn kein ATT-Opt-in vorliegt.
- App Store Connect Privacy Questionnaire wird gegen die tatsächlich eingebundenen SDKs beantwortet, nicht nur gegen den eigenen App-Code.
- Google Mobile Ads und UMP-Privacy-Manifests sind vor der Einreichung gegen den Privacy Report eines echten iOS-Archives geprüft.
- Privacy-Details, Tracking-Angaben und Review Notes verweisen auf das Runbook [docs/runbooks/app-store-privacy-ads.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-privacy-ads.md).

## Conversion Tracking

- Landing CTA Events (`landing_view`, `cta_click`, `waitlist_signup`).
- Trial-Start und Paid-Conversion im Analytics-Tool.

## Beta-Launch

- DACH-Testgruppe definiert
- Feedback-Kanal definiert
- Known-Issues-Liste vorbereitet
- Onboarding-Texte auf Deutsch geprüft
- Preview-Link und Mobile-Build wurden manuell gegengeprüft
