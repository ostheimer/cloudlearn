# PM-Release-Nachweise – 09.10.2026

Dieser Nachtrag aktualisiert den datierten Read-only-Audit in `docs/audits/2026-10-09-open-issue-abgleich.md`. Dessen ursprüngliche Feststellungen bleiben als Momentaufnahme erhalten.

## Übernommene Änderungen

Alle folgenden PRs wurden unabhängig geprüft und mit erfolgreicher GitHub-CI ihres jeweils geprüften Heads übernommen:

| PR | Verhalten | Main-Merge |
| --- | --- | --- |
| #740 | LP-Antwort liest das tatsächlich persistierte Guthaben; fehlendes/ungültiges Guthaben wird ehrlich abgelehnt. | `ee80da64e14c961144c82e9e8a5d1e7e5e3bfd4b` |
| #757 | Offene Issues und datierte Release-Nachweise abgeglichen. | `098a13634a645ce821b9a2ef80b749d8723577f1` |
| #739 | Datenbankfehler beim Lernfortschritt werden nicht als fehlender Fortschritt verschluckt; interne Fehlertexte werden nicht als 500-Antwort ausgegeben. | `69e0aac4e6fa139b0cf5d7e340e95445075de58d` |
| #741 | Einzelkarten-Restore zählt per Datenbankabfrage statt vollständiger Kartenliste. | `f34a0306d914e7dd93fe9c362a4beff859ff07ab` |
| #759 | Karteneditor behält Änderungen nach fehlgeschlagenem Speichern; letzte gepufferte Reviews werden vor der Abschlussabrechnung registriert. | `12a2ec3076a2676f53a50e9e3ba49d110366a409` |
| #742 | Ordner-Lernantworten sind auf 2.000 Karten und 2.000.000 UTF-8-Bytes begrenzt; Überschreitung liefert einen ausdrücklichen Fehler statt stiller Kürzung. | `7b5d60afd9bc6f4b91926c75b66c677639e03030` |
| #743 | Schwere Konto-/Papierkorb-/Fortschrittsrouten verwenden persistierte Ratenbegrenzungen. | `f4978af5c17c6f84ce627907ff446595fcfff669` |
| #760 | Gemeinsame Scan-Texte und Deck-Platzhinweise; verständliche Support-Texte; Lifetime-Dokumentation an das veröffentlichte Angebot angepasst. | `4d6711ddec265382d748e6ea3b11ab9813cb3e40` |
| #744 | Parallele Deck-Restores prüfen Kapazität und stellen Deck/Karten in derselben Datenbanktransaktion wieder her. | `b401bfca05da14a45910ae071a802e8961d1c1c8` |

Die älteren PRs #736 und #737 wurden mit begründeten Verweisen auf die übernommene Implementierung geschlossen. Die Sammel-Issues #697 und #700 bleiben wegen ihrer dokumentierten Restpunkte offen.

## Datenbank-Abhängigkeit vor API-Veröffentlichung

Für #739–#743 wurden vorhandene Funktionen gegen die produktive Datenbank geprüft. Die neue Funktion `public.restore_deck_with_limit(uuid, uuid, integer)` aus #744 war zuvor nicht vorhanden und wurde vor dem abhängigen API-Merge additiv installiert.

- Supabase-Projekt: `clearn` / `yektpwhycxusblnueplm`, `eu-west-1`.
- Repository-Datei: `apps/api/supabase/migrations/20260802010000_atomic_deck_restore.sql`.
- Produktiver Migrationseintrag: `20261009204233`, Name `atomic_deck_restore`. Die Zeitstempel unterscheiden sich; nicht als fehlende Migration erneut anwenden.
- Readback: vollständige Funktionsdefinition, Eigentümer `postgres`, `SECURITY DEFINER`, leerer `search_path`; Ausführung nur für `service_role`, nicht `anon` oder `authenticated`.
- Negativprobe mit nicht vorhandenen synthetischen UUIDs und zurückgerollter Transaktion: `not_found`. Keine Nutzerdaten geändert.
- Lokaler echter PostgreSQL-Test prüft konkurrierende Restores bei 19/20, dasselbe Deck zweimal, archivierte Decks, Besitzer-/Löschzeitstempel, gemeinsamen Rollback und RPC-Berechtigungen.

Die neue Sperre serialisiert Deck-Restores untereinander. Sie ist keine globale Sperre für alle anderen Deck-Erzeugungs-/Importwege. Bestehende Ausfallregeln der Ratenbegrenzung werden durch #743 nicht grundsätzlich geändert.

## CI und Deployment

Der zuvor manuell deaktivierte Workflow `CI` (232778753) wurde wieder aktiviert. Frische PR-Läufe einschließlich echter Datenbankprüfungen ersetzen die alten Oktober-2-Nachweise. `E2E Live` bleibt deaktiviert; fehlende Live-Test-Credentials sind weiterhin ein separates Abnahmehindernis.

