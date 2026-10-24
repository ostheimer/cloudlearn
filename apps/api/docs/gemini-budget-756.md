# Gemeinsames Gemini-Budget (#756)

## Technischer Umfang und Aktivierungsgrenze

Die Migration und der API-Code bilden einen gemeinsamen, atomaren Guard für alle clearn-Gemini-Aufrufe. Die Migration startet mit `enabled=false`, unbekanntem Provider-Projekt und Tages-/Monatslimit **0**. Sie aktiviert keine Ausgaben. Die neue API verweigert beim konfigurierten Gemini-Schlüssel neue KI-Erstellung, solange Konfiguration oder Migration fehlen; gespeicherte Karten, deren Lernen und Bewertungen benötigen diesen Guard nicht.

Vor Veröffentlichung: Migration zuerst, danach API-Code. Der PM koordiniert Merge und Deployment. **Issue #756 bleibt offen**, bis das tatsächlich vom Produktionsschlüssel verwendete Google-Projekt eindeutig zugeordnet, sein Spend Cap geprüft, Tages- und Monatsbetrag genehmigt und die Aktivierung verifiziert sind. Kein Provider-Projekt und kein Betrag wurden in diesem PR in Produktion geändert.

Benötigte Entscheidung: bestätigte Google-Projekt-ID und Billing-Plan, genehmigte Beträge in USD je UTC-Kalendertag und UTC-Kalendermonat, Projekt-Spend-Cap und ausdrückliche Aktivierung. Eine Projektbezeichnung in der Datenbank beweist keine Zuordnung des API-Schlüssels; sie ist vor Aktivierung im Google-Konto zu überprüfen, ohne den Schlüssel zu protokollieren.

## Reservierung und Abrechnung

`reserve_gemini_budget` sperrt die einzige Konfigurationszeile. Innerhalb derselben Transaktion prüft es Abschaltung, Projekt, Modell, beide Limits und die Konsistenz der Zähler mit dem Reservierungsjournal. Anschließend belastet es **beide** Perioden und erzeugt eine Reservierung. Auch unterschiedliche Serverinstanzen verwenden diesen einen Speicher. Es gibt keinen In-Memory-Ausweichpfad.

Der Guard liegt unmittelbar vor `fetch(generateContent)` in `flashcardGenerator.ts`. Er gilt für Bild, Text, URL, jeden PDF-/Text-Chunk und jeden Wiederholungsversuch. `AI_*`-Fehler werden weder erneut versucht noch durch die Heuristik verdeckt. Chunk-Jobs warten auf alle bereits gestarteten Versuche, bevor der Request-Claim freigegeben werden kann.

Beträge sind ganze USD-Mikroeinheiten: **1 USD = 1.000.000 µUSD**. Reservierung und Abrechnung runden einmal pro Versuch auf die nächste Mikroeinheit auf. Preise werden je Reservierung gespeichert. Eine spätere Preisänderung ändert keine alte Abrechnung. Tatsächliche Kosten = Eingabe-Tokens × Eingabepreis + (Antwort- + Thinking-Tokens) × Ausgabepreis. Es werden keine Tools, Grounding, Audio oder expliziten Cache-Aufrufe verwendet.

Konservative Grenzen für das unveränderte Modell `gemini-3-flash-preview`:

- Text: ein Token pro UTF-8-Byte aller Promptteile plus 1.024 Tokens für Framing; höchstens das Modell-Eingabelimit 1.048.576.
- Sobald Bilder vorhanden sind: volles Eingabelimit 1.048.576, unabhängig von Bildgröße und Bild-Tiling.
- Ausgabe: volles Modelllimit 65.536, einschließlich Thinking; HTTP-Konfiguration bleibt bei 16.384.
- Keine zusätzliche `countTokens`-Provideranfrage. Jeder Retry braucht eine eigene Reservierung.

Bei den unten belegten Preisen reserviert ein Bildversuch deshalb rund **0,720896 USD**, ein kurzer Text mindestens rund **0,197 USD**, obwohl gemessene Kosten häufig deutlich darunter liegen. Nicht verbrauchte Kapazität wird erst nach gültiger Token-Abrechnung frei. Kleine genehmigte Limits können damit auch einen an sich günstigen Job blockieren. Das ist eine bewusste konservative Betriebsentscheidung, keine Behauptung über übliche Kosten.

