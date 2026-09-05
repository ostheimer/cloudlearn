# Shipaton 2026: Release-Lücken und Abnahme

Stand: 5. September 2026. Ziel: Store-Einreichung bis 23. September 2026; öffentliche Erstveröffentlichung muss anschließend rechtzeitig für die Wettbewerbsfrist erfolgen. Eine Einreichung oder TestFlight-Verfügbarkeit ist noch keine öffentliche Veröffentlichung.

Andreas hat bestätigt: Die App war noch nie öffentlich im Store; er ist alleiniger Entwickler. Die Bewertung bezieht sich auf die reguläre Teilnahme. Wettbewerbsbedingungen und Einreichungsmaterialien werden separat dokumentiert.

## Aussagekraft dieser Prüfung

- Historischer Ausgangspunkt: Checkout `0d0db0f` vom 31. Juli 2026, am 5. September geprüft. Anschließend wurden lokale Änderungen auf `codex/shipaton-2026-preparation` umgesetzt und gezielt getestet; siehe aktuellen Stand unten.
- GitHub Issues wurden am 5. September gelesen. Ihre Juli-Berichte sind historische Hinweise, keine neue Reproduktion.
- Externe EAS-, RevenueCat-, App-Store-Connect-, AdMob- und Supabase-Konfiguration wurde hier nicht verifiziert.
- Die Erstprüfung war read-only. Danach hat Andreas lokale Entwicklung und Tests ausdrücklich autorisiert. Lokaler Web-Build und iOS-Bundle-Export sind erfolgreich; es wurde kein signierter App-/EAS-Build erzeugt. Keine Käufe, externen Änderungen oder Security-Scans. Die vollständige lokale CI ist grün; Details und Grenzen stehen in [local-validation.md](local-validation.md).

## Priorisierte Lücken

