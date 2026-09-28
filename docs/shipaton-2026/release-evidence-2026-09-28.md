# Release-Nachweis — 28. September 2026

Diese Zusammenstellung hält die vom koordinierenden Release-Task beobachteten Dashboard-, CLI- und Readback-Ergebnisse fest. Die Dokumentationsaufgabe hat diese externen Aktionen nicht erneut ausgeführt. Keine Passwörter, Tokens, Kontonummern oder anderen Zugangsdaten werden hier gespeichert.

## Aktueller Stand: Build 7 und nativer Mac-Retest

- EAS Build `09a8f26a-2037-4d8d-85c5-f3f1704c9d75`: FINISHED am 28. September um 17:01:30.246 UTC, Version 1.0 (7), Quelle `2fb6e7dcac4eee1846a86bd34c9020f4fa9482fb`. Submission `799401f9-5dff-4a70-94f2-1e8c03961eb6`: FINISHED / Succeeded.
- Apple-Build `f4502d83-b780-4e08-889e-3d0634465ae4`: VALID; Store-Version 1.0 hat **Build 7** ausgewählt. Die interne Gruppe `clearn Release QA` enthält 7, Status IN_BETA_TESTING. App- und alle drei IAP-Review-Notes nennen 7; vorhandene Review-Zugangsdaten und Kontakte bleiben unverändert.
- Tatsächliches signiertes IPA geprüft: Bundle `app.clearn`, Gerätefamilie `[1]`, keine ATT-Usage-Description, 15 Privacy-Manifeste, kein `NSPrivacyTracking=true` und keine gefundenen Ads-SDK-Artefakte.
- Mac-TestFlight-Update installiert; das tatsächlich laufende Bundle per Info.plist als `app.clearn` 1.0/7 bestätigt. Bestehender Login blieb erhalten. Nach frischer Gemini-Zustimmung erzeugte ein synthetischer 160-Zeichen-Mitochondrien-Text fünf Karten; das Ergebnis erschien **unmittelbar ohne Rücknavigation**. Der Text-Ergebnisansicht-Fix ist damit nativ bestanden. Alle fünf Karten wurden in einem neuen eigenen Deck gespeichert.
- Unabhängiger eigener API-Readback um 17:17:07 UTC: `/decks` und `/usage` HTTP 200, drei Decks mit 5/7/8 Karten, Free-Tier mit 11 LP (21 minus 10). Keine neue Lernrunde auf Build 7 geprüft; der frühere Lernlauf 7/7 gehört ausschließlich zu Build 6. URL-Import bleibt nur durch Codeprüfung/Regressionstest bestätigt, nicht nativ.
- Echte RevenueCat-Preise dieser Build-7-Sitzung: EUR 39.99 jährlich, EUR 4.99 monatlich, EUR 89.99 Lifetime. Apple-Sandbox-Monatskaufblatt zeigte keine Gebühren und eine Woche Probezeit; weder clearn noch App Store bot einen Bestätigungsbutton. Abgebrochen: **kein Kauf, keine bezahlte Freischaltung und kein Paid-Restore**. Restore meldete korrekt kein aktives Abo.
- Apple-Validierung meldet weiterhin die drei Sperren Inhaltsrechte, DAC7 und nicht veröffentlichter App-Datenschutz. Alle drei IAPs bleiben MISSING_METADATA; ihre Review-Screenshots fehlen. Physische iPhone-Abnahme, echte Käufe/Restore, öffentliche US-Store-Verfügbarkeit, finale Demo und Devpost-Einreichung bleiben offen.

Main-CI `36454274532` für `2fb6e7d` ist SUCCESS. Vercel: `cloudlearn` neu READY (`dpl_H9XWQw1LUF6NutUhZfkKXQgRy2Wr`); API/Web „Skipped - Not affected“. Ihre unabhängig geprüften öffentlichen Aliase zeigen weiterhin READY aus `77341955`: API `dpl_9nP49t3AUsHw9twBVbbAueFbh6nN`, Web `dpl_oxaVYCFjyQTvGVP2fJoYME4Sr3iR`. Keine drei neuen Deployments für `2fb6e7d` behauptet.

## Historische Nachweise vor dem abgeschlossenen Build-7-Retest

Die folgenden Abschnitte bewahren die früheren Readbacks. Angaben wie ausgewählter Build 6, Review Notes für 6 oder laufender Build 7 gelten nur für ihren damaligen Prüfzeitpunkt; aktuell ist der Stand oben.

