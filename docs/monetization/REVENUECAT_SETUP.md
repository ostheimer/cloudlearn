# RevenueCat Setup — clearn.ai

## Übersicht

clearn.ai nutzt RevenueCat für In-App-Käufe auf iOS und Android.
Dieses Dokument beschreibt die Einrichtung von Produkten, Entitlements und Offerings.

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

---

## 2. Google Play Console (Android)

### Produkte anlegen unter: Monetarisierung > Produkte

| Produkt-ID                       | Typ        | Preis  |
|----------------------------------|------------|--------|
| `ai.clearn.pro.monthly`          | Subscription| 4,99 € |
| `ai.clearn.pro.annual`           | Subscription| 39,99 €|
| `ai.clearn.lifetime`             | One-time    | 89,99 €|

---

## 3. RevenueCat Dashboard

### App anlegen
1. https://app.revenuecat.com → New App
2. iOS: Bundle ID `ai.clearn.app`, App Store Connect API Key
3. Android: Package Name `ai.clearn.app`, Google Play Service Account Key

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
| KI-Scans             | 5/Monat      | Unbegrenzt    |
| URL-Import           | 2/Monat      | Unbegrenzt    |
| Max. Decks           | 10           | Unbegrenzt    |
| Max. Karten          | 100          | Unbegrenzt    |
| PDF-Import           | ❌           | ✅            |
| Image Occlusion      | ❌           | ✅            |
| Offline-Download     | ❌           | ✅            |
