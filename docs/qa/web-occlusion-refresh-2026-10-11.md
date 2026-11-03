# Occlusion-Abnahme nach Main-Updates und Speicher-Race-Fix

Stand: 11.10.2026. Basis `c24d3aa49b7eb6237248d243d8e502e3cf2046f9`, einschließlich #764 (ECR-Postgres), #761 (Kartenbilder) und #765 (Modal/Fokus). #761 wurde vom PM als `464f8c35380edb627958106418aabc4fc933056a` gemergt. #762 wurde auf main umgestellt; sein Diff enthält die Quiz-/Match-Implementierung nicht doppelt. Der gemeinsame Modal-/Keyboard-Patch wurde nicht verändert.

## Reproduzierter Speicher-Race und Korrektur

Zwei echte Browser-Regressionen waren vor der Korrektur rot:

- Ein synthetischer PUT wird nach Eingang des Requests angehalten. Während der Request noch läuft, konnte der Overlay-Löschknopf eine Region aus dem lokalen Entwurf entfernen; der bereits versandte Snapshot behielt sie. Nach erfolgreicher Antwort hätte die automatische Navigation diese nachträgliche Änderung verloren.
- Ein angehaltener synthetischer Storage-Upload ließ weiterhin „Anderes Bild“ und damit die Verwerfen-Nachfrage zu.

Während Speichern sind jetzt die Overlay-/Listen-Löschknöpfe, „Bereiche löschen“, Bildauswahl einschließlich Dateifeld, Labels, Neuzeichnen, Bestätigungsaktionen und Link-Navigation gesperrt. Handler prüfen den Speicherzustand ebenfalls. Eine laufende Zeichnung wird beim Start des Speicherns beendet. Die Navigation des erfolgreichen Speicherwegs bleibt möglich. Bei Fehlern wird die Sperre aufgehoben; Entwurf und Bild bleiben erhalten.

Mit dem neuen gemeinsamen Modal wurden außerdem vier rote Fokusfälle reproduziert: „Abbrechen“ hatte nicht zuverlässig den Startfokus. Der Occlusion-Editor setzt nun über die bestehende `initialFocusRef`-Schnittstelle ausdrücklich den Abbrechen-Knopf als Startfokus. Der gemeinsame Modal-Code bleibt unverändert.

## Aktuelle lokale Regressionen

`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec playwright test -c playwright.card-media.config.ts`: **32 bestanden**, je acht Fälle für Desktop DE/EN und Mobile DE/EN. Darunter:

- zwölf bestehende Quiz-/Bildfrage-/Match-Fälle;
- acht bestehende Regionsbearbeitungs-/Persistenz-/Konfliktfälle;
- zwölf Fälle mit tatsächlich verzögertem PUT oder Upload: direktes Speichern, bestätigtes Entfernen und Upload-Fehler;
- Startfokus auf Abbrechen, Tab-/Shift-Tab-Falle, Escape ohne Schreibzugriff, erneute Bestätigung;
- gesperrte Region-/Bildänderung sowie Editor- und App-Linknavigation bis zur Antwort;
- genau ein gespeicherter Snapshot, richtige IDs und Soft-Deletes, Entwurf und Navigation nach Fehler wieder bedienbar.

Alle Requests/Auth/Storage/Bilder sind synthetisch. Unbekannte externe Requests werden abgebrochen. Browsergrößen 1440×1000 und 390×844 mit Touch. Die Web-UI bleibt deutsch; EN bezeichnet englische Karteninhalte und Browser-Locale. Bilder geladen, kein horizontaler Überlauf, keine JavaScript-Fehler. Persistenz wird nach Speichern/Reload geprüft; Entwurfserhalt bedeutet Erhalt bei Fehler/409 und abgebrochenem Verlassen, kein zusätzlicher Reload-Entwurfsspeicher.

