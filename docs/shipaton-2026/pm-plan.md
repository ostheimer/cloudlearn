# Shipaton 2026 – PM-Plan

Stand: 28. September 2026. Release-Vorbereitung läuft; eine öffentliche App-Store-Veröffentlichung und die finale Devpost-Einreichung sind noch nicht nachgewiesen.

Maßgeblich sind der [Release-Nachweis vom 28. September](release-evidence-2026-09-28.md) und die [offenen Release-Gates](release-readiness.md). Build 7 (`09a8f26a-2037-4d8d-85c5-f3f1704c9d75`, Quelle `2fb6e7dcac4eee1846a86bd34c9020f4fa9482fb`) und Apple-Upload sind FINISHED, Apple VALID; Store-Version und Review Notes sind auf 7 aktualisiert. Das tatsächliche IPA ist ohne ATT-Usage-Description oder gefundene Ads-SDK-Artefakte geprüft. Main-CI ist grün; cloudlearn wurde neu deployed, API/Web unverändert übersprungen und ihre bisherigen READY-Aliase unabhängig bestätigt.

Mac-TestFlight-Build 7 wurde installiert und per laufendem Bundle verifiziert. Nach frischer Gemini-Zustimmung erschienen fünf Text-Karten sofort ohne Rücknavigation; Fix aus PR #750 nativ bestanden, Karten gespeichert und per API bestätigt. Der Lernlauf 7/7 bleibt Build-6-Evidenz; URL wurde nur durch Code/Regression geprüft. Kaufblatt mangels Bestätigungsbutton abgebrochen, kein Kauf; Restore fand kein aktives Abo. Keine physische iPhone-Abnahme und kein Paid-Restore belegt.

Nächste Reihenfolge: Build 7 am physischen iPhone einschließlich aller drei IAP-Käufe und Restore abnehmen, drei fehlende IAP-Review-Screenshots und übriges Store-Material vervollständigen, die von Apple tatsächlich gemeldeten Sperren Datenschutzveröffentlichung, Inhaltsrechte und DAC7 klären, Apple Review abschließen, öffentlich einschließlich USA veröffentlichen und finale Demo/Devpost-Einreichung abschließen. Alle drei IAPs bleiben trotz Review Notes für Build 7 auf MISSING_METADATA. Frühere Bestandsaufnahmen beschreiben ihren historischen Prüfzeitpunkt.

## Bestätigter Umfang

Andreas Ostheimer hat bestätigt: alleiniger Entwickler; bislang keine öffentliche Store-Veröffentlichung. Reguläre Teilnahme ist der geplante Weg. Next Gen ist nicht der gewählte Teilnahmeweg. Bestehende Entwicklung darf weiterverwendet werden.

Arbeitsannahme: iOS zuerst, da bereits ein interner iOS-Build dokumentiert ist. Eine zweite Plattform ist für die Teilnahme nicht erforderlich. Die tatsächliche Release-Reife ist noch nachzuweisen.

## Termine und Abnahme

| Zieltermin | Ergebnis | Abnahme |
| --- | --- | --- |
| 8. September | Release-Bestand klären – noch nicht abgenommen | Aktuelle Store-/RevenueCat-/EAS-Konfiguration prüfen; alte Dokumentationslücken von echten Blockern trennen. Die lokale Umsetzung ersetzt diese Bestandsaufnahme nicht. |
| 15. September | Enger Release-Kandidat | Kern-Lernablauf und Kauf-/Restore-Code geprüft; notwendige Fehler behoben; angemessene lokale Checks grün; native Abnahme bis 19. September vorbereitet |
| 20. September | Einreichungspaket bereit | Auf Gerät verifizierte Demo, englische Texte, finale Screenshots, Jury-Zugang und korrekte Store-Metadaten |
| 23. September | Store-Einreichungsziel | Release-Build und Store-Einreichung nach konkreter Freigabe; Review-Puffer beginnt |
| 29. September | Interne Wettbewerbsabnahme | App öffentlich und in den USA verfügbar; Devpost-Material vollständig; finaler Freigabestand dokumentiert |
| 1. Oktober, 08:45 Wien | Harte Abgabefrist | Wettbewerbsbeitrag tatsächlich eingereicht; Store-Review allein genügt nicht |

Termine sind ursprüngliche Planungsziele, keine Erledigungsnachweise oder Zusage einer Store-Freigabe. Der aktuelle Stand steht oben und im Release-Nachweis vom 28. September. Bei Verzögerungen hat ein kleiner stabiler Umfang Vorrang vor Zusatzfunktionen oder Sponsor-SDKs.

## Arbeitspakete