## Code und Produktion

- [PR #748](https://github.com/ostheimer/cloudlearn/pull/748): gemergt als `e4678f2bebc78d66b8814210a34c3533eb4aef3c` auf `main`; enthält die Korrekturen für ATT, ausdrückliche Gemini-Einwilligung und verfügbare OAuth-Anbieter.
- [Main-CI-Lauf 36447463638](https://github.com/ostheimer/cloudlearn/actions/runs/36447463638): erfolgreich, Exit 0.
- Alle drei Vercel-Produktionsziele READY für exakt `e4678f2`: `clearn-api` → `dpl_6YJNksn6nBeL5ovk6Fv1PqSBCD1J`, `clearn-web` → `dpl_DSPDpuVZWaPZ7PqprNWjv7aLzoSK`, `cloudlearn` → `dpl_CXuAk4FscJYDUpQVTRJ3tgPiYnYE`.
- Anonyme Privacy-/Terms-Aufrufe: HTTP 200. Datenschutztexte berücksichtigen Supabase Storage, Google Gemini und Expo.
- Vorheriger Stand: [PR #747](https://github.com/ostheimer/cloudlearn/pull/747), `53bb91fbe616ce1d4cfa4e8cd53b523db42b8386`, [CI 36423622892](https://github.com/ostheimer/cloudlearn/actions/runs/36423622892) und die damaligen drei Deployments grün/Ready.
- Die bereits dokumentierte additive Migration `20260927222222_session_progress_card_ids.sql` ergänzt `session_progress.card_ids` als nullable `uuid[]`. Vorher wurde das physische Backup vom 27. September, 01:58 UTC, geprüft.

## RevenueCat-Webhook

- Integration: `whintgr91e6712719`, Production und Sandbox.
- Ziel: `https://clearn-api.vercel.app/api/v1/subscription/webhook`.
- Echtes Dashboard-TEST-Ereignis `083FB140-184C-4A3B-A3EF-E1D3F20C83A9`: HTTP 200 am 28. September 2026, 14:41 UTC.
- Anfrage ohne Authorization: HTTP 401.
- TEST wird nach Authentifizierung als No-op quittiert. Dieser Nachweis bestätigt Zustellung und Authentifizierung, nicht Kauf, Entitlement, LP-Gutschrift oder Restore.

## Signierung, Build und Apple-Verarbeitung — aktueller Build 6

| Nachweis | Identität / Ergebnis |
| --- | --- |
| App-Store-Profil | `TD57XCQPUN`, UUID `f41008c2-a3c5-4e93-aabf-983253e7122f`, gültig |
| Bestehendes Zertifikat | `2B6L442N8X` |
| EAS Production / STORE | `d5373593-67d9-4124-94b3-b8e028952e36`, FINISHED |
| Abschluss | `2026-09-28T16:05:27.638Z` |
| Quellstand | `e4678f2bebc78d66b8814210a34c3533eb4aef3c` |
| Version / Build | 1.0 / 6 |
| EAS Apple-Upload | `7a2eed76-062c-436b-8471-1536f2730e90`, FINISHED, Fehler `null` |
| Apple-Buildressource | `da0e23d9-fd7a-4940-a0ae-fca7dafbe88b`, VALID |
| Apple-Uploadzeit | `2026-09-28T09:10:01-07:00` |
| Interne Testgruppe | `clearn Release QA`, `5cdc996b-439d-420c-a4be-5cc2bb3af21a` |
| Gruppenbelegung | Build 6 und 5; zuvor ein Tester / Andreas eingeladen |
| Build-6-Teststatus | IN_BETA_TESTING; Mac-Testing bereits aktiviert |

Das tatsächlich heruntergeladene signierte IPA von Build 6 wurde geprüft: **21.631.739 Bytes**, Bundle-ID `app.clearn`, `UIDeviceFamily=[1]`, keine `NSUserTrackingUsageDescription`, **0** gefundene Ads-SDK-Artefakte, **15** PrivacyInfo-Manifeste und **0** Einträge mit `NSPrivacyTracking=true`. Diese Artefaktprüfung ist kein Nachweis eines ausgeführten Geräteflows oder einer veröffentlichten ASC-Datenschutzerklärung.

Historischer Build 5: EAS `41320cc2-dc75-45c8-a804-c903fcb6aae9`, Quelle `53bb91f`, 1.0/5, FINISHED; Upload `f64d989d-14da-4dcd-bd07-f7998c6106f5` FINISHED; Apple-Build `ea6d20ef-4ea6-4e4b-83eb-197303c258a0` testbereit. Er bleibt in der Testgruppe, ist aber nicht mehr der ausgewählte Store-Kandidat.

Einladung und Build-Verfügbarkeit sind kein Nachweis einer Installation oder bestandenen Geräteabnahme.

## Store und Review-Zugang

- Unabhängiger offizieller Apple-API-Readback: Store-Version 1.0 (`70003176-ff35-4560-bc5e-9ea855a8fc32`) hat Build 6 statt Build 5 ausgewählt und steht auf PREPARE_FOR_SUBMISSION.
- Copyright: `2026 Andreas Ostheimer` gespeichert.
- Ein Home-Screenshot in 1242 × 2688 hochgeladen; Galerie 1/10. Weitere Screens und separate IAP-Review-Screenshots bleiben offen.
- Synthetisches Review-Konto: normaler Supabase-Signup, dabei bereits bestätigter Kontostatus und gültige Sitzung; danach unabhängiger Passwortlogin und API-Lesezugriff erfolgreich geprüft. Eigenes Biologie-Deck mit acht Karten vorhanden. Eine separate Bestätigungsmail oder ihre Zustellung wurde nicht nachgewiesen.
- Zugangsdaten über die offizielle EAS-Metadaten-CLI in die geschützten ASC-Review-Felder eingetragen; Readback-Vergleich erfolgreich. Kein Passwort und keine Review-E-Mail in dieser Nachweisdatei.
- Englische Review Notes sind ausdrücklich auf Build 6 aktualisiert. Readback bestätigt gespeicherte Notes sowie unveränderte Review-Zugangsdaten und Kontaktfelder, ohne deren Werte zu dokumentieren.
- Noch kein Nachweis des Review-Logins auf dem signierten physischen Testgerät.

### IAP-Review-Metadaten

Die Review Notes aller drei Produkte wurden gespeichert und zurückgelesen. Fehlende Screenshots bleiben ein konkretes Einreichungshindernis:

| Produkt | Apple-ID | Status | Review-Screenshot-ID |
| --- | --- | --- | --- |
| `ai.clearn.pro.monthly` | `6814941043` | MISSING_METADATA | `null` |
| `ai.clearn.pro.annual` | `6814941049` | MISSING_METADATA | `null` |
| `ai.clearn.lifetime` | `6814941014` | MISSING_METADATA | `null` |

## Datenschutz und noch ausstehende Abnahme

Zehn Datenschutz-Datentypen sind im ASC-Entwurf vollständig als linked / no tracking konfiguriert, aber **nicht veröffentlicht**. Der frühere ATT-Artefaktblocker von Build 5 ist im tatsächlich geprüften Build 6 behoben. Daraus folgt weder eine veröffentlichte Datenschutzerklärung in ASC noch eine Review-Freigabe.

Offen bleiben die tatsächlichen Inhaltsrechte- und kontoweiten DAC7-Angaben, drei native IAP-Review-Screenshots und übriges Store-Material, alle drei echten nativen IAP-Käufe, Restore und serverseitige Freischaltung sowie physische Geräteabnahme. Apple Review, öffentliche App-Store-Veröffentlichung einschließlich US-Nutzung, Devpost-Einreichung und finales Demo-Video sind nicht abgeschlossen. Weder TEST 200 noch ein fertiges IPA schließen diese Punkte.

Die Kennungen und Ergebnisse stammen aus dem finalen Readback des koordinierenden Release-Tasks. Die Dokumentationsprüfung hat zusätzlich dessen vier bereinigte Nachweisdateien zu IPA, Apple-Build-Auswahl, Review Notes und IAP-Review Notes gelesen. IPA, temporäre Dateien, Passwörter und private Review-Kontaktdaten werden nicht ins Repository übernommen.

## Fortschreibung: native Mac-QA, Scan-Fix und Apple-Sperren

Offizielles TestFlight auf dem Mac installiert, eigene Einladung eingelöst, clearn 1.0 (6) installiert und gestartet; Bundle-Plist bestätigt Build 6 aus `e4678f2`. Dies ist eine native Mac-Ausführung, kein Simulator und keine physische iPhone-Abnahme.

- Review-Passwortlogin erfolgreich; eigenes Fotosynthese-Deck mit acht Karten sichtbar, zunächst 20 LP / Free.
- Alle drei realen RevenueCat-Produkte geladen: Jahresabo USD 34.99, Monatsabo USD 3.99, Lifetime USD 79.99. Das native Apple-Monatsabo-Kaufblatt zeigte EUR 4.99 und eine Woche Probezeit sowie Testzwecke ohne Gebühren. Nur abgebrochen, keine Kaufbestätigung und keine Freischaltung. Preisangaben beschreiben diese Sitzung, keine allgemeine Storefront-Zusage.
- Restore meldete „Nichts gefunden“ / kein aktives Abo. Kein Nachweis eines Restore nach abgeschlossenem Kauf.
- Texteingabe zu Mitochondrien: frische Google-Gemini-Zustimmung abgebrochen, Editor blieb; erneut frisch bestätigt, sieben echte Karten generiert. Wegen des Ergebnisansicht-Fehlers war manuelle Rücknavigation nötig. Neues Deck mit sieben Karten gespeichert, alle sieben umgedreht und mit „Gut“ gelernt, Abschluss 7/7.
- Unabhängiger autorisierter API-Readback um 16:53 UTC: HTTP 200, zwei eigene Decks (acht Fotosynthese- und sieben Mitochondrien-Karten), LP-Balance 21 / Free; neues Deck zuletzt um 16:51:10.369 UTC gelernt und keine seiner Karten mehr fällig.

**Präzise Fehler-Evidenz:** Text wurde nativ in Build 6 reproduziert; URL wurde durch Codeprüfung und Regressionstest bestätigt, nicht durch einen tatsächlichen URL-Import in dieser Sitzung. [PR #750](https://github.com/ostheimer/cloudlearn/pull/750), 37 fokussierte Tests, Mobile-Typecheck/Lint und PR-CI grün, ist als `2fb6e7dcac4eee1846a86bd34c9020f4fa9482fb` gemergt. [Main-CI 36454274532](https://github.com/ostheimer/cloudlearn/actions/runs/36454274532) ist SUCCESS. EAS Build 7 `09a8f26a-2037-4d8d-85c5-f3f1704c9d75` ist IN_PROGRESS aus exakt diesem Merge-Commit; kein fertiges IPA, Apple-Ergebnis oder nativer Build-7-Pass behauptet.

Der zwischenzeitliche reine Dokumentations-Merge `77341955ba3f660b599a322db748de7e9b44e259` hat erfolgreiche Main-CI `36451454255` und drei READY-Produktionsdeployments desselben Commits. Er änderte kein App-Binary. Für `2fb6e7d` ist der Vercel-Commitstatus insgesamt SUCCESS: `cloudlearn` Production READY (`dpl_H9XWQw1LUF6NutUhZfkKXQgRy2Wr`), API/Web jeweils „Skipped - Not affected“. Unabhängiger Alias-Readback bestätigt die weiterhin erreichbaren READY-Deployments aus `77341955`: API `dpl_9nP49t3AUsHw9twBVbbAueFbh6nN`, Web `dpl_oxaVYCFjyQTvGVP2fJoYME4Sr3iR`. Dies sind keine drei neuen READY-Deployments für `2fb6e7d`.

**Tatsächliche Apple-Validierung:** „Zur Prüfung hinzufügen“ meldete genau drei Sperren: Inhaltsrechte, DAC7 und noch nicht veröffentlichter App-Datenschutz. Zusätzlich bleiben alle drei IAPs trotz gespeicherter Build-6-Review-Notes auf MISSING_METADATA. Der echte Mac-Paywall-Screenshot (576 × 1090, drei Produkte und Terms/Privacy/Restore sichtbar) wurde wegen falscher Maße abgelehnt; kein Review-Screenshot hinterlegt. Keine öffentliche Veröffentlichung und kein abgeschlossener nativer Kauf belegt.

## Screenshot-Provenienz

Die zwei [lokalen Production-Home-Aufnahmen](../screens/app-store/raw/de-DE/local-production-53bb91f/README.md) stammen aus Quellstand `53bb91f` mit lokaler Buildnummer 1. Sie sind keine Aufnahmen aus dem Store-IPA von Build 5 oder 6. Der dort dokumentierte lokale Swift-/Deployment-Target-Kompatibilitätsweg und die Simulator-Signatur bleiben Teil der Provenienz. Eine Aufnahme mit blockierendem Systemdialog wurde bewusst nicht in dieses Paket übernommen.