Main-CI für die sieben ersten Merge-SHAs bis einschließlich `f4978af` ist erfolgreich. Main-Lauf [37989821084](https://github.com/ostheimer/cloudlearn/actions/runs/37989821084) von #760 scheiterte auch beim erneuten Start vor Checkout am Docker-Hub-Abruflimit für `postgres:16`; keine Projektprüfung wurde ausgeführt. Der spätere Main-Lauf [37990089859](https://github.com/ostheimer/cloudlearn/actions/runs/37990089859) bei `b401bfca05da14a45910ae071a802e8961d1c1c8`, einschließlich #760 und #744, ist vollständig erfolgreich: Lint, Typecheck, Tests mit echter Datenbank, Restore-Probe mit 61 Migrationen und 22 RLS-Tabellen, beide Builds und Browser-Smoke-Test. Eine dauerhafte Registry-Korrektur ist als enger Folgeauftrag zu #85 in PR #764 vorbereitet.

Die API-Veröffentlichung von `f4978af` ist in Vercel `READY`, Ziel `production`, mit Alias `clearn-api.vercel.app`. Unveränderte Web-Projekte können bei einem reinen API-Merge vom Ignored-Build-Schritt als `CANCELED` markiert werden; das ist kein Beleg für eine aktualisierte Web-Version. Für #759 wurden beide Web-Projekte mit dessen SHA als `READY` bestätigt.

Bei `b401bfc` ist die API-Veröffentlichung `dpl_8aGLjQXQqK29tEFdkKFBQUuUwX5A` ebenfalls `READY` / `production`. `GET https://clearn-api.vercel.app/api/health` lieferte `status: ok`. Die öffentliche Support-Seite unter `https://clearn-web.vercel.app/support` enthält den neuen Text aus #760: „Du brauchst Hilfe mit clearn? Hier findest du unseren Kontakt und erfährst, welche Angaben uns helfen, dein Problem zu lösen.“ Ein Health-Readback ersetzt keine authentifizierte produktive Fachfunktionsabnahme.

Für #760 sind API (`dpl_W19KKHd8Y7jK8aAZtc9wtN9CmcWR`), Web (`dpl_9mCEKAuPETkwaJtqkc6E8raRC8iz`) und CloudLearn (`dpl_93kuaDztsRSD8sMtYj3M7Lfu8Af2`) für exakt `4d6711ddec265382d748e6ea3b11ab9813cb3e40` als `READY` / `production` bestätigt. Die produktive API wird anschließend durch `b401bfc` ersetzt. Issue #702 kann damit anhand seiner konkreten Server-Anforderungen geschlossen werden; keine allgemeine globale Decklimit-Garantie oder Geräteabnahme ableiten.

## Dokumentation und sichtbare Veröffentlichung

#760 aktualisiert README, Monetarisierungskonzept, Support und Import-Texte. Lifetime wird als angeboten dokumentiert; der Preis kommt weiterhin vom Store. Preise und LP-Regeln wurden nicht geändert. Die API-Guards benötigen keine zusätzliche Marketingbehauptung auf der Website.

Mobile Änderungen in #759/#760 erreichen vorhandene iPhones nicht durch diesen Merge. Es gibt keine OTA-Auslieferung. Scan-, Editor-, Bild-/Masken- und Bedienungsänderungen werden für einen späteren gemeinsamen App-Build gesammelt; kein neuer EAS-Build wurde in diesem PM-Lauf gestartet.

## Noch offen

- #733: Scan-Kostenbestätigung, bearbeitbarer Vorschautitel, letzte Karte löschen, PDF-Größenprüfung; Integration mit #760 und Simulatorprüfung.
- #730/#731: Bilder im Web-Quiz/Matching und nicht destruktive Maskenbearbeitung.
- #703: Tastatur-/Dialogkorrekturen sowie weitere getrennt dokumentierte Restpunkte.
- #756/#758: Budgetmechanismus vorbereitet, aber nicht übernommen/aktiviert. Benötigt tatsächliches Google-Projekt und bewilligte Budgets. Die deaktivierten Standardwerte würden neue KI-Aufrufe blockieren.
- #735/#597 und weitere Gerätegates: gebündelte reale Geräteabnahme fehlt.
- Apple: öffentlich weiterhin Version 1.0 mit einem iPhone-Screenshot, ohne iPad-Screenshots. Der interne Status der eingereichten fünf Bilder lässt sich derzeit wegen abgelaufener Anmeldung nicht lesen.

Kein Sammel-Issue wird allein aufgrund einer Teilkorrektur geschlossen. Tests, Produktionsdeployment und tatsächliche Geräteabnahme bleiben getrennte Nachweise.
