# Lernrunden fortsetzen – lokale Abnahme am 8. September 2026

Arbeitsbranch: `codex/shipaton-2026-preparation`, Ausgangscommit `149f9bb`. Beide beauftragten Punkte sind lokal umgesetzt und geprüft: Wiederaufnahme veränderter Fälligkeitsstapel und mobiler Hintergrundsync. Dieser Bericht ergänzt die [historische Abnahme vom 5. September](local-validation.md).

## Verhalten

Mobile und Web speichern für Karteikarten und Lückentext die ursprüngliche Kartenreihenfolge (`cardIds`) im lokalen und im Konto-Lesezeichen. Eine unterbrochene „Nur fällige“-Runde wird daraus rekonstruiert.

- Bereits beantwortete, inzwischen nicht mehr fällige Karten behalten ihre Ergebnisse in Auswertung und Wiederholungsstapel. Neue oder neu fällige Karten kommen nicht in diese gespeicherte Runde; gelöschte Karten entfallen.
- Mobile rekonstruiert die Runde auch nach dem erneuten Kartenabruf beim Start. Änderungen zwischen Auswahl und Start verschieben dadurch nicht den Einstieg.
- Eine vor der Pause bereits abgesendete Lückentext-Antwort wird übernommen und übersprungen, auch bei „Alle“, „Nur markierte“ und „Nur Wackelkandidaten“. Vollständig beantwortete Runden öffnen die Auswertung ohne neue Bewertung oder LP-Anfrage. Ein inzwischen leerer Due-Filter verhindert das Fortsetzen nicht.
- Alte Lesezeichen ohne Kartenreihenfolge bleiben lesbar. Vorhandene Ergebnisse werden übernommen; fehlende frühere Antworten werden nicht erfunden. Fehlt bei einem solchen alten Lesezeichen die Ankerkarte, wird kein Fortsetzen angeboten, weil sich die ursprüngliche Nachfolge nicht mehr bestimmen lässt.

Beim mobilen Wechsel von `active` nach `inactive`/`background` wird der aktuelle Kontostand der Runde gespeichert. Aufeinanderfolgende iOS-Ereignisse lösen nur eine Speicherung pro Verlassen des Vordergrunds aus. Der bisherige Unmount-Fallback bleibt erhalten; es entsteht kein Konto-Request pro Karte.

Die letzte Bewertung ist zunächst zur Korrektur gepuffert. Vor dem Hintergrund-Lesezeichen wird die ursprüngliche Review-Operation mit ihrem bestehenden Idempotenzschlüssel in der lokalen Offline-Warteschlange gesichert. Geordnete native Schreibvorgänge verhindern, dass eine langsame ältere Speicherung diesen bestätigten Stand überschreibt. Die Zustellung wird anschließend versucht; bei Netzfehlern bleibt die Operation für den bestehenden Queue-Sync erhalten.

Nach dem Commit ist diese Antwort nicht mehr über „Zurück“ oder „Zählt trotzdem“ korrigierbar, da dies eine zweite Bewertung erzeugen würde. Die nächste neu gepufferte Antwort bleibt korrigierbar. Alte Ergebnisse fließen in die Auswertung ein; LP zählen ausschließlich neue Bewertungen.

Wird die Runde während der lokalen Speicherung beendet oder verändert, darf der alte Hintergrundmerker anschließend nicht mehr hochgeladen werden. Bereits gestartete Konto-PUTs und nachfolgende DELETEs werden je Deck und Lernart geordnet ausgeführt. Speicherfehler verhindern das Hochladen eines noch nicht dauerhaft abgesicherten Fortschritts.

## Nachweise

