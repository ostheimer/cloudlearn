# ADR 0003: In-App-Käufe & Abos über RevenueCat

- Status: Accepted
- Datum: 2026-07-09

## Kontext

clearn braucht Abos (Pro Monthly/Annual, Lifetime) und Consumable-Käufe (LP-Packs) auf iOS und Android. Zwei getrennte Store-APIs (App Store, Play Store) inklusive Receipt-Validierung selbst zu betreiben ist aufwendig und fehleranfällig.

## Entscheidung

- RevenueCat als Abstraktionsschicht über App-Store- und Play-Store-IAP (`docs/monetization/REVENUECAT_SETUP.md`).
- Eine Konfiguration für Produkte, Entitlements (`pro`, `lifetime`) und Offerings statt zweier Store-APIs im App-Code.
- Entitlement-/Receipt-Validierung serverseitig; RevenueCat-Webhooks (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE_DETECTED`) aktualisieren den Tier in der API.
- Bezug zum LP-Modell (`docs/monetization/MONETIZATION_CONCEPT.md`): ein einziger `lp_balance`-Topf; gekaufte LP (Consumables) und monatliches Abo-Kontingent (300 LP) werden auf denselben Topf aufaddiert, Subscriptions und LP-Packs bleiben im Mapping getrennt.

## Konsequenzen

- Ein Integrationspunkt für beide Stores → deutlich weniger eigener Store-Integrations- und Validierungsaufwand.
- Serverseitige Entitlements/Webhooks halten App- und Backend-Tier konsistent (Kauf-, Restore- und Webhook-Flows als Pflicht-Checks vor Rollout).
- Abhängigkeit von RevenueCat plus dessen Gebühren als Trade-off gegenüber Eigenbau.
- Zusätzliche Betriebsschritte außerhalb des Repos (Produkte/Entitlements/Offerings anlegen, Webhook-Secret setzen) bleiben Voraussetzung für einen funktionierenden Kauf-Flow.
