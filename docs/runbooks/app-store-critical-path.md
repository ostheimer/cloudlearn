# App Store Critical Path

Stand: 2026-04-04

## Ziel

Diese Datei bündelt die aktuell relevanten P0/P1/P2-Themen bis zur Veröffentlichung von `clearn` im App Store.
Sie ersetzt nicht die Fachdokumente, sondern verdichtet sie zu einer abarbeitbaren Release-Liste.

## Bereits vorhandene Detaildokumente

- Kanonische Identitäten / URLs / Env-Namen: [docs/runbooks/product-identities.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/product-identities.md)
- EAS / Build / Submit: [docs/runbooks/eas-build.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/eas-build.md)
- RevenueCat / IAP Setup: [docs/monetization/REVENUECAT_SETUP.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/monetization/REVENUECAT_SETUP.md)
- OAuth Setup: [docs/runbooks/mobile-oauth-setup.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/mobile-oauth-setup.md)
- App Store Privacy / Ads: [docs/runbooks/app-store-privacy-ads.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-privacy-ads.md)
- Release-Gates: [docs/runbooks/release-gates.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/release-gates.md)
- ASO / Store Assets: [docs/aso/checklist.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/aso/checklist.md)
- Restore / Incident: [docs/runbooks/restore-test.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/restore-test.md)

## Beschlossene Produktentscheidungen

- Konto-Löschung:
  - sofortig und endgültig
  - alle Lerninhalte und Fortschritte vollständig löschen
  - kein automatisches Beenden von Apple-/Google-Abos
  - klarer Hinweis, dass Abos separat im jeweiligen Store verwaltet werden müssen
- Login in v1:
  - E-Mail/Passwort
  - Google Sign-In
  - Apple Sign-In
- Werbung / Tracking zum Launch:
  - aktiv
  - personalisiertes Tracking und personalisierte Werbung erst nach ATT-Opt-in
  - Rewarded Ads auch ohne ATT-Zustimmung erlaubt, dann aber nur nicht-personalisiert

## Geplanter ATT-Flow

- ATT wird nicht beim ersten App-Start gezeigt, sondern erst kontextuell vor dem ersten relevanten Werbe- oder Tracking-Moment.
- Vor dem nativen ATT-Dialog gibt es einen kurzen In-App-Pre-Prompt mit dem Zweck: personalisierte Werbung nur mit Zustimmung, sonst bleibt die App bei nicht-personalisierten Rewarded Ads.
- Die ATT-Abfrage wird in v1 nur einmal ausgelöst.
- Bei Ablehnung laufen Rewarded Ads weiter, aber ausschließlich nicht-personalisiert.
- Personalisierte Werbung oder jedes darüber hinausgehende Tracking wird erst nach explizitem Opt-in aktiviert.
- Wenn der Nutzer die Anfrage ablehnt, wird in v1 nicht erneut nachgefragt; spätere Änderungen laufen über einen freiwilligen Einstellungsweg.

## P0 — Harte Release-Blocker

- [ ] Identitäten und Konfiguration vereinheitlichen.
  - Bundle ID, Android Package, RevenueCat App IDs, Deep Links, Domains und Env-Namen müssen konsistent sein.
  - Kanonische Referenz: [docs/runbooks/product-identities.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/product-identities.md)
  - Repo-seitig bereits bereinigt:
    - kanonische Identitäten dokumentiert
    - RevenueCat-Doku auf `app.clearn` als App-ID korrigiert
    - OAuth-Doku auf `clearn-web` als Produktions-Webziel korrigiert
    - Mobile `.env`-Template auf die tatsächlichen RevenueCat-Env-Namen korrigiert
  - Offen bleibt:
    - dieselben Identitäten auch in EAS, RevenueCat, App Store Connect, Play Console und Supabase-Dashboard anwenden

- [ ] Datenschutz-/Support-/Kontakt-Flächen live schalten.
  - Benötigt mindestens:
    - Datenschutz-URL
    - Support-URL
    - Kontakt-/Impressumsseite
  - Repo-seitig jetzt vorhanden:
    - [apps/web/app/privacy/page.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/web/app/privacy/page.tsx)
    - [apps/web/app/support/page.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/web/app/support/page.tsx)
    - [apps/web/app/impressum/page.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/web/app/impressum/page.tsx)
    - mobile Einstiege in [apps/mobile/app/(tabs)/profile.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/(tabs)/profile.tsx)
    - echte öffentliche Ostheimer-Kontaktdaten in [apps/web/src/lib/site.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/web/src/lib/site.ts)
  - Offen bleibt:
    - die URLs in App Store Connect und den übrigen Store-/Dashboard-Setups hinterlegen