Die vollständige lokale CI hat **2.361 Tests** bestanden (63 umgebungsabhängige DB-Tests übersprungen, 0 Lint-Fehler). `node scripts/test-occlusion-db.mjs` hat **7 echte PostgreSQL-Fälle** sowohl über den direkten als auch den automatischen CI-Datenbankpfad bestanden. Der Restore spielt alle **62 Migrationen** erfolgreich ein; alle 22 Tabellen haben RLS. Die SQL-Regressionen prüfen IDs, Geschwister, Bildquelle, FSRS, Reviews, konkurrierende Reviews, Ownership, Konflikte, Rollback, Kapazität, Soft-Deletes und RPC-Berechtigungen.

Web- und API-Produktions-Builds auf dem finalen Code sind erfolgreich (Exit 0). Der Web-Build wurde erst nach dem vollständig beendeten Browserlauf gestartet.

Die 24 bestehenden Screenshots und die ursprünglichen Implementierungsdetails stehen im [Abnahmeprotokoll vom 09.10.2026](web-card-media-730-731-2026-10-09.md). Neue lokale Screenshots/Logs liegen im aktuellen Worktree unter `.tmp/refresh-evidence/`; alle Tests sind eingecheckt und reproduzierbar. Ein früher Browserlauf wurde durch versehentlich parallel gestarteten Build/Next-Cache abgebrochen und danach sauber wiederholt. Ein weiterer Vorlauf verwendete auf Mobile einen verborgenen Desktop-Navigationslink; der Test klickt jetzt die sichtbare App-Navigation. Keine Fehler wurden ausgeblendet oder Tests übersprungen.

## Unveränderte Migration und PM-Rollout

Datei: `apps/api/supabase/migrations/20261009220000_edit_occlusion_image.sql`.

Funktion:

```sql
public.edit_occlusion_image(
  p_user_id uuid, p_deck_id uuid, p_image_path text,
  p_expected jsonb, p_regions jsonb, p_max_cards integer
) returns jsonb
```

SHA-256 der SQL-Datei: `7570ddf2b04430e3a3aa58c1f3e167a2cda1a3548a79ae5ebe4ab8d671b62f99`. Exakt gleich zum vom PM geprüften/installierten Stand `084a0472af33f756bcdeec60e557920f118b3497`; keine SQL-Änderung in der Race-/Fokus-Korrektur.

Der PM meldete am 11.10.2026 die additive Installation mit vollständigem Funktions-/ACL-Readback: SECURITY INVOKER, service_role darf ausführen, anon/authenticated nicht; zurückgerollte Negativprobe liefert DECK_NOT_FOUND, keine Daten geändert. Das ist PM-Evidenz; dieser Arbeitschat hat keine Produktionsmigration oder Produktionsdatenprüfung ausgeführt.

1. Finalen #762-Diff und die CI auf seinem endgültigen Head prüfen. Basis ist main; #761 ist bereits gemergt.
2. PM gleicht die installierte Funktion mit der unveränderten SQL-Datei/Signatur/Berechtigung ab. Die Funktion muss vor Auslieferung von `PUT /api/v1/decks/:id/occlusion` vorhanden sein; keine erneute Schemaänderung durch diesen Chat.
3. Erst nach Abnahme #762 mergen und API/Web ausliefern. Bei automatisch durch Merge ausgelöstem Deployment die Schema-Voraussetzung vorher bestätigen.
4. In der echten Zielumgebung mit autorisiertem Testdeck signierte Bild-URLs und den Persistenzweg prüfen: Bearbeiten/Speichern/Reload; IDs, Quelle, Zusatzdaten, FSRS und Reviews vorher/nachher vergleichen; Geschwister/andere Bilder, 409 und verzögertes Speichern prüfen. Entfernte Bereiche landen im Papierkorb; das Storage-Bild bleibt.
5. Falls die App-Auslieferung zurückgenommen werden muss, die vorherige API/Web-Version wiederherstellen. Die additive Funktion muss dafür nicht entfernt werden.

Kein Merge, EAS-Build, echter KI-Aufruf, Codex-Security-Scan oder Produktionsschreibzugriff durch diesen Arbeitschat. Primärer Checkout und fremde Worktrees bleiben unangetastet. GitHub-/Vercel-Status sind zusätzlich zur lokalen Evidenz auf dem aktuellen PR-Head abzulesen.
