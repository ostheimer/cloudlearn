# Offene Issues: Abgleich am 9. Oktober 2026

## Prüfumfang und Evidenzgrenzen

Geprüfter Ausgangsstand: `origin/main` **6a896da8e23613475bd8da1159c63ce076c3ce15**. Alle **21 offenen Issues** einschließlich sämtlicher Kommentare sowie alle **acht offenen PRs** einschließlich Beschreibungen, Kommentaren, Reviews, Dateilisten, Head-SHAs und Checkzuständen wurden über GitHub gelesen. Umsetzung und Tests wurden im eigenen Worktree auf diesem Main-Stand geprüft. Dieser Bericht ändert ausschließlich Dokumentation; keine Issue-Schließung, Produktionsdatenänderung, Ads-Aktivierung, echten KI-Aufruf oder EAS-Build.

Statusbegriffe:

- **E – erledigt-belegt:** eng benannte Teilanforderung im aktuellen Code vorhanden, mit passender Evidenz; keine pauschale Geräte-/Kaufabnahme.
- **A – implementiert-noch-Abnahme:** Umsetzung vorhanden, aber der relevante reale Ablauf bzw. die Auslieferung ist nicht vollständig bewiesen.
- **O – offen-umsetzbar:** konkret abgrenzbare Entwicklung oder Prüfung im autonomen PM-Auftrag.
- **N – echte wichtige Nutzerentscheidung:** Geldbudget, Anbieter/Vertrag, Preisquelle oder zusätzliche externe Aktivierung. Fehlende Zugangsdaten und Gerätebefunde sind externe Nachweise, keine erfundene Produktentscheidung.

Die historischen Aussagen „Lara entscheidet vor jeder Änderung“ erzeugen für den aktuellen Andreas-PM-Auftrag keine erneute allgemeine Freigabepflicht. Ausdrücklich abgelehnte Produktideen werden trotzdem nicht neu erfunden. Gebühren, Vertragswahl, Echtgeld-Aktivierung und neue Ausgaben bleiben gesonderte Grenzen.

## Aktuelle Main-, CI- und Release-Nachweise