- [ ] In-App-Konto-Löschung umsetzen.
  - Produktentscheidung:
    - sofortige endgültige Löschung
    - alle Lerninhalte und Fortschritte werden gelöscht
    - Abos werden nicht automatisch gekündigt; Store-Hinweis ist Pflicht
  - Benötigt:
    - UI im Profil
    - API-/Supabase-Löschpfad
    - klare Nutzerkommunikation zu Datenfolgen
  - Repo-seitig jetzt vorhanden:
    - Mobile-UI in [apps/mobile/app/(tabs)/profile.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/(tabs)/profile.tsx)
    - Mobile-API in [apps/mobile/src/lib/api.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/lib/api.ts)
    - Endpoint in [apps/api/app/api/v1/account/route.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/api/app/api/v1/account/route.ts)
    - Service in [apps/api/src/services/accountDeletionService.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/api/src/services/accountDeletionService.ts)
    - Tombstone-/Cleanup-Migration in [apps/api/supabase/migrations/20260404120000_add_deleted_accounts.sql](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/api/supabase/migrations/20260404120000_add_deleted_accounts.sql)
  - Offen bleibt:
    - Migration auf der Ziel-Datenbank ausrollen
    - manueller End-to-End-Test gegen eine echte Supabase-Umgebung

- [ ] RevenueCat / Store-Produkte produktiv fertigstellen und verifizieren.
  - Produkte in App Store Connect wirklich anlegen
  - Produkte in Google Play Console wirklich anlegen
  - RevenueCat Entitlements / Offerings veröffentlichen
  - Webhook-Secret in Vercel setzen
  - echte Kauf-/Restore-Tests iOS + Android durchführen

- [ ] EAS Submit-Konfiguration vervollständigen.
  - In [apps/mobile/eas.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/eas.json) fehlt für iOS noch `ascAppId`.
  - Android benötigt den produktiven Service-Account-Key für den Play-Track.

- [ ] App-Privacy-/Ads-/Tracking-Angaben konsistent machen.
  - ATT-Text, Privacy Manifest, AdMob-Konfiguration und App-Store-Privacy-Angaben müssen zueinander passen.
  - Produktentscheidung:
    - Tracking und personalisierte Werbung standardmäßig aus
    - Aktivierung erst nach explizitem ATT-Opt-in
    - Rewarded Ads ohne ATT-Opt-in nur nicht-personalisiert
  - Repo-seitig jetzt vorhanden:
    - persistierter Consent-State in [apps/mobile/src/features/ads/trackingConsent.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/features/ads/trackingConsent.ts)
    - kontextueller Pre-Prompt und Rewarded-Ad-Gating in [apps/mobile/src/features/ads/useRewardedAd.native.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/features/ads/useRewardedAd.native.ts)
    - sichtbarer Einstellungsweg in [apps/mobile/app/tracking-preferences.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/tracking-preferences.tsx) und [apps/mobile/app/(tabs)/profile.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/(tabs)/profile.tsx)
    - Expo-Plugin für ATT in [apps/mobile/app.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.json)
    - app-eigenes iOS Privacy Manifest in [apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy)
    - SDK-seitige Privacy Manifests im iOS-Build:
      - Google Mobile Ads in [PrivacyInfo.xcprivacy](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/ios/Pods/Google-Mobile-Ads-SDK/Frameworks/GoogleMobileAdsFramework/GoogleMobileAds.xcframework/ios-arm64/GoogleMobileAds.framework/PrivacyInfo.xcprivacy)
      - Google User Messaging Platform in [PrivacyInfo.xcprivacy](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/ios/Pods/GoogleUserMessagingPlatform/Frameworks/Release/UserMessagingPlatform.xcframework/ios-arm64/UserMessagingPlatform.framework/PrivacyInfo.xcprivacy)
  - Besonders prüfen:
    - [apps/mobile/app.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.json)
    - [apps/mobile/app.config.js](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.config.js)
    - [apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/ios/clearnPreview/PrivacyInfo.xcprivacy)
    - [apps/mobile/src/features/ads/useRewardedAd.native.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/features/ads/useRewardedAd.native.ts)
  - Offen bleibt:
    - im App Store Connect Privacy Questionnaire die SDK-Daten korrekt abbilden; insbesondere nicht fälschlich "kein Tracking" angeben, solange personalisierte Ads optional aktiviert werden können
    - das Privacy Report/Privacy Nutrition Label eines echten iOS-Archives gegen die oben eingebundenen SDK-Manifests prüfen
    - Privacy Manifest und App Store Connect Privacy Questionnaire gegen den finalen Tracking-Umfang prüfen
    - reale Geräte-Tests für ATT-Opt-in, ATT-Ablehnung und non-personalized Fallback durchführen