1. **Release-Bestand:** [Release-Prüfung](release-readiness.md) als Ausgangspunkt. Externe Zustände frisch prüfen, keine Schlüsselwerte ausgeben. iOS-relevante Kriterien von Android-Voraussetzungen unterscheiden.
2. **Kernfunktion und Monetarisierung:** Anmeldung, eigener Demo-Lernstoff, Generierung, Lernen, RevenueCat-Kauf, Freischaltung und Restore belegen. Bei einem Bug zuerst reproduzierender Test, danach Fix und derselbe Test grün.
3. **Einreichung:** [Englischer Entwurf](submission-draft.md). Behauptungen erst nach Geräteprüfung übernehmen. Als primäre Positionierung Lernzugang/Peace Prize prüfen; Design nur bei belegbar überzeugendem Ergebnis ergänzen.
4. **Release-Abnahme:** Repository-Gates aus `docs/runbooks/release-gates.md` beachten. Ein grüner Codecheck ersetzt weder Store-Kauf noch Geräteprüfung oder öffentliche Store-Verfügbarkeit.

## Ausführung und Grenzen

PM priorisiert und prüft Ergebnisse; abgegrenzte Recherche-/Implementierungsaufgaben werden delegiert. Keine zusätzliche Automatisierung oder dauerhafte Überwachung ist eingerichtet.

Die folgenden Einträge halten historische Zwischenstände fest; ihre damals offenen Punkte sind mit dem aktuellen Release-Nachweis abzugleichen.

Andreas hat lokale Entwicklung und Tests ausdrücklich autorisiert: notwendige Fehler beheben, projektbezogene Abhängigkeiten installieren, lokale Tests/Builds und Browser-Verifikation ausführen. Plattform-Gates, RevenueCat-Kontowechsel bei Fehlern und sichtbare Mock-Werbeaktionen sind lokal bearbeitet. Die Prüfung vom 5. September umfasste erfolgreiche gezielte Tests, Web-Build, drei Browser-Smokes, iOS-Bundle-Export und vollständige lokale CI. Ergebnisseverlust beim Kontosync und iOS-Scan-Kostenhilfe sind ebenfalls lokal behoben. Diese Nachweise gehören zum Stand vom 5. September in [local-validation.md](local-validation.md).

Am 8. September ist zusätzlich die Wiederaufnahme veränderter Fälligkeitsstapel lokal umgesetzt und zusammen mit dem mobilen Hintergrundsync geprüft. Die letzte Bewertung wird vor dem Konto-Merker in der Offline-Warteschlange gesichert. Finale lokale CI (2.225 Tests), vier Resume-Browserflows, Web-Produktionsbuild und Web-/iOS-Bundle-Exporte sind grün. Der [aktuelle Resume-Bericht](resume-validation.md) trennt Teilnachweise, synthetische Browserprüfung und ausstehende Geräteabnahme. Vor einem späteren API-Deployment ist die additive `card_ids`-Migration erforderlich. Ein Bundle-Export ersetzt keinen signierten App-Build oder Gerätetest.

Am 15. September sind zusätzlich die RevenueCat-Webhook-Authentifizierung und das Ads-Release-Gate lokal korrigiert. Die gemeinsame CI ist mit 2.183 bestandenen Tests grün. Der iOS-Release-Check wird nicht mehr durch deaktivierte Ads blockiert; offen bleiben der RevenueCat-iOS-Key sowie echte Dashboard-/TestFlight-Evidenz. Der persönliche Apple-Verkäufername ist in den Store-Unterlagen korrigiert. Die Copyright-Angabe bleibt als bewusster Blocker offen, bis der tatsächliche Rechteinhaber und das Jahr der Rechteentstehung feststehen.

Die inzwischen ausgeführten externen Release-Schritte sind im Nachweis vom 28. September dokumentiert. Weitere Dashboard-, Build- und Deployment-Schritte koordiniert der Release-Task im tatsächlich autorisierten Umfang. Vor einem autorisierten Build vorhandene Builds prüfen und Kosten/Quota transparent nennen. Fertige Änderungen für einen gemeinsamen Build bündeln; keine automatischen Cloud-Builds nach jedem Merge.

## Quellen

- [Offizielle Regeln](https://revenuecat-shipaton-2026.devpost.com/rules)
- [Offizielle FAQ](https://www.shipaton.com/faq)
- [Einreichungsanforderungen](https://revenuecat-shipaton-2026.devpost.com/)

Die Regeln nennen den Beginn des Submission Period am 31. Juli; FAQ und Übersicht nennen den 1. August. Für den geplanten September-Erstrelease hat diese Abweichung keine Auswirkung. Vor der tatsächlichen Einreichung Regeln erneut prüfen.
