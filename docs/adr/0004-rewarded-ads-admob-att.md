# ADR 0004: Rewarded Ads mit AdMob und App Tracking Transparency

- Status: Accepted
- Datum: 2026-07-09

## Kontext

Free-Nutzer sollen LP (Learn Points) auch durch freiwilliges Ansehen von Rewarded Ads verdienen können. Auf iOS verlangt Apple vor Tracking/personalisierter Werbung eine ausdrückliche Einwilligung über App Tracking Transparency (ATT); die Store-Datenschutz-Angaben müssen die eingebundenen Ad-SDKs abbilden.

## Entscheidung

- Rewarded Ads über Google AdMob (`react-native-google-mobile-ads`) als LP-Verdienweg für Free-Nutzer; Pro/Lifetime bleiben werbefrei (`apps/mobile/src/features/ads/useRewardedAd.native.ts`).
- ATT-Consent auf iOS vor personalisierter Werbung: kontextueller In-App-Pre-Prompt, dann der native Dialog; nicht beim ersten Start (`apps/mobile/src/features/ads/trackingConsent.ts`, `app/tracking-preferences.tsx`).
- Opt-out bzw. keine Einwilligung → Ads werden mit `requestNonPersonalizedAdsOnly: true` als nicht-personalisierter Fallback geladen; die Wahl ist in den Tracking-Einstellungen änderbar.
- LP-Gutschrift nicht im Client, sondern serverseitig über AdMob Server-Side Verification (SSV); Store-Datenschutz-Angaben decken die Ad-SDKs ab (`docs/runbooks/app-store-privacy-ads.md`).

## Konsequenzen

- ATT reduziert die Rate personalisierter Werbung und damit die Ad-Einnahmen, ist auf iOS aber Pflicht.
- Nicht-personalisierte Fallback-Ads bleiben ohne Einwilligung verfügbar → LP-Verdienst bleibt für alle Free-Nutzer möglich.
- Google Mobile Ads / User Messaging Platform SDK erzwingen Privacy-Manifest-Einträge und ehrliche Angaben im App Store Connect Privacy Questionnaire (nicht "kein Tracking").
- Abhängigkeit von AdMob und Googles SSV; Produktions-Ad-Unit-IDs müssen gesetzt sein, sonst bricht der Production-Build ab.
