# Release-Nachweis — 28. September 2026

Diese Zusammenstellung hält die vom koordinierenden Release-Task beobachteten Dashboard-, CLI- und Readback-Ergebnisse fest. Die Dokumentationsaufgabe hat diese externen Aktionen nicht erneut ausgeführt. Keine Passwörter, Tokens, Kontonummern oder anderen Zugangsdaten werden hier gespeichert.

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

## Screenshot-Provenienz

Die zwei [lokalen Production-Home-Aufnahmen](../screens/app-store/raw/de-DE/local-production-53bb91f/README.md) stammen aus Quellstand `53bb91f` mit lokaler Buildnummer 1. Sie sind keine Aufnahmen aus dem Store-IPA von Build 5 oder 6. Der dort dokumentierte lokale Swift-/Deployment-Target-Kompatibilitätsweg und die Simulator-Signatur bleiben Teil der Provenienz. Eine Aufnahme mit blockierendem Systemdialog wurde bewusst nicht in dieses Paket übernommen.
