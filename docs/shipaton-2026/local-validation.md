# Lokale Umsetzung und Abnahme – 5. September 2026

Arbeitsbranch: `codex/shipaton-2026-preparation`. Keine Veröffentlichung, kein EAS-Build, keine echten Käufe oder externen Konfigurationsänderungen.

## Umgesetzt

- iOS-/Android-Konfiguration und Readiness-Gates prüfen die gewählte Plattform. Ohne Auswahl bleiben beide erforderlich; fehlende/ungültige Werte und widersprüchliche Ziele werden weiterhin abgewiesen.
- Fehlgeschlagener RevenueCat-Kontowechsel stoppt Kauf, Restore und Abfragen. Ein späterer Versuch wiederholt den Login.
- LP-Käufe verwenden keinen stillgelegten Client-Gutschrift-Endpunkt oder synthetische Transaktions-ID mehr. Die App weist auf die ausstehende Webhook-Gutschrift hin und aktualisiert den Kontostand.
- Bei deaktivierten Ads sind keine simulierten Werbeaktionen sichtbar. Hooks simulieren keine Werbung; ATT-Einstellungen bleiben erhalten, Store-/Review-Texte passen zum deaktivierten Umfang.
- iOS-Scanquellen öffnen bei zu wenig LP den vorhandenen Hilfedialog mit ihrem konkreten Preis. Kamera/Picker/Import starten nicht; laufende Verarbeitung sperrt weiterhin die Aktion.
- Unterbrochene Flashcard-Runden übertragen ihre bisherigen Ergebnisse auch beim Kontosync. Web stellt frühere richtige/falsche Antworten wieder her. LP zählen weiterhin nur neue Bewertungen.
- Wiederholbare SQL-Tests räumen ihre abhängigen Testtabellen korrekt auf.
- Browser-Smoke fängt den Test-Login lokal ab. Die Gast-Lektion wird vollständig bis Abschluss und Neustart geprüft, ohne schreibende Netzwerkanfragen.

## Nachweise

Alle Fehlerkorrekturen wurden zuerst durch fehlschlagende Regressionen belegt. Die fokussierten Tests liefen nach dem jeweiligen Fix grün. Einige UI-Verkabelungen werden durch Source-Boundary-Tests statt eines nativen Renderers geprüft; das ersetzt keinen Gerätetest.

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm run ci` mit isoliertem lokalem PostgreSQL | Erfolgreich: Lint, Typecheck und Workspace-Tests |
| Contracts | 20 Tests bestanden |
| Testkit | 26 Tests bestanden |
| Domain | 4 Tests bestanden |
| Mobile | 811 Tests bestanden |
| API | 850 Tests bestanden; 13 bestehende Tests übersprungen |
| Web | 441 Tests bestanden; nach zwei ergänzten Testfällen separat vollständig wiederholt |
| Gesamter aktueller Testbestand | **2.152 bestanden**, 13 übersprungen |
| Playwright App-Web-Smoke | **3 bestanden**: Desktop-Auth, mobiler Enter-Submit, Gast-Lektion mit Neustart |
| Web-Produktionsbuild | Erfolgreich, einschließlich Seitengenerierung |
| Expo Web-Export | Erfolgreich; Gast-Einstieg und Kartenansicht zusätzlich visuell bei 390 × 844 geprüft |
| Expo iOS-JavaScript-/Hermes-Bundle-Export | Erfolgreich; **kein signierter oder installierter iOS-App-Build** |
| Datenbank-Restore-Probe | **59 Migrationen** in leerer lokaler Wegwerf-Datenbank; Tabellen, Funktionen und RLS-Prüfungen grün |
| LP-SQL-Suite wiederholt auf derselben Testdatenbank | Zweimal **35/35** bestanden, einschließlich konkurrierender Abbuchungen und idempotenter Gutschrift |
| Store-Metadaten-Textprüfung | Erfolgreich; belegt weder echte Screenshots noch Store-Uploads |
| `release:check --platform ios` | Erwartet gesperrt: lokal fehlende Production-Werte sowie Dashboard-/TestFlight-Nachweise |

Umgebung: macOS, Node 26.7.0, pnpm 10.29.2, PostgreSQL 17.11. GitHub CI verwendet Node 22/PostgreSQL 16 und wurde für diesen lokalen Branch nicht ausgelöst. 33 nicht blockierende Lint-Warnungen bleiben bestehen. Kein externer Datenbankserver wurde für die SQL-Tests verwendet.

## Fortschreibung am 8. September 2026

Die Wiederaufnahme veränderter Fälligkeitsstapel ist inzwischen für Mobile/Web und Karteikarten/Lückentext lokal umgesetzt und gezielt geprüft. Auch Hintergrundsync einschließlich dauerhafter Sicherung der letzten Bewertung ist lokal umgesetzt. Die finale gemeinsame CI (2.225 bestandene Tests), vier Resume-Browserflows und Web-/iOS-Bundle-Exporte sind grün. Aktueller Nachweis und Auslieferungsreihenfolge: [resume-validation.md](resume-validation.md). Die Nachweise und Testzahlen oben bleiben unverändert der Stand vom 5. September.

## Offene Arbeit bleibt sichtbar

1. **#697, fortgeschrieben am 8. September:** stabiler Resume bei verändertem „Nur fällige“-Stapel und mobiler Hintergrundsync einschließlich dauerhafter Sicherung der letzten Bewertung lokal umgesetzt und gemeinsam geprüft. Produktionsmigration und native Geräteabnahme bleiben offen; siehe [aktuellen Bericht](resume-validation.md).
2. **#701 teilweise offen:** Web-Vorabprüfung vor Quellenwahl und direkter Neues-Deck-Ausweg im Ziel-Deck-Fenster. iOS-Quellenhilfe ist behoben. Der alte Accessibility-Vorwurf ist allein aus dem fehlenden expliziten Attribut nicht belegbar: React Native propagiert `disabled` bereits.
3. **#702 nur teilweise gegengeprüft:** Größenlimits für Lernfortschritt und Streak-Nachholung existierten bereits; weitere Teilpunkte sind nicht vollständig abgearbeitet.
4. Aktuelle Store-/RevenueCat-/EAS-Konfiguration, echte Sandbox-Käufe, Restore, Webhook-Latenz und Nutzerzuordnung auf Gerät prüfen.
5. Finale Screenshots/Demo vom Release-Kandidaten erstellen. Die lokalen Browserbilder sind keine finalen nativen Store-Assets.
6. OAuth, Konto-Löschung, Datenschutz/Support und Deployments für den Kandidaten abnehmen; anschließend signierten Build und Veröffentlichung gesondert durchführen.

Fehlende lokale Konfigurationswerte belegen nicht, dass dieselben Werte in EAS fehlen. Evidence-Dateien werden erst nach tatsächlicher Prüfung ausgefüllt.
