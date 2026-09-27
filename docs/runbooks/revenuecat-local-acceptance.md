# RevenueCat: lokale Prüfung und Geräteabnahme

Stand: 5. September 2026. Lokale Tests ersetzen keine Store- oder Dashboard-Abnahme.

## Lokal nachgewiesen

- `pnpm --filter @clearn/mobile exec vitest run src/features/paywall`: 35 Tests grün.
  Die neue SDK-Grenzprüfung in `revenuecat.test.ts` verwendet ausschließlich Mocks:
  Konfiguration mit App-Nutzer-ID, fehlender API-Key, Kaufabbruch, entferntes
  Angebot, Pro-Kauf, Restore, Store-Fehler und fehlgeschlagener Accountwechsel.
- Bei fehlgeschlagenem RevenueCat-Login für einen anderen App-Account dürfen
  Kauf, Restore, Entitlement-Abfrage und Angebotsabfrage nicht unter dem vorherigen
  Nutzer fortgesetzt werden. Vier Regressionstests waren vor dem Fix rot und
  danach grün. Ein späterer Versuch wiederholt den Login.
- 83 API-Tests grün: `revenueCatService`, `revenueCatWebhookSchema`,
  `subscriptionService`, `subscriptionWebhookRoute`, `lpService`.
  Sie belegen Mapping, Webhook-/Service-Verkabelung und Fehlerbehandlung mit
  Test-Doubles. Sie belegen keine Kommunikation mit RevenueCat oder Apple.
- Echte SQL-Idempotenz wird separat durch `lpDb.integration.test.ts` geprüft.
  Ohne `DATABASE_URL` werden dessen 35 Tests übersprungen. Nur gegen eine
  isolierte Wegwerf-Datenbank ausführen: das Setup ersetzt Testtabellen.
  Gegen lokales PostgreSQL liefen alle 35 Tests zweimal hintereinander grün,
  einschließlich doppelter LP-Kaufgutschrift und konkurrierender Abbuchungen.
  Ein dabei reproduzierter Fehler im wiederholten Test-Setup wurde behoben:
  auch die abhängigen Freundschaftstabellen werden vor dem Neuaufbau entfernt.

## Noch auf Gerät und mit Dashboard-Nachweis abzunehmen

1. RevenueCat-App, Plattform-Key, Offering, Store-Produkte und Entitlements
   konfigurieren und Zuordnung zum authentifizierten App-Nutzer nachweisen.
2. Pro kaufen: native Store-Bestätigung, RevenueCat-Ereignis und Backend-Status
   müssen denselben Nutzer betreffen. Nach erneutem App-Start muss der Tarif
   weiterhin korrekt sein.
3. Kauf abbrechen: keine Freischaltung, keine Gutschrift, erneuter Versuch möglich.
4. Restore für bestehenden Kauf, leeres Store-Konto und Store-Verbindungsfehler
   prüfen. Nach App-Accountwechsel darf kein veralteter Nutzer verwendet werden.
5. Verzögerten/ausbleibenden Webhook testen. Die Paywall fragt das Backend bis zu
   sechs Mal im Abstand von 1,5 Sekunden ab; ein noch nicht synchronisierter Kauf
   muss als ausstehend erkennbar bleiben. Ein Netzwerkfehler in dieser Phase wird
   derzeit als Fehler angezeigt; die Ende-zu-Ende-Wiederaufnahme ist noch offen.
6. LP-Paket kaufen: Gutschrift nur durch den verifizierten Webhook. Dasselbe
   Store-Ereignis wiederholen: keine doppelte Gutschrift. Neues Ereignis:
   zusätzliche Gutschrift genau einmal.

## LP-Client nach dem Kauf

`lp-store.tsx` zeigt nach erfolgreichem Store-Kauf direkt den vorhandenen Hinweis
auf die ausstehende Webhook-Gutschrift und aktualisiert den Kontostand best-effort.
Der tote Aufruf von `/lp/purchase`, die synthetische Transaktions-ID und der
ungenutzte mobile API-Helper wurden entfernt. Der Backend-Endpunkt bleibt
absichtlich stillgelegt (HTTP 410). Ein enger Quelltext-Regressionstest war vor
dem Fix rot und danach grün; die SDK-Kaufbehandlung ist zusätzlich mit
Verhaltenstests abgedeckt. Mangels React-Native-Test-Renderer belegt das keine
gerenderte Geräte-UI. Die Geräteabnahme muss die verzögerte Balance-Aktualisierung
weiterhin explizit prüfen.

Für diese lokale Prüfung wurden weder externe Käufe noch EAS-Builds gestartet.
