# Release-Bestandsaufnahme – 9. September 2026, fortgeschrieben am 15. September

Read-only-Abgleich der zugänglichen Dashboards mit Code `c81403a` auf `codex/shipaton-2026-preparation`. Keine externen Einstellungen geändert, Schlüssel exportiert, Builds gestartet oder Einreichungen vorgenommen. Die Repository-Anforderungen wurden separat durch einen Agent geprüft und vom PM mit den Dashboard-Beobachtungen zusammengeführt.

## Verifizierter EAS-Bestand

| Bereich | Beobachtung | Bedeutung |
| --- | --- | --- |
| Projekt | `@aostheimer/clearn`, ID `5495e637-0223-4924-a778-8683dafaf264`; stimmt mit App-Konfiguration überein | Richtiges Projekt zugeordnet. |
| Builds | Übersicht zeigt keine Production-Builds und keine EAS-Submissions. Neuester Build: `543876a0-1e10-4ff0-9127-c5492b89aa28`, iOS Preview/internal, Finished, 31. Juli 2026, Version 1.0(1), Commit `0d0db0f` | Neue lokale Änderungen sind darin nicht enthalten. Keine Aussage über anderweitig zu Apple hochgeladene Builds. |
| Laufende Builds | In den 15 jüngsten sichtbaren Einträgen kein NEW/IN_PROGRESS | Vor einem späteren Build erneut prüfen. |
| RevenueCat-Variablen | Projektfilter Environment All / Scope All: Suche REVENUECAT ohne Ergebnisse. Accountweite Variablenseite zeigt leeren Einrichtungszustand | Kein RC-iOS-SDK-Key in diesen EAS-Variablen nachgewiesen; Einrichten vor Production-Build erforderlich. |
| AdMob | Vier Production-Variablen für App-/Rewarded-IDs vorhanden, jedoch Google-Test-IDs | Werbung bleibt im vereinbarten Umfang deaktiviert. Das lokale Gate verlangt in diesem Zustand keine produktiven AdMob-Werte mehr; bei einer späteren Aktivierung werden sie wieder strikt geprüft. |
| Weitere Variablen | API- und Supabase-URL sowie geheime Google-Services-Datei für Development/Preview/Production vorhanden | Vorhandensein ist kein Funktionsnachweis; geheime Werte nicht geöffnet. |
| Credentials | Android und iOS jeweils `app.clearn` auf der Projektseite vorhanden | Zertifikatsgültigkeit und Store-Signierung noch nicht abgenommen. |