| Priorität | Befund und Status | Nächster Schritt / Abnahme |
|---|---|---|
| P0 | **Aktueller Code:** RevenueCat SDK und Kaufpfad existieren (`apps/mobile/package.json:57`, `apps/mobile/src/features/paywall/revenuecat.ts:164–230`, `apps/mobile/app/paywall.tsx:163–195`). **Fehlende Evidenz:** Kein aktueller erfolgreicher Store-Kauf einschließlich serverseitiger Freischaltung belegt. **Lokal behoben:** Nach fehlgeschlagenem RevenueCat-Kontowechsel bleibt der Kauf-/Restore-Zugriff gesperrt, statt mit der bisherigen Identität fortzufahren. | App Store Connect IAPs, RC-Offering, Entitlements und Webhook-Zustellung read-only abgleichen; danach nativen Sandbox-Kauf, Cancel, Restore und Backend-Abgleich auf dem Release-Kandidaten nachweisen. |
| P0 extern offen; lokal behoben | **Implementiert:** Expo-Konfiguration und Submit-/Dashboard-Gates wählen iOS, Android oder standardmäßig beide. Fehlende/ungültige Zielplattform-Werte und widersprüchliche Auswahl bleiben gesperrt. **41 gezielte Tests grün**, darunter 34 neue Plattformtests. **Alte Doku:** AGENTS.md nennt fehlende EAS-RC-Keys; heutiger externer Zustand unbestätigt. | `pnpm --filter @clearn/mobile release:check --platform ios`; bei Expo `RELEASE_PLATFORM=ios` oder natives `EAS_BUILD_PLATFORM=ios`. Aktuelle EAS-Konfiguration ohne Ausgabe von Werten prüfen. Lokale Guards ersetzen weder echte Keys noch Store-Abnahme. |
| P0 | **Lokale Prüfung rot:** `dashboard:check` und `testflight:check` scheitern an fehlenden lokalen Evidence-Dateien. Das beweist fehlenden Nachweis in diesem Checkout, nicht fehlende externe Einrichtung. | Aktuelle Dashboard-Evidenz erfassen; physisches iPhone mit exakt identifiziertem Store-/TestFlight-Build prüfen. JSON erst nach realen Prüfungen befüllen. |
| Lokal behoben; Geräteabnahme offen | **Implementiert:** Echte Ads bleiben deaktiviert. Sichtbare Mock-Werbeaktionen wurden entfernt beziehungsweise gesperrt; die simulierte Belohnung wird nicht mehr angeboten. Store-/Review-Texte wurden dem tatsächlichen Umfang angepasst. [Issue #165](https://github.com/ostheimer/cloudlearn/issues/165) beschreibt nur historische Aktivierungsschritte. | Am Kandidaten prüfen, dass keine Schein-Werbung oder falschen LP-Versprechen sichtbar sind. Keine Ads-Aktivierung für dieses Paket. Eine spätere Aktivierung benötigt separat verifizierte DB-/AdMob-/SSV-Kette. |
| P0 | **Aktueller Dateibestand:** `docs/screens/app-store/` enthält nur README, keine finalen Screenshots. **Lokale Metadatenprüfung grün:** Sie prüft Textkonsistenz und den beschriebenen Screenshot-Workflow, nicht vorhandene Bilddateien oder Uploads. | Fünf aktuelle echte Screens aufnehmen, exportieren und visuell prüfen; im Store akzeptierte Maße vor Export aktuell verifizieren. Review-Zugang außerhalb von Git bereitstellen, Review Notes finalisieren, Metadata/Privacy/IAP-Status in App Store Connect abgleichen. |
| P0 | **Fehlende aktuelle Evidenz:** E-Mail-Links, Apple/Google OAuth, Account-Löschung, Datenschutz-/Supportseiten und produktive Deployments sind nicht für diesen Release-Kandidaten neu abgenommen. | Vorhandene Runbooks gezielt abarbeiten; für extern schreibende Tests geeignete autorisierte Testkonten nutzen. Keine echten privaten Lerninhalte verwenden. |
| P1 | **Historische offene Fehlerberichte:** [#697](https://github.com/ostheimer/cloudlearn/issues/697) Lernfortschritt, [#701](https://github.com/ostheimer/cloudlearn/issues/701) Scan-Kostensperren, [#702](https://github.com/ostheimer/cloudlearn/issues/702) Mengen-/Zähler-/LP-Probleme. Ergebnisseverlust bei Kontosync (#697) und iOS-Quellen-Kostenhilfe (#701) inzwischen reproduziert und lokal behoben. Beide Issues bleiben teilweise offen; Details im Prüfbericht. | Offene Teilpunkte nach Release-Auswirkung triagieren. Verlust von Lernfortschritt, falsche Echtgeld-/LP-Zustände und blockierter Kernflow priorisieren. Vor jedem Fix reproduzierenden Test rot, anschließend denselben Test grün. Keine pauschale Abarbeitung aller offenen Features. |
| P1 | **Historische Geräteprüfliste:** [#735](https://github.com/ostheimer/cloudlearn/issues/735) enthält noch unbestätigte gerätespezifische Lern-/Scan-Verhaltensweisen. | Relevante Punkte in den einmaligen TestFlight-Durchlauf übernehmen: Scan-Sortierung, Lückentext-Vorlesen, Hintergrund/Resume, Navigation. Altes Preview-Build nicht als Abnahme des neuen Kandidaten verwenden. |

## Konkrete Arbeitspakete bis zum 23. September

1. **5.–8. September: Plattform und externe Voraussetzungen klären.** Vorschlag iOS-first wegen bestehendem iPhone-/Preview-Pfad. Read-only Bestandsaufnahme von App Store Connect, EAS und RC; Status mit Datum/IDs, ohne Secrets, erfassen. Ads-Scope und erforderliche Konfigurationsänderungen konkret machen. Ergebnis: belastbare Blockerliste, kein ungeprüftes Abschreiben alter Runbooks.
2. **8.–13. September: Release-relevante Code- und Dokumentationslücken schließen.** Plattformgerechte Gates, gesperrter RC-Zugriff nach fehlgeschlagenem Kontowechsel und Ads-/Review-Konsistenz sind lokal umgesetzt. Weitere reproduzierte P0/P1-Fehler bearbeiten. Bestehende Implementierung und Produktumfang bewahren, sofern kein Release-Grund für eine Änderung besteht.
3. **Bis 15. September: Kauf-/Store-Konfiguration und Reviewer-Paket fertigstellen.** RC-Produkte/Entitlements/Webhook, Store-IAPs, Zugriff und rechtliche Seiten abgleichen. Externe noch notwendige Änderungen als konkrete Schritte ausweisen. Reviewer-Passwort bleibt im Passwortmanager; niemals in die Review-Notes-Datei im Repository einsetzen.
4. **16.–19. September: Einen gebündelten Kandidaten prüfen.** Nur nach angekündigten/autorisierten Build-Kosten, zuvor laufende Builds prüfen. Store-kompatiblen Kandidaten bauen und über TestFlight am physischen iPhone abnehmen. Keine zusätzlichen Preview-Builds pro Einzelfix einplanen.
5. **20.–22. September: Nur Abnahmefehler beheben, Bilder und Store-Paket finalisieren.** Nach Mobile-Änderungen neuen geprüften Build benötigen; kein OTA. Demo und Screens müssen exakt dem einzureichenden Stand entsprechen.
6. **23. September: Store-Einreichung als Meilenstein.** Readiness-Nachweise, Build-ID und Store-Status festhalten. Anschließend Review-Rückfragen/erforderliche Korrekturen priorisieren; öffentliche Verfügbarkeit und Erstveröffentlichungsdatum gesondert verifizieren. Dieser Termin bietet Puffer, garantiert aber keine rechtzeitige Store-Freigabe.

## Angemessener Testumfang

- **Code-Änderungen:** reproduzierender Regressionstest für jeden Bug; Mobile-/API-Tests für betroffenen Kauf-, Entitlement-, LP- oder Konfigurationspfad. Für Plattform-Gates gezielt iOS ohne Android-Werte, Android ohne iOS-Werte, fehlende Werte der Zielplattform und unveränderte Production-Schutzwirkung prüfen.
- **Vor Release:** `pnpm run ci`, Mobile-Test-Suite und `pnpm test:cloudlearn-smoke` gemäß `docs/runbooks/release-gates.md`; drei konfigurierte Vercel-Deployments prüfen. Browser-Smoke mit sichtbarer Desktop-/Mobile-Auth und fehlerfreier Navigation. `ci` enthält den separaten Cloudlearn-Smoke nicht automatisch.
- **Native Abnahme:** vorhandene `docs/runbooks/testflight-smoke-checklist.md` auf physischem iPhone. Ergänzung zwingend: tatsächlicher Sandbox-Kauf mit RC-Transaktion und serverseitigem Pro-Tier, Restore nach Neuinstallation/erneutem Login, Kaufabbruch ohne Freischaltung, LP-Paket-Gutschrift falls angeboten, Wiederholung ohne doppelte LP. Die bisherige Paywall-Checkliste nennt vor allem Anzeige/Cancel/Restore-Button und ist allein kein erfolgreicher Kaufnachweis.
- **Kernprodukt:** frische Installation, Auth/Recovery/OAuth, Foto/Text → Deck → Lernen (PDF nur, falls im Release unterstützt), LP-Kostensperre, Hintergrund/Resume und schlechte Verbindung. Demo auf bereits vorbereiteten harmlosen Inhalten ermöglichen.
- **App-Review:** Konto-Löschung mit geeignetem Testkonto, ATT-Zustimmung/Ablehnung entsprechend tatsächlichem Ads-Scope, Support/Datenschutz, Store-Verwaltung und Reviewer-Zugang.
- **Abnahme-Evidenz:** Datum, Commit, Build-ID, Gerät/iOS, erwartetes/beobachtetes Ergebnis; keine Passwörter oder privaten Lerninhalte. Nach erfolgreicher Prüfung nicht unverändert mehrfach Volltests ausführen.

## Aktueller lokaler Umsetzungsstand am 5. September

- Release-Plattformregression zuerst gegen den Ausgangscode rot (7 Fehler), danach 34 neue Tests und 7 bestehende App-Konfigurationstests grün: **41/41**. Zielgerichtetes ESLint und Mobile-Typecheck grün.
- RevenueCat-Kontowechsel bleibt bei Fehlern gesperrt; Mock-Werbeaktionen sind bereinigt. Diese Änderungen wurden von den zuständigen Agents umgesetzt und gezielt geprüft.
- PM-verifiziert: lokaler Web-Build erfolgreich, drei Browser-Smokes grün und nativer iOS-Bundle-Export erfolgreich. Ein Bundle-Export ist kein signierter, installierbarer oder am Gerät geprüfter App-Build.
- Vollständige lokale CI: **grün**, aktueller Testbestand 2.152 bestanden und 13 übersprungen; siehe [Prüfbericht](local-validation.md). Dashboard-/TestFlight-Nachweise, echter Store-Kauf/Restore und öffentliche Veröffentlichung sind weiterhin nicht belegt.

## Historische Erstprüfung am 5. September, vor Umsetzung

| Prüfung | Ergebnis | Bedeutung |
|---|---|---|
| `node scripts/check-dashboard-readiness.mjs` in `apps/mobile` | Exit 1 | `dashboard-readiness.local.json` fehlt. |
| `node scripts/check-testflight-readiness.mjs` in `apps/mobile` | Exit 1 | `testflight-readiness.local.json` fehlt. |
| `node scripts/check-store-metadata.mjs` in `apps/mobile` | Erfolgsmeldung | Textpaket konsistent; keine Aussage über echte Screenshots, Dashboard-Übertragung oder App-Review-Freigabe. |

Weitere Referenzen: `docs/runbooks/dashboard-release-handoff.md`, `docs/runbooks/reviewer-demo-account.md`, `docs/runbooks/app-store-review-notes.md`, `docs/screens/app-store/README.md`. Alte Angaben wie „Windows ohne Simulator“ beschreiben nicht zwingend die aktuelle Maschine.