| Nachweis | Ergebnis und Grenze |
| --- | --- |
| Main-CI [37040414362](https://github.com/ostheimer/cloudlearn/actions/runs/37040414362) | SUCCESS für exakt `6a896da`, 2. Oktober. Job-Schritte geprüft: Install, Lint, Typecheck, Tests, Restore-Probe, Web-Build, Mobile-Web-Build, Browser-Smoke. Dies ist ein datierter Nachweis dieses unveränderten Commits, kein neuer Lauf vom 9. Oktober. |
| Production-Deployments desselben SHAs | GitHub-Deployment-Statuses SUCCESS: API `6814212379`, Web `6814219191`, Mobile-Web-Preview `6814241798`. Das belegt Deployment, keine angemeldete Funktionsabnahme. |
| Live-E2E [37267355365](https://github.com/ostheimer/cloudlearn/actions/runs/37267355365) | Letzter zurückgegebener Lauf, 5. Oktober, `6a896da`: **guard SUCCESS, e2e SKIPPED**. Erfolg des Workflows ist ausdrücklich kein bestandener Live-E2E-Test. |
| Aktueller Workflow-Zustand | `gh workflow list --all`: **CI (232778753) und E2E Live (321971873) disabled_manually**, Perf HTTP active. Daher kein neuer CI-Lauf für diesen Audit-PR. Die erfolgreiche Main-CI vom 2. Oktober ersetzt dieses fehlende aktuelle Gate nicht. Wiederaktivierung ist eine Repository-Einstellung außerhalb des read-only Audits. |
| Repository-Secrets | `gh secret list` liefert keine Namen. Die vier Live-E2E-Secrets sind nicht hinterlegt; Werte wurden weder gelesen noch ausgegeben. |
| Frische lokale CI | `pnpm install --frozen-lockfile`, anschließend `pnpm run ci`: **2.260 Tests bestanden**, **48 API-Integrationstests übersprungen** (lokal kein `DATABASE_URL`); Lint 0 Fehler / 32 Warnungen; alle Typechecks bestanden. Verteilung API 837, Mobile 890, Web 483, Contracts 20, Testkit 26, Domain 4. Keine neue SQL-Integrationsabnahme behauptet. |
| Frische lokale Resume-UI | Vier unveränderte Browserfälle aus `e2e/local.resume.spec.ts` **4/4 bestanden** mit synthetischer Auth/API, inkl. Ergebnis-/Fehlerstapel und exakt neuen Review-/LP-Requests. Eigener Port 4189 wegen parallelem Chat auf 4175; temporäre Kopie nur Port und Start-/Testtimeout angepasst. Erster Standardstart scheiterte am 60s-Serverlimit; erster isolierter Lauf 3/4 + Navigation-Timeout vor Assertion. Wiederholung mit 90s-Testlimit 4/4. Keine reale Cross-device-Abnahme. |
| Öffentliche Web-Oberfläche | `https://clearn-web.vercel.app/` in Chromium bei 1440 und 390 px: HTTP 200, keine Page-Errors, kein horizontaler Überlauf, sichtbarer App-Store-Link auf `id6766691399`. Nur anonyme Landingpage, keine angemeldeten Lern-/Kaufabläufe. |
| Öffentlicher Store | [Österreichischer App Store](https://apps.apple.com/at/app/clearn/id6766691399) frisch gelesen: App verfügbar; Monats-, Jahres- und Lifetime-Produkte werden aufgeführt. Store-Katalog beweist weder installierte Buildnummer noch Kauf/Restore/LP-Gutschrift. |
| Domain `clearn.ai` | Frischer HTTP-Readback: HTTP 200, Titel **„Parked Domain name on Hostinger DNS system“**, Links auf Hostinger. Auslöser aus #681 ist weiterhin nicht erfüllt. |
| Release-Dokumente | `docs/shipaton-2026/release-readiness.md` ist bis 2. Oktober fortgeschrieben: öffentliche Version 1.0 / eingereichter Build 8; neuere Mobile-Änderungen brauchen einen weiteren Build. `release-evidence-2026-09-28.md` ist historisch Build-7-/Mac-Evidenz, keine heutige Store-Sperre. |
| Native Evidenz | Mac-TestFlight 6/7 und lokale iPhone-15-Simulator-Flows sind dokumentiert. Kein vollständiger physischer iPhone-Durchlauf der Listen #597/#735 und kein erfolgreicher echter Store-Kauf mit anschließendem Restore belegt. |

## Matrix aller offenen Issues

| Issue | Einordnung | Belegter Stand / genaue Restarbeit |
| --- | --- | --- |
| [#84](https://github.com/ostheimer/cloudlearn/issues/84) Monetarisierung | **E + A + O** | Kein Balance-Cap ist bewusst entschieden und in `MONETIZATION_CONCEPT.md:95` dokumentiert. PDF für alle gegen LP: API/Contracts `featureGates.ts`, `limits.ts:122`, Mobile-PDF-Kachel `scan.tsx:1764`, Web-Pro-Text ohne Exklusivbehauptung `lp/page.tsx:324`. Lifetime ist öffentlich angeboten; Konzept Phase 2 sagt in Zeile 298 weiterhin „ohne Lifetime“. Das ist eine konkrete Doku-Konsolidierung, keine neu offene Verkaufsentscheidung. Physischer PDF-Free-/Lifetime-Kauf-/Restore-Nachweis fehlt. |
| [#85](https://github.com/ostheimer/cloudlearn/issues/85) CI | **E + A** | Frozen Lockfile und echtes `eslint .` vorhanden; `e2e-live.yml` mit Zeitplan/manuellem Start gebaut. CI und E2E Live aktuell manuell deaktiviert; keine Repo-Secrets, letzter E2E-Job übersprungen. Nach Wiederaktivierung der Workflows und autorisiertem Einrichten der vier Credentials einmal kostenfreie Suite ohne `@paid` wirklich ausführen und Bericht lesen. |
| [#165](https://github.com/ostheimer/cloudlearn/issues/165) Ads | **E + A + N** | Client-Selbstgutschriften entfernt; SSV-Service/Signaturprüfung/SQL liegen vor. `ads-mode.json` hat `realAdsEnabled:false`: heute inert/ausgeblendet, nicht mehr die im Issue beschriebene Mock-Werbung. AdMob-Konfiguration, produktive SSV-RPC, echte IDs und signierter Kandidat aktuell unbestätigt. Aktivierung ist eine zusätzliche Entscheidung mit Echtgeld-/Build-Folge. |
| [#368](https://github.com/ostheimer/cloudlearn/issues/368) Web-Kauf | **N + O** | Kein Web-Checkout; `dashboard/pro` und `dashboard/lp` verweisen auf App. Anbieter, Verkäufer-/Steuerkonstrukt, Preis- und Mehrfachabo-Regeln sind reale Entscheidungen. Danach Testmodus-Integration an bestehende Entitlement-/LP-Wahrheit; keine aktuellen Gebühren/Store-Rechtsregeln aus Juli als gültig übernehmen. |
| [#571](https://github.com/ostheimer/cloudlearn/issues/571) Parität | **E + A + O + N** | Bereits umgesetzte Blöcke erhalten; offene Anforderungen auf #729–#734 verteilen. #697/#700 berühren Abnahme bestehender Kästchen. Keine erneute Implementierung der bereits vorhandenen Unterordner, Papierkorb, Richtung, Details oder Quiz-Zurück-Funktion. Teilmatrix unten. |
| [#597](https://github.com/ostheimer/cloudlearn/issues/597) Gerätetest | **A** | Zwei Juli-Buildstände und „nächster Build“ sind historisch. Für jeden Test installierten Build/Quellstand, Gerät/iOS, Ergebnis und Datum neu festhalten. Hör-, Zieh- und Wischabnahme bleibt offen. Mit #735 gemeinsam prüfen, keine Doppel-Builds. |
| [#614](https://github.com/ostheimer/cloudlearn/issues/614) Produktauswahl | **E + A + O + N** | Acht angenommene Einzelideen im Code vorhanden (inklusive E-Mail ändern UND Geräteanzeige getrennt); 13 ausdrücklich abgelehnt, Ergebnis-Teilen als #681 ausgelagert. Einzige nicht gebaute zugesagte Idee: E-Mail-Erinnerung/Review. Versanddienst/Kosten fehlt; Opt-in, Abmeldung, Versandlogik sind nicht fertig. Teilmatrix unten. |
| [#681](https://github.com/ostheimer/cloudlearn/issues/681) Ergebnis teilen | **O, Domain-Abhängigkeit** | Kein Ergebnis-Teilen-Knopf; vorhandenes Deck-/Freunde-Teilen wiederverwenden. Domain noch geparkt. Schlanker Textentwurf mit richtigen Rundenzahlen und Streak ist planbar; Bildkarte wäre zusätzlicher Umfang. Aktivierung nach funktionsfähiger Zieladresse. |
| [#697](https://github.com/ostheimer/cloudlearn/issues/697) Resume | **E + A, anderer Chat** | Spätere Umsetzung #745 in Main speichert `cardIds` + Ergebnisse und Background-Commit; `resume-validation.md` enthält lokale Browser-/SQL-/Migrationsevidenz. Alte PR #736 ist CONFLICTING und überschneidet sich. Nicht ungeprüft zusätzlich mergen; verbleibende native/echte Geräte-Sync-Abnahme und jüngeres Konflikt-Review beim zuständigen Chat. |
| [#699](https://github.com/ostheimer/cloudlearn/issues/699) Pokal | **E + A + O** | #718 (`d04b720`) korrigiert Hauptpokal in match/test und `StudyResult`-Kommentar. Gemeinsamer Rahmen weiterhin nur cloze/occlusion/practice; learn/quiz/match eigenständig. Match ohne Nachüben-Knopf; Test leitet falsche Karten in Karteikarten statt Prüfungs-Nachüben. Gerätetest aus #735 Punkt 4 offen. Details unten. |
| [#700](https://github.com/ostheimer/cloudlearn/issues/700) Karteneditor | **A + O, anderer Chat** | PR #737 mit echten Schwierigkeiten, Fehlertexten und Accessibility, auf Main nicht übernommen. Native Auslieferung fehlt. Alle Issue-Anforderungen gegen PR abnehmen, insbesondere Quiz-Hinweis und Stift in fehlenden Modi; `Closes #700` im PR ist kein Vollständigkeitsbeweis. |
| [#702](https://github.com/ostheimer/cloudlearn/issues/702) API-Guards | **E + A + O, anderer Chat** | #721 im Main: Progress-Mengengrenzen, Papierkorb-Zeitstempelzählung, Streak `>=`. Sechs offene PRs #739–#744 für Rest; #739 wurde während des Audits gegen Main aktualisiert und ist jetzt MERGEABLE, neuer Head ohne GitHub-CI wegen deaktiviertem Workflow. Neue Migration #744 erst geprüft anwenden, danach abhängige API. Teilmatrix unten. |
| [#703](https://github.com/ostheimer/cloudlearn/issues/703) Kleinkram | **E + O** | Mehr erledigt als zwei Kästchen: Einheit „Karten“, `— voll`, `/cards/search`-README, Setup-Richtung und mehrere Kommentar-/Exportbehauptungen korrigiert bzw. widerlegt. Tastatur-/Dialog-, Tagesziel-Timing-, Ordner- und „Fast“-Reste konkret offen. Vollständige Teilmatrix unten. |
| [#729](https://github.com/ostheimer/cloudlearn/issues/729) Scan-Wortlaut | **O** | Sechs klar begrenzte Copy-Blöcke, de/en gemeinsam. URL-Behauptung „inkl. Bilder“ inzwischen in der App bereits durch „Webseite als Text“ ersetzt; trotzdem übrige Texte/Slots divergent. Kein neuer allgemeiner Lara-Freigabeblocker; Scan-Datei mit #756-/Scan-Verantwortlichen abstimmen. |
| [#730](https://github.com/ostheimer/cloudlearn/issues/730) Web-Bilder | **O** | Web Quiz/Match ohne Bildrendering/Fragetyp; `card-display.ts` + Learn-Medienpipeline vorhanden. Erst Standardkarten mit Bildern rendern, dann Bild-Fragetyp getrennt. Occlusion weiter ausschließen. |
| [#731](https://github.com/ostheimer/cloudlearn/issues/731) Web-Occlusion-Verwaltung | **O** | `occlusion/page.tsx` lernt, `new/page.tsx` erzeugt und löscht Bereiche einer neuen Vorschau. Kein vorhandene-Bilder-Verwaltungs-/Editweg. Wiederverwendung `sourceImageUrl`-Gruppierung + Karten-Geschwister. Tests für gelöschte/geänderte Regionen und erhaltene Lernstände zuerst. |
| [#732](https://github.com/ostheimer/cloudlearn/issues/732) Web-Packpreise | **N + O** | `lp/page.tsx:274–301` zeigt LP-Mengen, kein Storepreis/Checkout; App liest `priceString` aus RevenueCat. Reales Problem ist verlässliche Preisquelle/Region, keine allgemeine UI-Freigabe. Sicherer bestehender Weg: App-Kaufhinweis als konkreten Link verbessern; keine statischen Preise erfinden. |
| [#733](https://github.com/ostheimer/cloudlearn/issues/733) Scan-Reste | **O** | Vier Reste weiterhin vorhanden: LP-Kostenbestätigung, Titel ändern, Warnung vor letzter Vorschau-Löschung, PDF-Größenvorprüfung. Neue Gemini-Sendeeinwilligung ist keine LP-Kostenbestätigung. #738 prüft Leistbarkeit vor Quellenöffnung, ersetzt diese vier Anforderungen nicht. |
| [#734](https://github.com/ostheimer/cloudlearn/issues/734) App-Parität | **O** | Prüfung schweigt bei `qs.length===0`; kein gleicher Nachüben-Weg in match/test; kein Link-Kopierdialog; KI-Badge/Ordner-Deckzahlen, KPI-Kacheln und eigene Rangzeile fehlen. Ordner-Kopfzählung ist dagegen schon vorhanden. Sechs Pakete unten. |
| [#735](https://github.com/ostheimer/cloudlearn/issues/735) Juli-Buildtest | **A** | `0d0db0f`/EAS-ID vom 31. Juli bleibt historische Referenz. Keine bestätigten Checklisten-Ergebnisse. Gemeinsame aktuelle Abnahme mit #597, ergänzt um seitdem gemergte Resume-/Scan-Fixes. |
| [#756](https://github.com/ostheimer/cloudlearn/issues/756) KI-Budget | **O + N, anderer Chat** | Globale Reservierung/atomarer laufender Job fehlen weiterhin; `lpChargedIdempotentRequest.ts` + Gemini-Aufrufstellen vorhandene Basis. Monatsbudget und Providerprojekt müssen tatsächlich zugeordnet werden. Keine bezahlten Probeaufrufe zur Verifikation. |

## #85, #84 und #165: Abschlussbedingungen

**#85:** CI und E2E Live sind in GitHub manuell deaktiviert (frisch über Workflow-API gelesen), daher fehlt aktuell auch das automatische PR-CI-Gate. Beide Workflows erst im PM-Auftrag gezielt wieder aktivieren; dieser read-only Audit ändert die Repository-Einstellung nicht. `ci.yml`, `eslint.config.mjs`, `package.json`, `e2e-live.yml`, `docs/runbooks/e2e-live-ci.md` sind vorhanden. Erforderliche Secret-Namen: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`. Nach Einrichtung E2E-Job mit allen Testresultaten lesen; Skips und `@paid` gesondert nennen. Manuelle Ausführung ohne `include_paid_import` kostet keine KI-Aufrufe. Dieser Audit hat keine Credentials angelegt und keine Live-Suite gestartet.

**#84:** PDF-Tarifentscheidung und kein Balance-Cap sind umgesetzt. `packages/testkit/src/lpEconomyConsistency.test.ts` prüft echte Exporte; die frische CI enthält diese Suite. Dokumentation muss Lifetime-Angebot und historische Earn-Regel („min. 5 Karten“ vs. heutige Auszahlung je Karte) mit aktuellen API-Regeln abgleichen. Lifetime ist inzwischen veröffentlicht, nicht nach alter Juli-Notiz ausbauen. Kein Kauf-/Restore-Erfolg aus Store-Produktliste ableiten.

**#165:** `apps/api/src/services/adSsvService.ts` setzt 5 LP; `adSsvCrypto.ts` verifiziert Google-Signaturen; Migration `20260709130000_add_grant_ad_ssv_lp.sql` enthält Idempotenz und Tagesgrenze. Tests `adSsvCrypto.test.ts`, `disabledAds.test.ts`, `adHonesty.test.ts`, `adRewardSettler.test.ts` sind in frischer CI enthalten. Ohne DB-/AdMob-Readback sind RPC-Bestand, Callback und produktive Units **nicht feststellbar**. Erst Backend/RPC und Konto-/Unit-Konfiguration, dann Flag/IDs und EIN gebündelter signierter Build, danach SSV → Gutschrift → Replay ohne zweite Gutschrift → Tagescap. Die bloße Callback-Replay-Prüfung ersetzt den Cap-Test nicht.

## #699: drei getrennte Anforderungen

| Anforderung | Stand auf Main | Fehlender Nachweis / nächste Arbeit |
| --- | --- | --- |
| Grüner Hauptpokal in Zuordnen ohne Zeitmodus und Prüfung bei jeder Note | **E/A:** `match.tsx:732`, `test.tsx:786`, `StudyResult.tsx:10–12,39`; #718 vorhanden | Vorheriger Hauptsymbolfehler nicht nochmals fixen. Physischer Kandidat mit Match timed/untimed sowie schlechter/mittlerer/guter Prüfung; keine gezielte Trophy-Regression im Testbestand gefunden. Bestzeit-Abzeichen in Match ist separat gelb, kein Nachweis einer roten Haupttrophäe. |
| Einheitlicher Ergebnisrahmen | **O:** `StudyResult` importiert nur cloze/occlusion/practice; learn/quiz/match eigene Ergebnisansichten | Refactor eng getrennt von Button-Verhalten; Modusüberschriften, LP-/Bestzeit-/Nachüben-Anteile erhalten, Bildschirmvergleich über lokale Expo-Vorschau. |
| Gleicher Nachüben-Knopf und Funktion | **O:** Match kein Fehlerstapel; Test `test.tsx:858–861` „Falsche als Karteikarten üben“ | Zuerst Verhalten für beide Modi reproduzieren; dieselben falschen Quellkarten nachüben, keine zweite Bewertung bekannter Karten. #734 Punkt 2 gehört demselben Paket, kein doppelter PR. |

## #571 / #729–#734: alle offenen Teilanforderungen

| Paket / Teil | Aktueller Stand und Fundstelle |
| --- | --- |
| #729 Untertitel | Mobile `resources.ts:190–193`; Web `import/page.tsx` Quellenkacheln. Foto/Galerie differieren; URL-App inzwischen „Webseite als Text“. |
| #729 Info | Mobile `scan.tsx:1841` Gemini/Flashcards; Web `import/page.tsx:1088` KI/Frage-Antwort-Karten. Offen. |
| #729 Erzeugen | Mobile `resources.ts:194–195` zwei Verben; Web `import/page.tsx:1265` „Karten erstellen“. Offen. |
| #729 Laden | Mobile `scan.tsx:1508–1515` Quellen + `...`; Web einheitlicher Text/`…`. Offen. |
| #729 Zurück | Mobile `common.back`; Web `import/page.tsx:1104` andere Quelle. Offen. |
| #729 Slots | `importLimits.ts:133` blendet Zahl ab 30 aus; Web `import-limits.ts:166` `deckOptionLabel` zeigt freie Plätze. Offen. |
| #730 Bildanzeige | Web `deck/[id]/quiz/page.tsx`, `match/page.tsx` ohne Medienrendering; Learn zeigt bereits Medien. Offen. |
| #730 Bild-Fragen | Mobile `quiz.tsx` als Vorbild, Web kein entsprechender Fragetyp. Offen, separates größeres Paket. |
| #731 Verwaltung/Bearbeitung | Web `occlusion/page.tsx` Lernmodus und Link nur nach `/new`; `new/page.tsx` legt neue Karten je Region an. Vorhandene Bereiche nachträglich verwalten fehlt. Löschen in neuer Vorschau schon da. |
| #732 Preise | Web `lp/page.tsx`; verlässliche externe Region-/Währungsquelle ungeklärt. App-Link ist unabhängig umsetzbar. |
| #733 Kosten | `scan.tsx:575,614` frische Gemini-Sendeeinwilligung; `aiImportConsent.ts` enthält keine LP-Kosten. Ein echter LP-Bestätigungsschritt für Foto/Galerie/PDF fehlt. |
| #733 Titel | `setDeckTitle` bekommt nur Generatortitel/Entwurf; `handleSaveNewDeck` verwendet ihn. Kein Eingabefeld zum Ändern vor Speichern. |
| #733 letzte Vorschaukarte | `scan.tsx:749` entfernt mit `removeCardAt` ohne Nachfrage; bei null Karten wechselt Oberfläche zur Quelle. „Nichts zu speichern“ erst beim Speichern deckt diesen Verlust nicht ab. |
| #733 PDF-Größe | `readPickedPdfAsBase64`, `handlePickPdf` in `scan.tsx:514–568` ohne `asset.size`-/Bytegrenze. Client-Grenze an tatsächliches API-Limit koppeln; keine frei erfundene 3-MB-Regel. |
| #734 keine Fragen | `test.tsx:348–362`, `if (qs.length===0) return` weiterhin stumm. Web-Fallback wiederverwenden; erster Defekt mit reproduzierendem Test. |
| #734 Nachüben | Match ohne „nur nicht gewusst“, Test mit Karteikarten-Deep-Link. Gemeinsames Paket mit #699. |
| #734 Teilen-Dialog | `deck/[id].tsx:321` und `decks.tsx:388` nur `Share.share`; eigener Link-/Copy-/Rotation-Dialog fehlt. Bestehende Share-Token-API wiederverwenden. |
| #734 KI-Badge/Zähler | Roh-Tags in Deckansicht; Bibliotheks-Fälligwerte teilweise schon da. `library-folder/[id].tsx:485` hat Kopfzählung bereits; Deck-Kacheln dort zeigen die geforderten differenzierten Zahlen/Badge noch nicht. Nicht den Kopf neu bauen. |
| #734 Statistik-KPI | `stats.tsx` hat Kalender, Genauigkeit, Pro-/Prüfungsbereiche und `AccuracyByKindCard`; zusätzliche Web-KPI-Kachelgruppe fehlt. |
| #734 eigener Rang | `leaderboard.tsx:187` nur kleine Rangkopfzeile; Web `leaderboard/page.tsx:232,259` eigene Karte + außerhalb Topliste angehängte Zeile. Offen. |

Abgehakte #571-Blöcke bleiben erhalten: Kanon-Texte Lernen/Bibliothek/Profil/LP, globaler Lerneinstieg, Stern, Quiz-Zurückpuffer, Setup-Richtung, Details/Tags/Schwierigkeit, Wackelkandidaten-Deep-Link, LP-Auswege, Unterordner, leeres Deck, Passwortreset, Streak-Tageszahlen und Papierkorb. Frische Code-/Testsichtung ist keine erneute vollständige angemeldete UI-Abnahme dieser gesamten Liste. Resume (#697), Lerneditor (#700) und native Geräteabnahme sind eigene offene Nachweise.

## #614: 23 Ideen einzeln abgeglichen

| Idee | Ergebnis |
| --- | --- |
| Papierkorb | **E/A:** `trashService.ts`, Web `dashboard/trash`, Mobile `trash.tsx`, `trashDb.test.ts` / `trashService.test.ts` / `trashCopy.test.ts`. Restore-Race aus #702 noch offen. |
| Export | Ausdrücklich abgelehnt; Anki-Attrappe in #715 entfernt. Kein neuer Exportauftrag. |
| E-Mail ändern | **E/A:** Web-Profil/Mobile-Profil `auth.updateUser({email})`; `profileEmailDevicesCopy.test.ts`. Reale Mailbestätigung nicht in diesem Audit ausgelöst. |
| Geräteübersicht | **E/A:** `push/devices`, `profileApi.ts`, `pushDevices.test.ts`; zeigt nur Push-erlaubte App-Installationen, keine Browser-/Sessionverwaltung. |
| Karten verschieben | Ausdrücklich abgelehnt. |
| Mehrfachauswahl/Löschen | **E/A:** `cards/delete-many`, beide Deckansichten, Tests; nicht Verschieben. |
| Decks zusammenlegen | Ausdrücklich abgelehnt. |
| Bibliothek sortieren | **E/A:** `deckSort.ts` / `deck-sort.ts`, beide Tests; letztes Lernen über `stats/last-learned-by-deck`, keine Sortier-Neuentwicklung. |
| Archivieren | **E/A:** Archivpfade/`archived_at`, `deckArchive.test.ts`; zählt gegen Deckgrenze. Produktionsmigration historisch im Issue belegt, hier nicht erneut DB-gelesen. |
| Karten-Tags | Ausdrücklich abgelehnt; Deck-Tags sind davon verschieden. |
| Deck-Beschreibung | Ausdrücklich abgelehnt. |
| Fortschritt reset/pausieren | Ausdrücklich abgelehnt. |
| Tagespensum deckeln | Ausdrücklich abgelehnt. API-Sicherheitsmengenlimit aus #702 nicht damit verwechseln. |
| Listenimport LP-frei | Ausdrücklich abgelehnt. |
| Notizfeld | Ausdrücklich abgelehnt. |
| Karte melden/KI verbessern | Ausdrücklich abgelehnt; Beta-Feedback-Attrappe entfernt. `AGENTS.md` nennt sie noch – veraltete Doku, kein Anlass zum Wiederaufbau. |
| Lernzeit/beste Zeit | Ausdrücklich abgelehnt. |
| Deck-Reife | Ausdrücklich abgelehnt. |
| Prüfungstermin | Ausdrücklich abgelehnt. |
| E-Mail-Erinnerung/Review | **O/N:** einziges nicht umgesetztes zugesagtes Feature. `notificationService.ts` verschickt Expo-Push, keinen E-Mail-Review. Für Mail fehlen Dienst/Absender, Präferenzen, Opt-in, Abmeldeweg, Inhalt/Auswertung und Versandnachweis. Die Issue-Behauptung „Auswertung und Cron fertig“ beweist keinen fertigen Wochenmail-Fluss. |
| Ergebnis teilen | Eigenes #681; Domain weiterhin geparkt. |
| Geteilte Decks nachziehen | **E/A:** `sharedDeckSyncService.ts`, `sharedDeckSync.test.ts`, App + Web-Share-Sync-Ansichten, `sharedDeckSyncCopy.test.ts`. Additiv; selbst Gelöschtes und Lernstände bleiben geschützt. |
| Tote Bausteine | **E:** #715-Routen entfernt, README erklärt Entfernung. Keine weitere Tabellenlöschung. `inMemoryStore.ts` hat aktive Perf-/Testnutzer. |

Nicht „22 fertige Features“ melden: Kästchen enthalten Ablehnungen und Auslagerungen. Acht angenommene Ideen sind implementiert, 13 abgelehnt, eine ausgelagert, eine offen; native Abnahme der implementierten Ideen bleibt gesondert.

## #702 und offene PRs: Zuständigkeit anderer Chats

| Anforderung | Main / PR / Abschlussbedingung |
| --- | --- |
| Progress-Mengen | **E:** #721 + spätere cardIds-Grenze; `learn/progress/route.ts:42–63`: total ≤2000, results ≤total, cardIds ≤2000. `sessionProgressRoute.test.ts`. |
| Sieben Routen bremsen | **O/A:** #743 `bac3eb2a`, `newRouteRateLimits.test.ts`; Main-Routen noch ohne diese Guards. Aktuelles Main integrieren und neue Checks auf finalem Head. |
| Folder-Antwort cap | **O/A:** #742 `05024f25`, `folderCountsAndCards.test.ts`; Main `listCardsInFolder` liest noch alle Seiten. |
| Papierkorbzählung | **E:** Main `db.ts:2665–2707` nutzt gleichen Löschzeitstempel; `trashDb.test.ts`, #721. |
| Atomic Deck Restore | **O/A:** #744 `ae95fdcd`; Main Count+Restore getrennt. Migration `20260802010000_atomic_deck_restore.sql` nur im PR. DB-Anwendung und paralleler SQL-Test vor produktiver abhängiger API. |
| Nachgeholter Streak | **E:** Main `lpService.ts:460` `<` skip statt `!==`; `milestoneAwards.test.ts`, #721/#719. |
| Persistiertes LP-Guthaben | **O/A:** #740 `1abe0c01`; Main rechnet noch `result.newBalance + ...`; `lpEarnRouteMilestones.test.ts` im PR. |
| Ehrliche Progress-DB-Fehler / generische 500 | **O/A:** #739 `b49b22e8`, **MERGEABLE nach Aktualisierung**; Main `getSessionProgress` macht `if(error || !data) return null`, `http.ts` gibt Exceptiontext zurück. `sessionProgressDb.test.ts` / `http.test.ts`. Alter Konflikt gegen neuere cardIds-Auswahl im zuständigen Chat gelöst; neue Head-CI und Live-Abnahme ausstehend. |
| Card-Restore Count | **O/A:** #741 `2cd6f139`; Main lädt `listCardsForDeck().length`, PR verwendet Exact-Count; `trashService.test.ts`. |

Die acht ursprünglichen PR-Heads hatten CI-/Preview-Erfolg. Während des Audits aktualisierte der zuständige Chat #739 auf `b49b22e8` und #740 auf `1abe0c01`: beide jetzt MERGEABLE, Vercel-Previews erfolgreich, kein CI-Check dieser neuen Heads vorhanden; Workflow CI ist manuell deaktiviert. #736 `965e9d55` bleibt CONFLICTING; #737 `7ae9fb93` und #741–#744 waren MERGEABLE. Keine Review-Freigabe vorhanden. Die neuen PM-Zuordnungskommentare in #756/#702/#697/#700 wurden ebenfalls gelesen. Vor sequenzieller Übernahme auf aktuelles Main erneut prüfen; alte Heads beweisen keinen Pass nach Rebase.

#736 wurde durch die umfangreichere Main-Umsetzung #745 teilweise/weitgehend überholt; Vergleich von ursprünglichem PR-Diff und Main-Anforderungen ist nötig, bevor PM über Übernahme oder Schließen des PR entscheidet. Keine Änderungen durch diesen Audit an #756/#702/#697/#700 oder deren Worktrees.

## #703: jede Zeile des Sammel-Issues

Hier bedeutet **O** ein im Code noch erkennbarer Rest; ohne passende Reproduktion kein neu behaupteter Live-Bug. **E** benennt nur die konkret verifizierte Korrektur. Größere UI- und Produktänderungen bleiben eigene Arbeitspakete.

| Bereich / Einzelpunkt | Stand / konkrete Fundstelle |
| --- | --- |
| Editor offen: Tasten 1–4 / Cloze Enter | **O:** `learn-session.tsx:507–533` ohne Editor-Gate, `learn-keys.ts` schließt BUTTON bei Ratings nicht aus. Cloze globalen Enter-Handler mit Dialog testen. |
| Tastenkürzel nur Tooltip | **O:** Learn-Karte erklärt weiterhin Klicken; sichtbare Tastaturhilfe fehlt. |
| Home-Fällig-Pille Tastatur | **O:** `home/page.tsx:565–577` role/link + click, kein tabIndex/key handler. |
| Menüs nach Tab verlassen | **O:** `menu-keys.ts` behandelt Pfeile/Home/End/Escape, kein Tab-/Focus-out-Schließen. |
| Verwerfen Fokusfalle | **O:** `card-editor.tsx:134–175` eigener alertdialog ohne eigene Trap; äußerer Modal umfasst Editor + Nachfrage. |
| Lernkarte Button mit Kind-Buttons | **O:** `learn-session.tsx:832` role/button, Stern/Stift/Lautsprecher darin. Semantik und Tastatur als ein Paket. |
| „Alle 1 lernen“ | **E:** #725, `folderLearnAllCopy.test.ts`, echte Einzahlform. |
| Tagesziel Einheit | **E:** #723; `daily-goal-line.ts` / `dailyGoalLine.ts` sagen Karten; beide Tests grün. |
| Leeres Deck / Füllstand bei niedrigem Anteil | **E/O:** Leeres Deck korrekt `Noch keine Karten`; `deck-count-label.ts` / `deckCountLabel.ts` + Tests. Anzeige „3 von 2.000“ weiterhin bewusst technisch vorhanden; relative Füllstandsanzeige separat klären, nicht als mitgefixt behaupten. |
| „— voll“ nur App | **E:** Web und App Deck-Kopf nutzen voll-Text seit #653, #723 dokumentiert bereits widerlegten Befund. Keine neue Warnfarben-Reparatur ableiten. |
| Suche N Treffer bei Cap 20 | **O:** `db.ts:806–826` default limit20 ohne order; keine Total-/hasMore-Angabe. API und UI zusammen lösen. |
| Zwei Setup-Kartenzahlen | **O:** Source-Picker und Fragenanzahl auf gefiltertem/vollen Vorrat; eindeutige Einheiten/Anwendbarkeit in quiz/test testen. |
| Support Entwicklersprache | **O:** `support/page.tsx:12,37` App Store/„reproduzierbare Bugs“. Enger Copy-PR. |
| App-Lern-Leertext Flashcards | **O:** `resources.ts:38`, „Scanne einen Text, um Flashcards zu generieren.“ de/en vereinfachen. |
| Ordner offline zeigt leer | **O:** `library-folder/[id].tsx:120` stiller catch; Due-Fehler setzt null, `handleLearnDue:434` antwortet NoDue. Leerzustand von Fehler trennen. |
| 0 fällig Alert / alle-Karten-Ausweg | **E/O:** Zweiter Alle-Karten-Knopf ist auf Main vorhanden (`:446,:597`); der 0-fällig-Knopf führt weiterhin Alert statt umgeleiteter Handlung. Nicht den zweiten Knopf neu bauen. |
| Ordner verliert Deck/Sprache | **O:** `startPreset` bei Due/All mappt nur id/front/back/starred (`:439,:461`), lässt deckId weg; Learn-Sprache braucht current.deckId (`learn.tsx:957`). |
| Große Ordner ohne Nachfrage/Resume | **O:** `handleLearnAllCards` startet direkt; kein Folder-Resume, API-Cap noch PR #742. Mengenlimit ist kein Tagespensum. |
| Ordner mischt Decks | **E/O:** API `db.ts:1754–1760` gruppiert All-Ordnerkarten bereits stabil nach Deckrang. Due-Preset folgt globaler Due-Sortierung und wird nicht `groupCardsByDeck` unterzogen. Nur Due-Rest als Gruppierarbeit behalten. |
| Unterordner zählen, Lernen nicht | **O:** Kopf `buildFolderCountLabel(subfolders.length,...)`, Karten-/Due-Anfragen nur direkte Decks. Semantik „direkter Ordner“/rekursiv vor Implementierung explizit festhalten. |
| Meilenstein-LP noch nicht angezeigt | **O:** Home setzt LP bei load; `milestones.ts`-Event/`milestone-notice.tsx` aktualisiert sichtbare Seitenbalance nicht. Nicht mit API-Antwortproblem #740 vermischen. |
| 5 Stufen immer 6s | **O:** `milestone-notice.tsx` `AUTO_HIDE_MS=6000` für alle; App `MilestoneHost` abweichend. |
| Bonus-Historie | **O:** kein entsprechender UI-Ort; bestehende Claims/Datenquelle vor neuer API wiederverwenden. |
| „Fast“ nicht Prüfung | **O:** Cloze nearMiss, Test nur richtig/falsch. |
| „Fast“ manueller Dark Mode | **O:** `globals.css:2829` near nur OS-Media, explizit dark Regeln nur ok/no (`:2833–2838`). Browser-Kontrastfall zuerst reproduzieren. |
| Screenreader „Falsch“ bei „Fast“ | **O:** Cloze `page.tsx:857` live-Text hängt nur an wasCorrect, sichtbarer nearMiss-Zweig daneben. |
| Großschreibungsrat einseitig | **O:** Cloze `page.tsx:876` immer „achte auf die Großschreibung“. Neutraler Fallhinweis statt immer groß. |
| Setup gerätelokal | **O:** `setup-memory.ts` localStorage, `setupMemory.ts` AsyncStorage; kein Konto-Setup-Weg. Größeres Paket, getrennt von Resume. |
| Web-Setup ohne Richtungswahl | **E:** #724; `deck/[id]/learn/page.tsx` reverse Auswahl + Restore. Nicht erneut bauen. |
| Kein „zuletzt“ / Standardreset | **O:** `StoredSetup` ohne Zeitpunkt; kein UI-Reset. |
| Tote i18n-Liste | **E/O:** Teile durch #715 entfernt; `deckDetails.card`, `lp.notEnough`, alte `paywall.*` noch definiert; andere `lp.purchase*` und referral-Schlüssel werden aktiv verwendet. Keine Liste blind löschen; dynamische t-Aufrufe prüfen. |
| „Ungenutzte“ Exporte | **E/O:** `PRESET_OWNER` intern aktiv; `StudyResultAction` aktive Prop-Type; `completeOAuthSignIn` intern aufgerufen; `MIN_REGION_SIZE` aktive Regionsvalidierung. `evaluateAnswer` domain/web in Tests verwendet. claimReferralCode/removeFriend/triggerPaywall/hasScheduledReminder/siteNavLinks haben weiterhin Kandidatenstatus; Nutzungsprüfung vor Entfernung. |
| Practice Cloze/Formel | **E/O:** Inline `formatCloze` noch vorhanden (`practice.tsx:214`); gewusst-/Fehlerformel nutzt inzwischen `missedCardsFrom` (`:60`), keine zweite identische Formel behaupten. |
| LP-Cap-Satz fünfmal Web | **O:** Learn, Cloze, Match, Quiz, Occlusion besitzen denselben hartkodierten Satz. Gemeinsame Utility + vorhandene Copy-Wache als Vorbild. |
| Fortschrittsformeln | **O:** learn/cloze `index + revealed`, quiz `idx+1`, test eigene Formel; Kanon je Modus explizit bewahren, erst dann Refactor. |
| 120/500 Zahlen | **O:** `dashboard/page.tsx:1279`, `folder-ui.tsx:199`, `folder/[id]/page.tsx:651` hardcoded; Mobile `titleLimit.ts` bereits zentral. |
| README /cards/search | **E:** README API-Baum Zeile 600 seit #725/#723 vorhanden. |
| Irreführende Kommentare | **E/O:** `StudyResult` durch #718 korrigiert, bekannte Timingwarnung in learn/cloze vorhanden; Mobile-Test behauptet weiterhin reviewsToday aktuell (`test.tsx:183`). Nur verbleibende Aussagen korrigieren. |
| Tagesziel letzte Karte | **O:** `learn-session.tsx:373` lädt Stats parallel zu `flushReview`/Award; cloze/mobile ähnliche Effekte. Deferred letzte Review reproduzieren, anschließend Stats erst nach bestätigter Zustellung lesen; Netzfehler ehrlich behandeln. |

## #597/#735: gemeinsame Geräteabnahme statt neue Juli-Tests

Für jede Zeile: **installierter Build + Quellcommit (wenn zuordenbar), Gerät/iOS, Datum, erwartetes und beobachtetes Ergebnis**. Öffentliche Versionsnummer 1.0 ist dafür unzureichend. Einen vorhandenen geeigneten Kandidaten verwenden; nur nach ausdrücklichem Test-/Kostenauftrag einen gemeinsamen neuen Build.

| Prüffamilie | Abdeckung / fehlender Nachweis |
| --- | --- |
| Vorlese-Lösung verborgen (#540) | Code/Cloze-Speech-Tests vorhanden; echte Lückenkarte, Front Pause ohne Antwort / Back Antwort, jeweils Knopf UND Autoplay am physischen iPhone weiterhin offen. |
| Decksprache (#593) | `speechLanguages.ts`, Deck-Details, Learn current.deckId; Front Französisch / Back Deutsch speichern, neu öffnen und hörend abnehmen in Web UND App. Ordner-Preset verliert deckId (#703), dafür eigener negativer Fall. |
| Scan-Ziehen (#464) | PanResponder/Griff in Scan vorhanden; Griff + gleichzeitiges Scrollen nur reale Geräteabnahme. |
| Scan-Editor/Entwurf (#457/#462/#453) | `scanDraft`, Vorschaueditieren/Add/Discard und Save-once-Tests; ein Deck, Änderungen gespeichert, Neustart fragt nach. Persistenz und Touchflow am Kandidaten offen. |
| Prüfung/Quiz Abbruch (#479/#566) | Unterbrechungscode/Tests vorhanden; native Wischgeste, beantwortete Ergebnisse erhalten, kein unbeabsichtigter Prüfungsdatensatz offen. |
| Ergebnis/Kanon (#565/#592/#596/#579/#478/#482/#486/#699) | Schwer nicht gewusst, keine Cloze-Lösungsverrattexte, Name/Grenze, Hauptpokal grün lokal implementiert. Physisch in betroffenen Modi prüfen, #699 Nachüben-Reste nicht als fertig abhaken. |
| Bibliothek/Profil (#717/#614) | Long-press sieben Aktionen, Unterordner, leeres Deck, Resetmail, Papierkorb/Bulk/Archiv/Sortierung im Code; Touch/Fehlerfälle auf Gerät offen. Mail erst als expliziter Test, kein tatsächlicher Versand im Audit. |
| Statistik (#489/#494/#585/#487/#488) | Genauigkeit nach Art/Prüfungsdaten vorhanden; Laden, abgegebene X/Y, Abbruch ohne Zeile am Kandidaten offen. KPI-Kacheln #734 weiterhin Entwicklung. |
| Streak/Onboarding (#506/#543) | Begrenzung Kalender/Account-Onboarding im Code und Tests; Neuinstallation mit bestehendem Konto und Kalendergrenzen physisch offen. |
| LP-Quellen (#659/#738) | `scanSourceAction.test.ts`, Vorab-Leistbarkeitsgates; neueres #738 erst ab passendem Binary. #733 Kostenbestätigung zusätzlich offen. |
| Resume (#670/#697/#576) | Main mit Originalreihenfolge/Ergebnissen/Background-Queue; frische lokale Browserprüfung separat protokollieren. Physische Unterbrechung → Web/anderes Gerät, schlechte Verbindung, Ergebnis-/Review-/LP-Readback offen. |
| Nachträglicher Scan-Lifecycle | #754 dokumentiert lokales Simulator-Backend; nach Speichern/Lernen/Löschen Quellenansicht frisch, ungespeicherter Entwurf erhalten. Nur nachweislich passender physischer Build zählt als Geräteabnahme. |

## Nächste klar abgegrenzte Pakete

1. **Andere Chats abschließen:** #756 Budget/Inflight-Claims; #702 offene #739–#744 auf Main rebasen, reproduzierende Tests/SQL-Probe und Migration vor API; #697 alten #736 gegen #745 prüfen, reale Cross-device-Abnahme; #700 #737 vollständig und nativ abnehmen. Keine parallelen Änderungen desselben Audits an diesen Dateien.
2. **Unmittelbare Defekte:** #734.1 stummer Prüfungsstart; #703 Editor-/Tastatur-/Dialogsemantik; #703 letzte Review vs. Tagesziel; Ordnerfehler/fehlende deckId. Für jeden Bug zuerst roter reproduzierender Test, dann Fix und derselbe Test grün. Kleine PRs, keine neuen Funktionen nebenbei.
3. **#699 + #734.2:** Nachüben beider Modi in einem Paket; Ergebnisrahmen-Refactor danach getrennt. Hauptpokal nur noch abnehmen, nicht doppelt implementieren.
4. **#733:** vier Scan-Reste in einem abgegrenzten Scan-Paket, abgestimmt mit #756; Tests mit Fake-API, kein Gemini. Vorab Bytegrenze, LP-Bestätigung mit Live-Kosten, editierbarer Titel und Schutz letzter Vorschaukarte. Ein gebündelter Gerätebuild am Ende.
5. **#729 + #703 Copy:** Copy-Entwurf de/en festhalten und autonom umsetzen; vorhandene Domain-/Store-/Tariffakten bewahren. #84 Lifetime-/Earn-Konzept konsolidieren ohne Preise/LP-Werte neu festzulegen.
6. **#730:** zunächst Web-Bildrendering; dann Bild-Fragen als separates Paket. **#731** eigene vorhandene-Occlusion-Bilder-Verwaltung mit additiven/erhaltenden Editregeln und Grenztests.
7. **Echte Entscheidungen einmal gebündelt:** #368 Anbieter/Verkäufer-/Steuermodell und Mehrfachabo; #732 verlässliche Preise vs. App-Link; #614 Versanddienst/Absender/Kosten; #165 gewünschte Ads-Aktivierung/Buildkosten; #756 Geldbudget beim zuständigen Chat. Keine erneute allgemeine Planfreigabe erforderlich.
8. **Abnahmeabschluss:** #85 CI/E2E-Live-Workflows wieder aktivieren, anschließend echte kostenfreie Live-E2E nach Credentials; #597/#735 gemeinsame aktuelle Geräteprotokolle. Erst vollständig bewiesene Teilanforderungen übernehmen, Sammel-Issues mit Restpunkten offen lassen.

Keines der 21 Issues ist durch diesen Abgleich pauschal schließbar. Das Ergebnis ist die Zuordnung vorhandener Umsetzung, fehlender realer Nachweise und enger nächster Pakete.
