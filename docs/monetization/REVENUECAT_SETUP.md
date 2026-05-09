# RevenueCat Setup — clearn.ai

## Übersicht

clearn.ai nutzt RevenueCat für In-App-Käufe auf iOS und Android.
Dieses Dokument beschreibt die Einrichtung von Produkten, Entitlements und Offerings.

Kanonische Produkt- und App-Identitäten:
[docs/runbooks/product-identities.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/product-identities.md)

---

## 1. App Store Connect (iOS)

### Produkte anlegen unter: App > In-App-Käufe > Abonnements

| Produkt-ID                       | Typ           | Preis  | Beschreibung                |
|----------------------------------|---------------|--------|-----------------------------|
| `ai.clearn.pro.monthly`          | Auto-Renewing | 4,99 € | clearn Pro — Monatlich      |
| `ai.clearn.pro.annual`           | Auto-Renewing | 39,99 €| clearn Pro — Jährlich       |
| `ai.clearn.lifetime`             | Non-Consumable| 89,99 €| clearn Lifetime             |

**Abonnement-Gruppe:** `clearn Pro`  
**Freitest:** 7 Tage (empfohlen für Pro Monthly)

### Optionale LP-Pack-Produkte

LP-Packs sind Consumables. Die App zeigt Preise und Kaufbuttons nur, wenn RevenueCat diese Produkte in der aktuellen Offering-Konfiguration liefert. Solange die Produkte nicht vollständig in App Store Connect, Google Play und RevenueCat angelegt sind, bleiben LP-Packs in der App sichtbar, aber nicht kaufbar.

| Produkt-ID / Package Identifier | Typ        | Preis  | Beschreibung      |
|---------------------------------|------------|--------|-------------------|
| `lp_pack_100`                   | Consumable | 0,99 € | 100 Lernpunkte    |
| `lp_pack_300`                   | Consumable | 2,49 € | 300 Lernpunkte    |
| `lp_pack_750`                   | Consumable | 4,99 € | 750 Lernpunkte    |
| `lp_pack_2000`                  | Consumable | 9,99 € | 2.000 Lernpunkte  |

Wichtig: Für die erste Review-Version sind LP-Pack-Käufe nur dann aktiv, wenn Produkt-ID und RevenueCat Package Identifier exakt identisch sind. Andernfalls verwendet die App keine lokalen Fallback-Preise und blockt den Kauf sauber.

---

## 2. Google Play Console (Android)

### Produkte anlegen unter: Monetarisierung > Produkte

| Produkt-ID                       | Typ        | Preis  |
|----------------------------------|------------|--------|
| `ai.clearn.pro.monthly`          | Subscription| 4,99 € |
| `ai.clearn.pro.annual`           | Subscription| 39,99 €|
| `ai.clearn.lifetime`             | One-time    | 89,99 €|

Optionale LP-Pack-Produkte:

| Produkt-ID                       | Typ        | Preis  |
|----------------------------------|------------|--------|
| `lp_pack_100`                    | Consumable | 0,99 € |
| `lp_pack_300`                    | Consumable | 2,49 € |
| `lp_pack_750`                    | Consumable | 4,99 € |
| `lp_pack_2000`                   | Consumable | 9,99 € |

---

## 3. RevenueCat Dashboard

### App anlegen
1. https://app.revenuecat.com → New App
2. iOS: Bundle ID `app.clearn`, App Store Connect API Key
3. Android: Package Name `app.clearn`, Google Play Service Account Key

Wichtig:
- Die App-/Bundle-ID ist `app.clearn`.
- Die Produkt-IDs bleiben bewusst `ai.clearn.*`.
- Diese beiden Identifier-Gruppen müssen nicht gleich sein.

### Entitlements anlegen (unter Configuration > Entitlements)

| Identifier  | Produkte                                      |
|-------------|-----------------------------------------------|
| `pro`       | `ai.clearn.pro.monthly`, `ai.clearn.pro.annual` |
| `lifetime`  | `ai.clearn.lifetime`                          |

