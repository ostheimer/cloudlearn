# Shipaton 2026 – PM-Plan

Stand: 5. September 2026. Vorbereitung und autorisierte lokale Umsetzung laufen; keine erfolgte Anmeldung oder Veröffentlichung.

## Bestätigter Umfang

Andreas Ostheimer hat bestätigt: alleiniger Entwickler; bislang keine öffentliche Store-Veröffentlichung. Reguläre Teilnahme ist der geplante Weg. Next Gen ist nicht der gewählte Teilnahmeweg. Bestehende Entwicklung darf weiterverwendet werden.

Arbeitsannahme: iOS zuerst, da bereits ein interner iOS-Build dokumentiert ist. Eine zweite Plattform ist für die Teilnahme nicht erforderlich. Die tatsächliche Release-Reife ist noch nachzuweisen.

## Termine und Abnahme

| Zieltermin | Ergebnis | Abnahme |
| --- | --- | --- |
| 8. September | Release-Bestand geklärt | Aktuelle Store-/RevenueCat-/EAS-Konfiguration geprüft; alte Dokumentationslücken von echten Blockern getrennt |
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

Andreas hat lokale Entwicklung und Tests ausdrücklich autorisiert: notwendige Fehler beheben, projektbezogene Abhängigkeiten installieren, lokale Tests/Builds und Browser-Verifikation ausführen. Plattform-Gates, RevenueCat-Kontowechsel bei Fehlern und sichtbare Mock-Werbeaktionen sind lokal bearbeitet. Gezielte Prüfungen, Web-Build, drei Browser-Smokes und iOS-Bundle-Export sind erfolgreich; die vollständige lokale CI ist grün. Ergebnisseverlust beim Kontosync und iOS-Scan-Kostenhilfe sind ebenfalls lokal behoben. Verbleibende Teilpunkte und genaue Nachweise stehen in [local-validation.md](local-validation.md). Ein Bundle-Export ersetzt keinen signierten App-Build oder Gerätetest.

Noch keine kostenpflichtigen Cloud-Builds, Anmeldung, externe Nachrichten, Sicherheits-/Zugangsdatenänderungen oder Veröffentlichung autorisiert. Vor einem autorisierten Build vorhandene Builds prüfen und Kosten/Quota transparent nennen. Fertige Änderungen für einen gemeinsamen Build bündeln.

## Quellen

- [Offizielle Regeln](https://revenuecat-shipaton-2026.devpost.com/rules)
- [Offizielle FAQ](https://www.shipaton.com/faq)
- [Einreichungsanforderungen](https://revenuecat-shipaton-2026.devpost.com/)

Die Regeln nennen den Beginn des Submission Period am 31. Juli; FAQ und Übersicht nennen den 1. August. Für den geplanten September-Erstrelease hat diese Abweichung keine Auswirkung. Vor der tatsächlichen Einreichung Regeln erneut prüfen.
