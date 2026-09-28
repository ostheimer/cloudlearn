# Release-Nachweis — 28. September 2026

Diese Zusammenstellung hält die vom koordinierenden Release-Task beobachteten Dashboard-, CLI- und Readback-Ergebnisse fest. Die Dokumentationsaufgabe hat diese externen Aktionen nicht erneut ausgeführt. Keine Passwörter, Tokens, Kontonummern oder anderen Zugangsdaten werden hier gespeichert.

## Code und Produktion

- [PR #747](https://github.com/ostheimer/cloudlearn/pull/747): gemergt als `53bb91fbe616ce1d4cfa4e8cd53b523db42b8386` auf `main`.
- [CI-Lauf 36423622892](https://github.com/ostheimer/cloudlearn/actions/runs/36423622892): grün.
- Vercel `clearn-api`, `clearn-web` und `cloudlearn`: Ready, jeweils exakt derselbe Commit.
- Die bereits dokumentierte additive Migration `20260927222222_session_progress_card_ids.sql` ergänzt `session_progress.card_ids` als nullable `uuid[]`. Vorher wurde das physische Backup vom 27. September, 01:58 UTC, geprüft.

## RevenueCat-Webhook

- Integration: `whintgr91e6712719`, Production und Sandbox.
- Ziel: `https://clearn-api.vercel.app/api/v1/subscription/webhook`.
- Echtes Dashboard-TEST-Ereignis `083FB140-184C-4A3B-A3EF-E1D3F20C83A9`: HTTP 200 am 28. September 2026, 14:41 UTC.
- Anfrage ohne Authorization: HTTP 401.
- TEST wird nach Authentifizierung als No-op quittiert. Dieser Nachweis bestätigt Zustellung und Authentifizierung, nicht Kauf, Entitlement, LP-Gutschrift oder Restore.

## Signierung, Build und Apple-Verarbeitung

| Nachweis | Identität / Ergebnis |
| --- | --- |
| App-Store-Profil | `TD57XCQPUN`, UUID `f41008c2-a3c5-4e93-aabf-983253e7122f`, gültig |
| Bestehendes Zertifikat | `2B6L442N8X` |
| EAS Production / STORE | `41320cc2-dc75-45c8-a804-c903fcb6aae9`, FINISHED |
| Quellstand | `53bb91fbe616ce1d4cfa4e8cd53b523db42b8386` |
| Version / Build | 1.0 / 5 |
| EAS Apple-Upload | `f64d989d-14da-4dcd-bd07-f7998c6106f5`, FINISHED |
| Apple-Buildressource | `ea6d20ef-4ea6-4e4b-83eb-197303c258a0`, testbereit |
| Interne Testgruppe | `clearn Release QA`, `5cdc996b-439d-420c-a4be-5cc2bb3af21a` |
| Gruppenbelegung | Build 5, ein Tester; Andreas eingeladen |

Einladung und Build-Verfügbarkeit sind kein Nachweis einer Installation oder bestandenen Geräteabnahme.

## Store und Review-Zugang

- Store-Version 1.0: Build 5 ausgewählt.
- Copyright: `2026 Andreas Ostheimer` gespeichert.
- Ein Home-Screenshot in 1242 × 2688 hochgeladen; Galerie 1/10. Weitere Screens und separate IAP-Review-Screenshots bleiben offen.
- Synthetisches Review-Konto: normaler Supabase-Signup, dabei bereits bestätigter Kontostatus und gültige Sitzung; danach unabhängiger Passwortlogin und API-Lesezugriff erfolgreich geprüft. Eigenes Biologie-Deck mit acht Karten vorhanden. Eine separate Bestätigungsmail oder ihre Zustellung wurde nicht nachgewiesen.
- Zugangsdaten über die offizielle EAS-Metadaten-CLI in die geschützten ASC-Review-Felder eingetragen; Readback-Vergleich erfolgreich. Kein Passwort und keine Review-E-Mail in dieser Nachweisdatei.
- Noch kein Nachweis des Review-Logins auf dem signierten physischen Testgerät.

## Datenschutz-Blocker und noch ausstehende Abnahme

Zehn Datenschutz-Datentypen sind im ASC-Entwurf vollständig als linked / no tracking konfiguriert. Die Veröffentlichung ist wegen `NSUserTrackingUsageDescription` in Build 5 blockiert. Der ATT-Codefix und der Production-Prebuild sind im aktuellen Release-Branch lokal geprüft; die Web-Datenschutzhinweise sind an die tatsächlichen Datenflüsse angepasst. Ein korrigierter zweiter Store-Build ist noch nicht nachgewiesen; nach dessen Upload müssen tatsächliche Privacy-Inhalte und Build-Auswahl erneut geprüft werden.

Offen bleiben alle drei echten nativen IAP-Käufe, Restore und serverseitige Freischaltung, Geräteabnahme, vollständiges Store-/IAP-Review-Material, finale Inhaltsrechteerklärung, öffentliche App-Store-Veröffentlichung einschließlich US-Nutzung, Devpost-Einreichung und finales Demo-Video. Weder TEST 200 noch ein fertiges IPA schließen diese Punkte.

## Screenshot-Provenienz

Die zwei [lokalen Production-Home-Aufnahmen](../screens/app-store/raw/de-DE/local-production-53bb91f/README.md) stammen aus Quellstand `53bb91f` mit lokaler Buildnummer 1. Sie sind keine Aufnahmen aus dem Store-IPA von Build 5. Der dort dokumentierte lokale Swift-/Deployment-Target-Kompatibilitätsweg und die Simulator-Signatur bleiben Teil der Provenienz. Eine Aufnahme mit blockierendem Systemdialog wurde bewusst nicht in dieses Paket übernommen.