Bei Netzwerkfehler, HTTP-Fehler, unlesbarer Antwort oder fehlender/inkonsistenter Nutzungsmetadaten bleibt die volle Reservierung verbraucht. Ein Prozessabbruch löscht keine Reservierung. Unbekannte Versuche dürfen ohne belastbaren Providerbeleg **nicht** auf 0 abgerechnet werden. Ein späteres Settlement ist idempotent und belastet die ursprünglichen Perioden, selbst nach Tages-/Monatswechsel. Bei einem unerwarteten tatsächlichen Preis-/Token-Overrun wird der volle Betrag verbucht und `enabled=false` gesetzt. Bereits zugelassene/in-flight Aufrufe können nicht rückgängig gemacht werden.

## Atomare identische Requests

Die drei KI-Routen erzeugen serverseitig einen SHA-256-Schlüssel aus authentifiziertem Nutzer, Operation, Client-Schlüssel und validiertem, von unbekannten Feldern bereinigtem und kanonisiertem Input. Dadurch sind alte globale Cache-Schlüssel nicht länger vertrauenswürdig für diese Routen. Ein zweiter SHA-256-Fingerprint enthält den Inhalt ohne Client-Schlüssel: gleichzeitig identische Jobs werden auch bei verschiedenen Client-Schlüsseln abgefangen. Ein späterer bewusst neuer Client-Schlüssel darf nach Abschluss einen neuen Job starten.

`claim_ai_request` beansprucht den Job vor dem LP-Abzug. Ein partieller eindeutiger Index lässt genau einen `processing`-Claim je Inhalts-Fingerprint zu. Ein Konkurrent erhält `409 AI_REQUEST_IN_PROGRESS`, ohne LP-Abzug und ohne Gemini-Aufruf. Ein fertiger Claim liefert das gespeicherte Ergebnis, auch wenn der ältere Ergebnis-Cache ausfällt. Abschluss und Freigabe sind durch die zufällige Owner-ID abgesichert.

Claims laufen **nicht** per Zeitablauf ab: ein alter Prozess kann noch beim Provider laufen. Ein abgestürzter Job bleibt gesperrt, bis ein Operator bestätigt, dass kein Job mehr läuft, LP/Kartenspeicherung und Providerkosten geprüft und den Claim gezielt behandelt hat. Bei erfolgreicher Verarbeitung und fehlgeschlagenem Claim-Abschluss bleiben Claim und LP-Abzug erhalten, weil Karten schon gespeichert sein können. Während eines normalen Fehlers werden LP wie bisher bestmöglich zurückgebucht; ein fehlgeschlagener LP-Refund wird zur Nachbearbeitung protokolliert.

## Betrieb

Konfiguration nur durch autorisierte Betreiber/service_role. Tabellen haben RLS; `anon`, `authenticated` und `PUBLIC` erhalten weder Tabellenzugriff noch RPC-Execute. Die Funktionen verwenden `SECURITY INVOKER` mit leerem `search_path`.

Lesbare Ausgangskontrolle (keine Schlüssel):

```sql
select id, enabled, provider_project_id, model,
       daily_limit_microusd, monthly_limit_microusd,
       input_price_microusd_per_million, output_price_microusd_per_million
from public.gemini_budget_config;
```

Abschalten neuer Zulassungen ohne API-Redeployment:

```sql
update public.gemini_budget_config set enabled = false where id = 1;
```

Erst nach genehmigtem Projekt/Beträgen/Preisen aktivieren. Niemals Periodenzähler zurücksetzen, um das Monatslimit zu umgehen. Bei Limitänderung bleiben bestehende Reservierungen und Ausgaben erhalten; ein abgesenktes Limit kann sofort blockieren. Ein Wechsel des Google-Projekts setzt clearns bestehende Ausgabenzähler ebenfalls nicht zurück.

Fehlerantworten: `AI_DISABLED` (503), `AI_BUDGET_EXHAUSTED` (429), `AI_BUDGET_UNAVAILABLE` (503), `AI_REQUEST_IN_PROGRESS` (409), `AI_REQUEST_UNAVAILABLE` (503). Sie enthalten verständlichen deutschen Text mit echten Umlauten. Fehlerhafte Budget- oder Claim-RPCs starten keinen neuen Provideraufruf. Ein LP-Abzug vor gesperrter Generation wird über den vorhandenen Fehler-/Refund-Weg behandelt. Bereits fertige Replays benötigen keinen neuen Provideraufruf.

## Offizielle Quellen, geprüft am 09.10.2026

