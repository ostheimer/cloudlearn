# Shipaton 2026 – PM-Plan

Stand: 15. September 2026. Vorbereitung und autorisierte lokale Umsetzung laufen; keine erfolgte Wettbewerbsanmeldung oder Veröffentlichung.

Die [Dashboard-Bestandsaufnahme vom 9. September](dashboard-inventory-2026-09-09.md) ist bis zum 15. September fortgeschrieben: Das RevenueCat-Konto hat keine Projekte. Apple hat die App angelegt, aber keine IAPs, Abogruppe oder TestFlight-Builds; deutsche Versionsmetadaten, Datenschutz sowie Preis-/Länderkonfiguration fehlen. Andreas hat die persönlichen Steuer- und Bankangaben eingereicht; der kostenpflichtige Vertrag und die Bankdaten stehen auf „In Bearbeitung“. EAS enthält den alten Preview-Build und keinen nachgewiesenen RC-Key. Webhook-Authentifizierung und das Ads-Release-Gate sind lokal behoben. Nächste Reihenfolge: Apple-Verarbeitung nachprüfen, externe Monetarisierung und Store-Paket einrichten, dann einen gebündelten Kandidaten abnehmen.

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

Termine sind Planungsziele, keine Zusage einer Store-Freigabe. Bei Verzögerungen hat ein kleiner stabiler Umfang Vorrang vor Zusatzfunktionen oder Sponsor-SDKs.

## Arbeitspakete

1. **Release-Bestand:** [Release-Prüfung](release-readiness.md) als Ausgangspunkt. Externe Zustände frisch prüfen, keine Schlüsselwerte ausgeben. iOS-relevante Kriterien von Android-Voraussetzungen unterscheiden.
2. **Kernfunktion und Monetarisierung:** Anmeldung, eigener Demo-Lernstoff, Generierung, Lernen, RevenueCat-Kauf, Freischaltung und Restore belegen. Bei einem Bug zuerst reproduzierender Test, danach Fix und derselbe Test grün.
3. **Einreichung:** [Englischer Entwurf](submission-draft.md). Behauptungen erst nach Geräteprüfung übernehmen. Als primäre Positionierung Lernzugang/Peace Prize prüfen; Design nur bei belegbar überzeugendem Ergebnis ergänzen.
4. **Release-Abnahme:** Repository-Gates aus `docs/runbooks/release-gates.md` beachten. Ein grüner Codecheck ersetzt weder Store-Kauf noch Geräteprüfung oder öffentliche Store-Verfügbarkeit.

## Ausführung und Grenzen

PM priorisiert und prüft Ergebnisse; abgegrenzte Recherche-/Implementierungsaufgaben werden delegiert. Keine zusätzliche Automatisierung oder dauerhafte Überwachung ist eingerichtet.

Andreas hat lokale Entwicklung und Tests ausdrücklich autorisiert: notwendige Fehler beheben, projektbezogene Abhängigkeiten installieren, lokale Tests/Builds und Browser-Verifikation ausführen. Plattform-Gates, RevenueCat-Kontowechsel bei Fehlern und sichtbare Mock-Werbeaktionen sind lokal bearbeitet. Die Prüfung vom 5. September umfasste erfolgreiche gezielte Tests, Web-Build, drei Browser-Smokes, iOS-Bundle-Export und vollständige lokale CI. Ergebnisseverlust beim Kontosync und iOS-Scan-Kostenhilfe sind ebenfalls lokal behoben. Diese Nachweise gehören zum Stand vom 5. September in [local-validation.md](local-validation.md).

Am 8. September ist zusätzlich die Wiederaufnahme veränderter Fälligkeitsstapel lokal umgesetzt und zusammen mit dem mobilen Hintergrundsync geprüft. Die letzte Bewertung wird vor dem Konto-Merker in der Offline-Warteschlange gesichert. Finale lokale CI (2.225 Tests), vier Resume-Browserflows, Web-Produktionsbuild und Web-/iOS-Bundle-Exporte sind grün. Der [aktuelle Resume-Bericht](resume-validation.md) trennt Teilnachweise, synthetische Browserprüfung und ausstehende Geräteabnahme. Vor einem späteren API-Deployment ist die additive `card_ids`-Migration erforderlich. Ein Bundle-Export ersetzt keinen signierten App-Build oder Gerätetest.

Am 15. September sind zusätzlich die RevenueCat-Webhook-Authentifizierung und das Ads-Release-Gate lokal korrigiert. Die gemeinsame CI ist mit 2.183 bestandenen Tests grün. Der iOS-Release-Check wird nicht mehr durch deaktivierte Ads blockiert; offen bleiben der RevenueCat-iOS-Key sowie echte Dashboard-/TestFlight-Evidenz. Der persönliche Apple-Verkäufername ist in den Store-Unterlagen korrigiert. Die Copyright-Angabe bleibt als bewusster Blocker offen, bis der tatsächliche Rechteinhaber und das Jahr der Rechteentstehung feststehen.

Noch keine kostenpflichtigen Cloud-Builds, Anmeldung, externe Nachrichten, Sicherheits-/Zugangsdatenänderungen oder Veröffentlichung autorisiert. Vor einem autorisierten Build vorhandene Builds prüfen und Kosten/Quota transparent nennen. Fertige Änderungen für einen gemeinsamen Build bündeln.

## Quellen

- [Offizielle Regeln](https://revenuecat-shipaton-2026.devpost.com/rules)
- [Offizielle FAQ](https://www.shipaton.com/faq)
- [Einreichungsanforderungen](https://revenuecat-shipaton-2026.devpost.com/)

Die Regeln nennen den Beginn des Submission Period am 31. Juli; FAQ und Übersicht nennen den 1. August. Für den geplanten September-Erstrelease hat diese Abweichung keine Auswirkung. Vor der tatsächlichen Einreichung Regeln erneut prüfen.