### Offerings anlegen (unter Configuration > Offerings)

**Default Offering** (Identifier: `default`):

| Package Identifier | Typ      | Produkt                   |
|--------------------|----------|---------------------------|
| `$rc_annual`       | Annual   | `ai.clearn.pro.annual`    |
| `$rc_monthly`      | Monthly  | `ai.clearn.pro.monthly`   |
| `$rc_lifetime`     | Lifetime | `ai.clearn.lifetime`      |

Optionale LP-Pack-Packages im selben oder einem separaten Offering:

| Package Identifier | Typ    | Produkt        |
|--------------------|--------|----------------|
| `lp_pack_100`      | Custom | `lp_pack_100`  |
| `lp_pack_300`      | Custom | `lp_pack_300`  |
| `lp_pack_750`      | Custom | `lp_pack_750`  |
| `lp_pack_2000`     | Custom | `lp_pack_2000` |

### Webhook konfigurieren
- URL: `https://clearn-api.vercel.app/api/v1/subscription/webhook`
- Header: `X-RevenueCat-Signature: <REVENUECAT_WEBHOOK_SECRET>`
- Events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE_DETECTED`

---

## 4. Umgebungsvariablen

### Mobile (`.env.local` / Expo EAS Secrets)
```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO=pro
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME=lifetime
```

### Backend (Vercel Environment Variables)
```
REVENUECAT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
FREE_SCAN_LIMIT_PER_MONTH=5
FREE_URL_IMPORT_LIMIT_PER_MONTH=2
FREE_DECK_LIMIT=10
FREE_CARD_LIMIT=100
```

---

## 5. Lokales Testen (Sandbox)

- iOS: Sandbox-Tester im App Store Connect anlegen
- Android: Lizenz-Tester in der Play Console anlegen
- RevenueCat: Debug-Logs mit `Purchases.logLevel = .debug`

---

## 6. Feature-Gating-Übersicht

| Feature              | Free         | Pro/Lifetime  |
|----------------------|--------------|---------------|
| KI-Scans             | 5/Monat      | 300 LP/Monat inklusive, 5 LP/Scan |
| URL-Import           | 2/Monat      | 300 LP/Monat inklusive, 8 LP/Import |
| Max. Decks           | 10           | 500          |
| Max. Karten          | 100          | 2.000 pro Deck |
| PDF-Import           | 20 LP/Import | 12 LP/Import |
| Image Occlusion      | ❌           | ✅            |
| Offline-Download     | ❌           | ✅            |

---

## 7. Restore- und Sync-Checks

Diese Punkte gelten als verpflichtend, bevor ein Store-Rollout als „produktionsreif“ gilt.

### Kauf-Flow

- Kauf auf iOS erfolgreich
- Kauf auf Android erfolgreich
- App erhält Entitlement unmittelbar
- Backend-Tier wechselt zeitnah auf `pro` oder `lifetime`

### Restore-Flow

- Restore auf iOS hebt bestehendes Entitlement wieder an
- Restore auf Android hebt bestehendes Entitlement wieder an
- Client und API zeigen denselben Tier-Wert
- Paywall schließt nach erfolgreichem Restore sauber

### Webhook-Flow

- `INITIAL_PURCHASE`
- `RENEWAL`
- `CANCELLATION`
- `EXPIRATION`
- `BILLING_ISSUE_DETECTED`

### Mapping-Checks

- `pro`-Entitlement mappt auf `pro`
- `lifetime`-Entitlement mappt auf `lifetime`
- LP-Packs und Subscriptions bleiben getrennt

## 8. Externe Blocker-Liste

Diese Schritte passieren nicht im Repo und müssen im Dashboard erledigt werden:

- Produkte in App Store Connect wirklich anlegen
- Produkte in Google Play Console wirklich anlegen
- RevenueCat Entitlements und Offerings wirklich veröffentlichen
- Webhook-Secret in Vercel setzen
- Sandbox- und Testkonten bereitstellen