- [Gemini-Preise](https://ai.google.dev/gemini-api/docs/pricing): Standard `gemini-3-flash-preview`, Text/Bild-Eingabe **0,50 USD / 1 Mio. Tokens**, Ausgabe einschließlich Thinking **3,00 USD / 1 Mio. Tokens**. Audio und andere Modelle haben abweichende Preise; ein Modellwechsel erfordert neue Grenzen/Preise und Tests.
- [Modellgrenzen](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview): Eingabe 1.048.576, Ausgabe 65.536 Tokens.
- [UsageMetadata](https://ai.google.dev/api/generate-content#UsageMetadata): `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, `totalTokenCount`; Gesamt = Eingabe + Thinking + Kandidaten. Nur konsistente nichtnegative ganze Werte reduzieren eine Reservierung.
- [Gemini Billing / Spend Caps](https://ai.google.dev/gemini-api/docs/billing#spend-caps): experimenteller Projekt-Cap, ungefähr zehn Minuten Verzögerung mit möglichen Überziehungen; langfristige Jobs können ebenfalls überziehen. Der Provider-Cap ist zusätzlich erforderlich und kein Beleg für den lokalen Gesamt-Cap. Nutzung außerhalb dieser API/mit demselben Projekt wird im lokalen Journal nicht erfasst.
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) und [Changelog](https://supabase.com/changelog): Funktionen über RPC, explizite Berechtigungen und RLS; die aktuelle Änderung zur Data-API-Exposition ist durch explizite service_role-Grants berücksichtigt.

## Prüfevidenz

Vor Implementierung: 6 rote Provider-Guard-Tests, 2 rote Parallelitäts-/Claim-Tests und 9 rote echte Postgres-Fälle. Die rot nachgewiesenen Fälle prüfen erschöpfte Budgets, konkurrierende Requests, Chunk-Retry, Speicherausfall und fehlende atomare Datenbankfunktionen. Dieselben Fälle nach Implementierung grün.

Die erweiterte fokussierte Prüfung umfasst außerdem Monatserschöpfung, Token/Thinking-Abrechnung, Preis-Snapshot, idempotentes Settlement, ursprüngliche Perioden, unbekannte Versuche, Overrun-Abschaltung, fehlende Projektaktivierung, Inhalts-Claims mit verschiedenen Schlüsseln, Owner-Fencing, defekte Zähler, service_role-/RLS-Zugriff und sichtbare API-Fehler. Alle Providerantworten sind synthetisch. SQL läuft gegen einen eigenen lokalen Wegwerf-Postgres; keine Produktionsdaten und keine bezahlten Gemini-Aufrufe.

Abschließende lokale Prüfungen:

- Fokussierte Tests: **46 bestanden**, davon **13 echte Postgres-Fälle**.
- `DATABASE_URL=<eigener lokaler Wegwerf-Postgres> pnpm run ci`: **2.328 bestanden**, **13 bestehende Umgebungstests übersprungen**; alle Workspace-Typechecks, Lint **0 Fehler / 32 bestehende Warnungen**.
- `pnpm run restore:smoke`: alle **61 Migrationen** erfolgreich in eine neu erzeugte Wegwerf-Datenbank eingespielt.
- Supabase `db advisors --db-url <lokaler Postgres mit sslmode=disable> --fail-on error`: **No issues found**.
- Zusätzlich gezielter ESLint-Lauf des UI-Nachweis-Skripts ohne Fehler.

Lokaler Browsernachweis (synthetische Anmeldung/API, unveränderte Web-Oberfläche): **1280×900 und 390×844**. Abschaltmeldung sichtbar; derselbe Eingabetext bleibt erhalten; gespeicherte Karte lässt sich anschließend öffnen und umdrehen. Je Lauf genau ein intercepteter Scan-Request, **keine Browserfehler und keine externen Netzwerkziele**. Kein nativer Gerätetest und keine Produktionsabnahme.

Reproduzieren vom Repo-Root mit installierten Dependencies und lokal installiertem Chrome:

```bash
NEXT_PUBLIC_CLEARN_API_BASE_URL=http://127.0.0.1:4756 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
pnpm --filter @clearn/web dev --hostname 127.0.0.1 --port 4756
# In einem zweiten Terminal:
node apps/api/docs/gemini-budget-756-ui.mjs
```

[Abschaltung Desktop](gemini-budget-756/disabled-1280.png) · [Abschaltung Handybreite](gemini-budget-756/disabled-390.png) · [Lernen Desktop](gemini-budget-756/learning-1280.png) · [Lernen Handybreite](gemini-budget-756/learning-390.png). Screenshots wurden visuell zurückgelesen.

Vor Merge beachten: Default-off sperrt neue Gemini-Erstellung nach Deployment bis zur bestätigten Aktivierung. Die Migration ist zuerst einzuspielen; ein fehlendes RPC führt ebenfalls zur Sperre. Die vier offenen externen Punkte bleiben Provider-Zuordnung, Spend-Cap-Prüfung, genehmigter Tages-/Monatsbetrag und Aktivierungs-/Live-Abnahme. Keine bezahlten Builds, keine echten KI-Aufrufe, kein Codex-Security-Scan.