Quellen: [Projekt](https://expo.dev/accounts/aostheimer/projects/clearn), [letzter Build](https://expo.dev/accounts/aostheimer/projects/clearn/builds/543876a0-1e10-4ff0-9127-c5492b89aa28), [Projektvariablen](https://expo.dev/accounts/aostheimer/projects/clearn/environment-variables), [Accountvariablen](https://expo.dev/accounts/aostheimer/settings/environment-variables), [Credentials](https://expo.dev/accounts/aostheimer/projects/clearn/credentials).

## Nach Anmeldung verifiziert – 9. September, Nachmittag

Andreas hat beide Anmeldungen abgeschlossen. Die RevenueCat-Onboarding-Umfrage konnte über den vorhandenen Home-Link verlassen werden, ohne Antworten zu übermitteln. Das angemeldete Konto zeigt im Projektmenü ausdrücklich **keine Projekte**. Somit ist in diesem Konto noch keine CloudLearn-Projektkonfiguration vorhanden. Ein mögliches Projekt in einem anderen Konto ist damit nicht ausgeschlossen.

| Apple-Bereich | Sichtbarer Bestand | Nächste Aufgabe |
| --- | --- | --- |
| App-Version | `clearn`, App-ID `6766691399`, iOS 1.0 „In Vorbereitung zur Übermittlung“ | Release-Paket vervollständigen. |
| Deutsche Versionsmetadaten | Beschreibung, Keywords, Support-URL, Copyright und Review-Informationen leer; iPhone 6,5 Zoll: 0 Screenshots | Geprüfte lokale Texte übertragen, aktuelle Bilder und Reviewer-Zugang vorbereiten. Andere Lokalisierungen/Bildgrößen nicht vollständig geprüft. |
| In-App-Käufe | Leerer Einrichtungszustand mit „Erstellen“, keine Produkte gelistet | Lifetime und gegebenenfalls LP-Pakete einrichten. |
| Abos | Noch keine Abogruppe; Aufforderung, zuerst eine Gruppe zu erstellen | Pro-Gruppe mit Monats-/Jahresprodukt einrichten. |
| TestFlight | „Keine Builds“, Aufforderung zum ersten Upload | Später einen gebündelten, autorisierten Kandidaten hochladen. |
| Preis und Verfügbarkeit | „Preise hinzufügen“ und „Verfügbarkeit konfigurieren“ | Kostenlosen App-Einstiegspreis und Zielländer einschließlich USA festlegen; noch keine US-Verfügbarkeit belegt. |
| Datenschutz | Datenschutz-URL fehlt; Datenerfassungsfragebogen zeigt „Erste Schritte“ | Tatsächliche Datenflüsse abgleichen, URL und korrekte Angaben vorbereiten. |
| Geschäftliches | Kostenloser Vertrag „Aktiv“. Andreas hat die Händlerangabe und die persönlichen Steuer-/Bankangaben eingereicht. Das US-Steuerformular wird als „Aktiv“ angezeigt; der Vertrag für gebührenpflichtige Apps und die Bankdaten stehen am 15. September auf „In Bearbeitung“. Apple nennt für die Bankdaten eine Bearbeitungszeit von bis zu 24 Stunden. Der Rechtsträger bleibt vorerst Andreas Ostheimer persönlich. | Nach der Verarbeitung read-only prüfen, ob Vertrag und Bankkonto aktiv sind. Eine spätere Umstellung auf die Ostheimer OG ist ein eigener Rechtsträgerwechsel und nicht Teil dieser Einreichung. |
| Veröffentlichung | In der Version ist automatische Veröffentlichung nach Genehmigung ausgewählt | Vor späterer Einreichung mit geplantem Release-Zeitpunkt abgleichen; Einstellung nicht geändert. |

Quellen: [RevenueCat-Übersicht](https://app.revenuecat.com/overview), [Apple-Version](https://appstoreconnect.apple.com/apps/6766691399/distribution/ios/version/inflight), [In-App-Käufe](https://appstoreconnect.apple.com/apps/6766691399/distribution/iaps), [Abos](https://appstoreconnect.apple.com/apps/6766691399/distribution/subscriptions), [TestFlight](https://appstoreconnect.apple.com/teams/69a6de83-94a5-47e3-e053-5b8c7c11a4d1/apps/6766691399/testflight), [Preise](https://appstoreconnect.apple.com/apps/6766691399/distribution/pricing), [Datenschutz](https://appstoreconnect.apple.com/apps/6766691399/distribution/privacy), [Geschäftliches](https://appstoreconnect.apple.com/business).

## Einrichtungssoll und Reihenfolge

Zuerst die lokal prüfbaren Webhook-/Ads-Gate-Lücken schließen und die laufende Apple-Verarbeitung abwarten. Danach Store-Produkte und RevenueCat-Projekt einrichten, SDK-Key und Webhook sicher zuordnen, Metadaten/Datenschutz vervollständigen und erst anschließend den gebündelten Kandidaten bauen und nativ abnehmen. Abgesehen von den durch Andreas eingereichten Apple-Angaben nimmt diese Bestandsaufnahme keine externen Konfigurationsänderungen vor.

- Apple-App `6766691399`; Bundle/SKU `app.clearn` und Team `PES54TD37F` laut Repository bei Einrichtung erneut abgleichen.
- Produkte `ai.clearn.pro.monthly`, `ai.clearn.pro.annual`, `ai.clearn.lifetime`; Entitlements `pro` und `lifetime`. Offering `default` muss als aktuelles Offering geliefert werden; die App liest `offerings.current.availablePackages`.
- Falls LP-Pakete angeboten werden: `lp_pack_100`, `lp_pack_300`, `lp_pack_750`, `lp_pack_2000` im aktuellen Offering. Ein ausschließlich separates, nicht aktuelles Offering wird vom bestehenden Client nicht gelesen.
- Webhook-Ziel `https://clearn-api.vercel.app/api/v1/subscription/webhook`, Authentifizierungsverfahren, Sandbox-/Production-Auswahl und relevante Events einrichten und anschließend gezielt prüfen. Im aktuell leeren RevenueCat-Konto gibt es keine Projekt-Zustellhistorie zu prüfen.

## Konkrete Code- und Nachweislücken

1. **Webhook-Protokoll abgeglichen (lokal behoben):** Der Handler prüft jetzt den im RevenueCat-Dashboard konfigurierbaren Wert als `Authorization: Bearer <Secret>` und vergleicht ihn konstantzeitlich. Fehlender und falscher Header bleiben gesperrt. Die optionale HMAC im Header `X-RevenueCat-Webhook-Signature` ist ein separates Verfahren und nicht implementiert. Das Dashboard und die Vercel-Variable sind noch nicht eingerichtet. [Offizielle Webhook-Dokumentation](https://www.revenuecat.com/docs/integrations/webhooks).
2. **Ads-Gate an deaktivierten Umfang angepasst (lokal behoben):** Eine gemeinsame Konfiguration hält App und Release-Prüfungen synchron. Bei deaktivierten echten Ads werden keine produktiven AdMob-IDs verlangt; bei späterer Aktivierung greift wieder die strikte Format- und Test-ID-Sperre. Werbung wurde nicht aktiviert.
3. **EAS-Key und Dashboard-Evidenz vervollständigen:** Nach RC-Zuordnung den richtigen öffentlichen iOS-SDK-Key für den späteren Production-Build sicher konfigurieren. Entitlement-Namen `pro`/`lifetime` stehen bereits in `eas.json`; deren Fehlen auf der Variablenseite ist kein zusätzlicher Blocker.
4. **Native Abnahme vorbereiten:** Einen gebündelten, autorisierten Build für Kauf, Restore, serverseitige Freischaltung und Lernfluss verwenden. Vorher lokales Ergebnis, Backend-/Migrationsstand und Store-Konfiguration zusammenführen.

## Lokale Verifikation dieses Abgleichs

`pnpm --filter @clearn/mobile release:check --platform ios` endet am 15. September weiterhin mit Exit 1, jetzt ausschließlich wegen des fehlenden RC-iOS-Keys sowie `dashboard-readiness.local.json` und `testflight-readiness.local.json`. Fehlende AdMob-Werte blockieren den deaktivierten Ads-Umfang nicht mehr. Submit-Identitäten und Store-Metadatentexte bestehen die Prüfung. Der lokale Prozess lädt keine EAS-Dashboard-Werte; lokale Fehlermeldungen und obige Live-Beobachtungen sind getrennte Nachweise.

Die Beispiel-JSON-Dateien sind keine Abnahme-Evidenz und wurden nicht als bestandene Prüfung übernommen. Textprüfung belegt keine Screenshots oder Store-Uploads. Frühere grüne Codechecks stehen in [resume-validation.md](resume-validation.md); für diese Bestandsaufnahme wurde keine unveränderte Vollsuite wiederholt.
