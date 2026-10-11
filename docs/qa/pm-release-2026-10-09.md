# PM-Release-Nachweise – 09.10.2026

Dieser Nachtrag aktualisiert den datierten Read-only-Audit in `docs/audits/2026-10-09-open-issue-abgleich.md`. Dessen ursprüngliche Feststellungen bleiben als Momentaufnahme erhalten. Der Nachtrag vom 11. Oktober steht am Ende; frühere Dashboard-Angaben sind datierte Nachweise.

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

## Nachtrag – 11.10.2026

PR #764 wurde nach unabhängiger Prüfung als `dcd9adef171a67b2efb4ec54a60afac704ced14d` übernommen. Der CI-Dienst nutzt weiterhin PostgreSQL 16, bezieht dessen offizielles Image nun über `public.ecr.aws/docker/library/postgres:16`. Dadurch entfällt das anonyme Docker-Hub-Abruflimit. Datenbankprüfungen, Berechtigungen und Produktverhalten wurden nicht geändert; Website-Texte und README benötigen dafür keine Anpassung.

Der Main-Lauf [38166928476](https://github.com/ostheimer/cloudlearn/actions/runs/38166928476) ist vollständig erfolgreich. Vercel bestätigt für exakt diesen Main-SHA alle drei Veröffentlichungen als `READY` mit Ziel `production`:

- API: `dpl_6WoMmRSFAvzExv4T34YJ6Uhycy4S`.
- Web: `dpl_9eHNrJdNbHhrER5TFjLtN1nLi68r`.
- CloudLearn: `dpl_69eQwP2tCdmsfktDoWiqST4zJYHM`.

Die drei bestehenden Implementierungs-Chats wurden mit dem aktuellen Main-Stand fortgesetzt: #761/#762 für Web-Bilder und Maskenverwaltung, #765 für Tastatur/Fokus und #766 für Scan-Kosten/Vorschau. Die jeweils aktuellen Heads wurden unabhängig geprüft. Keine bezahlten App-Builds, echten KI-Aufrufe oder Nutzer-Datenänderungen wurden hierfür gestartet.

### Übernommene Web- und Scan-Korrekturen

| PR | Main-SHA | Erfolgreiche Main-CI | API / Web / CloudLearn, jeweils READY und production |
| --- | --- | --- | --- |
| #761 | `464f8c35380edb627958106418aabc4fc933056a` | [38167461227](https://github.com/ostheimer/cloudlearn/actions/runs/38167461227) | `dpl_9LENud74tdPEv4UffdrEsZcgbgnP` / `dpl_8eegXmWdaGzNhBe6rbrFYacsgbnP` / `dpl_6MW1HQSYvL8bVZC8fP9oDmVSu6Mg` |
| #765 | `c24d3aa49b7eb6237248d243d8e502e3cf2046f9` | [38167640385](https://github.com/ostheimer/cloudlearn/actions/runs/38167640385) | `dpl_AzjhGSJmv5kxxBEvsGVY8PRF9m9X` / `dpl_AhBnUh1hdhen98jExNCztkKcudL7` / `dpl_J4YUcU5NdixWnPanoj8miNqqFUBj` |
| #766 | `eac2d94bc691b72a538e587e3f8c9f1d8e774780` | [38167847498](https://github.com/ostheimer/cloudlearn/actions/runs/38167847498) | `dpl_2gsumBH7GCng9HKWCvFzTd3jDZNn` / `dpl_2Awehg49VNneXpu2K3HMEKq5QyM5` / `dpl_FkmgRohmxMFeKFCrgjVqi96z1QeF` |

#761 schließt #730: Quiz/Match zeigen gewöhnliche Kartenbilder auf der passenden Seite; Bildfragen verraten ihre Antwort nicht durch die Bildbeschriftung. Lokale DE/EN-Inhalts-/Locale-Prüfungen auf Desktop und Mobile verwenden synthetische API-/Bilddaten. Occlusion bleibt ein eigener Lernmodus.

#765 korrigiert sechs eng abgegrenzte Punkte aus #703. 52 Browserfälle, 24 gezielte Tests und Typecheck wurden auf dem aktuellen Head wiederholt. Tastaturbewertungen sind während der Kartenbearbeitung gesperrt; Dialoge und Menüs führen den Fokus kontrolliert zurück. #703 bleibt für seine übrigen Punkte offen.

#766 implementiert die vier Scan-Punkte aus #733. Vor dem separaten KI-Consent wird der aktuelle LP-Preis bestätigt; Abbrechen erhält den Entwurf. Titeländerungen, Schutz der letzten Vorschaukarte und PDF-Größengrenzen sind mit echten gemounteten Komponenten geprüft. Zehn reproduzierte Fehlerfälle wurden vor dem Fix rot und danach grün ausgeführt; 91 gezielte Fälle und 2.371 lokale Tests bestanden. Die datierte iPhone-15-/iOS-26.5-Simulatorprüfung vom 9. Oktober verwendet synthetische Daten und blieb für den unveränderten Runtime-Code gültig. #733 bleibt bis zum gebündelten Build und der physischen Geräteabnahme offen. Ein Vercel-Deployment aktualisiert keine installierte iPhone-App.

### Verbleibende Grenzen

Die Liste „Noch offen“ oben ist der Stand vom 9. Oktober; diese Ergänzung ersetzt dessen inzwischen erledigte Implementierungspunkte. Der CI-Chat und die abgeschlossenen Tastatur-/Scan-Chats wurden archiviert; Gerätegates bleiben in den Issues sichtbar.

#85 bleibt offen: `E2E Live` ist manuell deaktiviert und die vier Repository-Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` fehlen. Der vorhandene Ablauf würde synthetische Testdatensätze produktiv erstellen, ändern und löschen. Ein dediziertes Testkonto und die Autorisierung dieses konkreten Live-Testwegs fehlen; kein Erfolgsnachweis aus einem übersprungenen Lauf ableiten.

#758 bleibt vorbereitet und ungemergt: Google-Projekt und bewilligte Budgets fehlen. Die deaktivierten Standardwerte würden neue KI-Aufrufe blockieren. Budgetaktivierung, bezahlte Gerätebuilds und tatsächliche Geräteabnahme wurden nicht durch allgemeine CI-/Web-Erfolge ersetzt. Apple-Screenshot-/Dashboard-Angaben oben sind weiterhin die datierte Momentaufnahme, kein frisch bestätigter Status.