Die Fehler wurden zuerst mit roten Regressionstests reproduziert, dann behoben und mit denselben Tests grün geprüft. Ein unabhängiges Review fand zusätzlich den bereits beantworteten Lückentext-Einstieg außerhalb des Due-Modus; zwölf weitere Regressionen belegen dessen Korrektur. Die gemeinsame Resolver-Suite prüft 34 Fälle für Mobile/Web.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale CI | `pnpm run ci` mit isoliertem PostgreSQL: Lint, Typecheck und **2.225 Tests bestanden**, 13 bestehende API-Tests übersprungen; 33 bestehende Lint-Warnungen, keine Fehler |
| Verteilung | Mobile 837; Web 478; API 860; Contracts 20; Testkit 26; Domain 4 |
| Mobile Hintergrund-/Review-/LP-Teilprüfung | 93 gezielte Tests grün, darunter verzögerte Storage-Schreibvorgänge, Fehlerpfade, Lifecycle-Doppelereignisse, Listener-Cleanup, unveränderte Idempotenzschlüssel und Korrekturgrenzen |
| API-/Adapter-/Sync-Teilprüfung | 31 gezielte Tests grün; optionales `cardIds`, Legacy-NULL und mobile PUT-/DELETE-Reihenfolge |
| Lokale Browserabnahme | `pnpm run test:resume-local`: **4/4 grün**, einschließlich tatsächlichem Lernen bis zur Auswertung |
| Web-Produktionsbuild | Erfolgreich auf dem finalen Codestand |
| Expo Web-Export | Erfolgreich |
| Expo-Web-Browser-Smoke | 3/3 grün: Desktop-Anmeldung, mobiler Enter-Submit und vollständige Gast-Lektion mit Neustart |
| Expo iOS-JavaScript-/Hermes-Export | Erfolgreich; kein signierter oder installierbarer App-Build |
| Lokale PostgreSQL-17-Probe | **60 Migrationen** in leerer Wegwerf-Datenbank wiederhergestellt; SQL-Abfrage prüft NULL, UUID-Array-Reihenfolge und Legacy-NULL-Roundtrip |

Die Browserfälle verwenden die echte lokale Web-Oberfläche mit synthetischer Anmeldung und abgefangenen API-Antworten. Unerwartete externe Anfragen werden blockiert. Sie belegen:

1. Karteikarten und Lückentext setzen einen ursprünglichen Siebenerstapel bei Karte 3 fort: zwei alte Ergebnisse bleiben erhalten, fünf neue Antworten erzeugen genau fünf Reviews und eine LP-Anfrage mit `sessionCardCount: 5`. Ein alter Fehler bleibt zum Wiederholen angeboten; eine zusätzlich fällige Karte wird ausgeschlossen.
2. Eine vollständig beantwortete Lückentext-Runde mit null fälligen Karten öffnet die Auswertung ohne neue Review-/LP-Anfrage.
3. Im All-Modus wird die vor der Pause beantwortete Karte 3 übersprungen. Nur Karten 4–7 werden bewertet und abgerechnet; die Auswertung umfasst alle sieben Ergebnisse.

Die Ergebnisansichten beider Lernmodi wurden zusätzlich anhand lokaler Screenshots visuell geprüft. Tests: `e2e/local.resume.spec.ts`, `apps/web/src/lib/session-resume-consistency.test.ts` sowie die Mobile-Lifecycle-/Commit-/Queue-Suites.

Umgebung: macOS, Node 26.7.0, pnpm 10.29.2, PostgreSQL 17.11. Die SQL-Testdaten waren synthetisch; die Roundtrip-Transaktion wurde zurückgerollt. GitHub CI wurde für diesen lokalen Stand nicht ausgelöst.

## Auslieferung und verbleibende Abnahme

1. **Migration vor API-Deployment:** `apps/api/supabase/migrations/20260927222222_session_progress_card_ids.sql` ergänzt die nullable Spalte `session_progress.card_ids` als `uuid[]`. Alte Zeilen und Clients bleiben kompatibel. Die Migration ist seit dem 27. September 2026 in der Produktionsdatenbank angewendet und per Schemaabfrage bestätigt.
2. **Native Abnahme:** Mit eindeutig identifiziertem Kandidaten auf einem physischen iPhone Unterbrechen, Hintergrundwechsel, Wiederöffnen, schlechte Verbindung und Geräte-/Kontosync prüfen. Auch Web mit echter API sowie serverseitige Reviews/LP sind gesondert abzunehmen. Synthetische Browserantworten, Lifecycle-Tests und lokale SQL-Tests ersetzen diesen Nachweis nicht; ein abruptes Beenden durch das Betriebssystem garantiert kein Ausführen von asynchronem Code.
3. **Gebündelte Auslieferung:** Für native Änderungen ist ein neuer signierter App-Build erforderlich; kein OTA. Fertige Änderungen werden für einen gemeinsamen Build gesammelt. Keine kostenpflichtigen Cloud-Builds, echten Käufe, Produktionsänderungen oder Veröffentlichungen wurden ausgelöst.

Store-/RevenueCat-/EAS-Bestand, echte Kauf-/Restore-Abnahme und finale Store-Assets bleiben separate offene Aufgaben aus [release-readiness.md](release-readiness.md).
