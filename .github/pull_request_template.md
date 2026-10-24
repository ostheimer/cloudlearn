<!-- BEGIN: agent-pr-quality-v1 -->
## KI-Änderung: Umfang und Prüfnachweise

- [ ] Ein zusammenhängendes Problem/Ergebnis; unabhängige Änderungen getrennt. Untrennbare größere Änderungen sind begründet.
- [ ] Verhaltensänderung: derselbe Regression-/Akzeptanztest schlägt am Ausgangsstand aus fachlichem Grund fehl und besteht mit der Änderung; oder begründete Ausnahme mit gleichwertiger reproduzierbarer Prüfung.
- [ ] Neue/geänderte Funktionen, API-Aufrufe, Imports und Pakete gegen tatsächliche Definitionen, Versionen, Manifest/Lockfile und offizielle Quellen geprüft (einschließlich Signatur/Rückgabewert; Paketname/Herkunft bei neuen Paketen).
- [ ] Nur bei reiner, nicht ausführbarer Doku/Kommentaren ohne Verhaltens-, Build-, Konfigurations-, Schema- oder Abhängigkeitsänderung: Doku-Ausnahme begründet und passende Text-/Link-/Beispiel-/Konsistenzprüfung dokumentiert. Gemischte Änderungen regulär geprüft.

**Umfang / gegebenenfalls Begründung der Größe:**

**Test und Befehl; Ausgangsstand → Fehlschlag; Änderungsstand → Erfolg:**

**Existenz-/Versionsprüfung: Quellen oder Befehle und Ergebnis:**

**Gegebenenfalls Doku-/Testausnahme und Ersatznachweis:**

<!-- Nur zutreffende Punkte abhaken. Keine erfolgreichen Prüfungen oder Rot-Grün-Nachweise ohne Ausführung behaupten. Details: AGENTS.md, Abschnitt KI-Änderungen und PR-Qualität. -->
<!-- END: agent-pr-quality-v1 -->

## Release Gates

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:cloudlearn-smoke`
- [ ] Vercel `clearn-api` ist grün
- [ ] Vercel `clearn-web` ist grün
- [ ] Vercel `cloudlearn` ist grün

## Produktprüfung

- [ ] Auth-Screen rendert auf Desktop und Mobile korrekt
- [ ] Keine unnötigen auth-pflichtigen Requests vor Login
- [ ] Preview-Link wurde geöffnet und kurz geprüft

## Risiko / Rollout

- [ ] Restore-/Rollback-Auswirkung geprüft
- [ ] Externe Setups angepasst, falls nötig:
  RevenueCat / Vercel / Supabase / OAuth / App-Store-Assets

## Kontext

Kurze Zusammenfassung der Änderung und des verbleibenden Risikos.