- [ ] TestFlight-/Reviewer-Readiness herstellen.
  - Benötigt:
    - echter Production-Build
    - TestFlight-Smoke-Test
    - Reviewer-Account / Demo-Zugang
    - Review Notes für Login, IAP und Kernflow

## P1 — Sollte vor Launch noch geschlossen werden

- [ ] Website-Landing auf Launch-Niveau bringen.
  - Die tote `/waitlist`-CTA ist repo-seitig bereits entfernt.
  - Vor Launch mindestens:
    - funktionierende CTA
    - Privacy / Support / Kontakt
    - konsistente Produktcopy

- [ ] Profil-/Settings-Fläche vervollständigen.
  - Im Profil fehlen aktuell sichtbare Einstiege für:
    - ggf. Abo verwalten
  - Relevante Datei: [apps/mobile/app/(tabs)/profile.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/(tabs)/profile.tsx)

- [ ] App-Store-Assets finalisieren.
  - Screenshots
  - Untertitel
  - Beta-/Store-Beschreibung
  - App Preview Video
  - Keyword-Set

- [ ] Onboarding, Auth und Paywall auf reale Release-Copy prüfen.
  - Deutsch/Englisch konsistent
  - keine Beta-/Scaffold-Formulierungen
  - Produktversprechen deckungsgleich mit Store-Text

## P1 — Zusätzlich kritisch, weil für v1 beschlossen

- [ ] Apple-/Google-Sign-In implementieren.
  - Für v1 beschlossen: Google Sign-In und Apple Sign-In zusätzlich zu E-Mail/Passwort.
  - OAuth soll auch im Mobile-Web/Preview testbar sein.
  - Wenn Google-Login in v1 kommt, muss Apple-Login gleichwertig mitgeliefert werden.
  - Gleiche verifizierte E-Mail soll bei Apple, Google und E-Mail/Passwort zum selben Konto führen.
  - Repo-seitig jetzt vorhanden:
    - Auth-UI in [apps/mobile/app/auth.tsx](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app/auth.tsx)
    - OAuth-Flow in [apps/mobile/src/lib/oauth.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/lib/oauth.ts)
    - PKCE-Client-Konfiguration in [apps/mobile/src/lib/supabase.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/lib/supabase.ts)
    - Session-Store-Anbindung in [apps/mobile/src/store/sessionStore.ts](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/src/store/sessionStore.ts)
  - Offen bleibt:
    - Apple- und Google-Provider in Supabase produktiv aktivieren
    - Redirect-URLs in Supabase und den Provider-Dashboards hinterlegen
    - reale Happy-Path-/Cancel-/Fehler-Tests auf iOS, Android und Mobile-Web
  - Detaildoku: [docs/runbooks/mobile-oauth-setup.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/mobile-oauth-setup.md)

## P2 — Kurz nach Launch oder nur falls Scope in v1 enthalten

- [ ] In-App-Feedback an die echte Produktoberfläche hängen.
  - API vorhanden, aber kein sichtbarer Nutzerpfad priorisiert.

- [ ] Web-Erlebnis über reines Companion-Scaffold hinausheben.
  - Für den App-Store nicht kritisch, aber für Conversion und Support nützlich.

## Empfohlene Abarbeitungsreihenfolge

1. Identitäten/Config bereinigen
2. Privacy/Support/Kontakt live schalten
3. Konto-Löschung umsetzen
4. RevenueCat/Store-Setup produktiv machen
5. EAS Submit finalisieren
6. TestFlight + Reviewer-Readiness
7. Landing / Store Assets final polish

## Arbeitsregel

Ein Punkt gilt erst dann als erledigt, wenn folgende drei Dinge erfüllt sind:

- Code oder Dashboard-Konfiguration ist wirklich umgesetzt
- manueller Test oder realer Store-/Sandbox-Test wurde durchgeführt
- der Nachweis ist im passenden Detaildokument ergänzt
