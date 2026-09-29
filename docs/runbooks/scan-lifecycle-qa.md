# Scan nach dem Speichern erneut öffnen

Nach erfolgreichem Speichern bleibt die Ergebnisansicht mit „Jetzt lernen“ und
„Deck öffnen“ sichtbar. Sobald der Scan-Tab verlassen und erneut geöffnet wird,
beginnt ein neuer Scan: Das frühere Foto, die Karten und die gespeicherten
Deck-Aktionen werden zurückgesetzt. Auch nach Löschen des Decks in der Bibliothek
wird damit keine veraltete Erfolgsmeldung mehr angeboten. Die Deckliste wird bei
der Rückkehr neu geladen.

Ungespeicherte Kartenvorschauen, Textentwürfe und unvollständige Speicherversuche
bleiben beim Tabwechsel erhalten. Eine Rückkehr löst weder eine KI-Anfrage noch
das erneute Speichern eines Decks aus. „Neuen Scan starten“ ist weiterhin der
direkte Weg aus der noch geöffneten Ergebnisansicht.

## Lokale Regression

`scanScreenLifecycle.test.tsx` rendert die echte Scan-Komponente mit gemockten
nativen Oberflächen, Fokuswechseln und API-Antworten. Vor der Korrektur scheitern
vier von acht Fällen: Rückkehr nach Lernen, nach Deck-Navigation, nach einem
einfachen Tabwechsel und nach Abschluss des Speicherns im Hintergrund. Mit der
Korrektur bestehen alle acht Fälle, einschließlich Schutz von Entwürfen und
Fortsetzung eines teilweise fehlgeschlagenen Speicherversuchs ohne zweites Deck.

## Native Abnahme

Im lokalen iOS-Simulator mit lokalem Testbackend und festen Foto-Karten:

1. Foto importieren, acht Karten erzeugen und speichern.
2. „Jetzt lernen“ öffnen, acht Karten beantworten und die Runde abschließen.
3. Das Deck in der Bibliothek löschen; das Backend muss null Decks bestätigen.
4. Zum Scan-Tab zurückkehren.

Vor der Korrektur blieb „8 Karten gespeichert“ mit altem Foto und Deck-Aktionen
stehen (Baseline `7d17e8b`). Die Prüfung verwendet ausschließlich lokale Daten;
sie ist kein zusätzlicher Gemini-Aufruf und keine Änderung von Produktionsdaten.

## Auslieferung

Diese Korrektur betrifft die native App. Ein API-/Web-Deployment oder Merge
aktualisiert den installierten TestFlight-Build 7 nicht. Die Korrektur benötigt
den nächsten gebündelten iOS-Build und anschließend eine Geräteabnahme. Der
bestehende Apple-Review-Vorgang wird dafür nicht verändert.
