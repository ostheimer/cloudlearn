# Produkt-Identitäten

Stand: 2026-04-04

## Ziel

Diese Datei definiert den kanonischen Satz an Produktnamen, App-IDs, Domains und
Env-Namen für `clearn`. Sie ist die Referenz, wenn Runbooks, Store-Setups,
EAS-Konfiguration oder externe Dashboards voneinander abweichen.

## Branding

- Produktname: `clearn.ai`
- App-Name im Store und auf dem Gerät: `clearn`
- Expo Slug: `clearn`

## Native App-Identitäten

- iOS Bundle Identifier: `app.clearn`
- Android Package Name: `app.clearn`
- Deep-Link-Scheme: `clearn://`
- EAS Project ID: `5495e637-0223-4924-a778-8683dafaf264`
- Expo Owner: `aostheimer`

## Web- und API-Identitäten

- API Production: `https://clearn-api.vercel.app`
- Marketing / Support Web: `https://clearn-web.vercel.app`
- Mobile-Web-Preview: Vercel-Projekt `cloudlearn`

## Öffentliche Kontaktangaben

- Anbieter: Ostheimer OG
- Verantwortliche Personen: Andreas Ostheimer und Sabine Ostheimer
- UID: ATU79912016
- Firmenbuchnummer: 613327b
- Adresse: Fabriksgasse 20, 2230 Gänserndorf, Österreich
- Telefon: +43 699 172 635 44
- E-Mail: office@ostheimer.at

## Wichtige Regel zu `cloudlearn`

- `cloudlearn` ist die Mobile-Web-/Preview-Fläche.
- `cloudlearn` ist nicht die kanonische Marketing- oder Support-Domain.
- Produktionsnahe, öffentlich referenzierte Web-Links sollen standardmäßig auf
  `https://clearn-web.vercel.app` zeigen, solange keine eigene Custom-Domain
  existiert.

## OAuth und Auth-Redirects

- Mobile OAuth Redirect: `clearn://auth`
- Web Auth Confirm / E-Mail-Bestätigung: `https://clearn-web.vercel.app/auth/confirm`
- Preview-Redirects nur ergänzen, wenn sie für Tests wirklich gebraucht werden.
- Apple Sign-In und Google Sign-In sind Teil von v1.
- Gleiche verifizierte E-Mail soll über Supabase Identity Linking im selben Konto landen, unabhängig davon, ob der Nutzer sich per E-Mail/Passwort, Apple oder Google anmeldet.
- Mobile-Web/Preview darf OAuth testen, ist aber nicht die kanonische Produktionsfläche.

## RevenueCat und Store-Produkte

- RevenueCat App Bundle / Package Referenz: `app.clearn`
- Entitlement IDs:
  - `pro`
  - `lifetime`
- Öffentliche Env-Namen:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO`
  - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME`

## Wichtige Regel zu Produkt-IDs

- In-App-Kauf-Produkt-IDs dürfen bewusst einen anderen Prefix tragen als die
  Bundle-ID.
- Für `clearn` bleiben die Produkt-IDs aktuell im Format `ai.clearn.*`.
- Das ist kein Fehler, solange App Store Connect, Play Console, RevenueCat und
  Code dieselben IDs verwenden.

## Bei Konflikten gilt

1. Diese Datei
2. Die tatsächliche Runtime-Konfiguration in
   [apps/mobile/app.json](/Users/andreasostheimer/Documents/GitHub/cloudlearn/apps/mobile/app.json)
3. Die produktiven Dashboard-Einstellungen in EAS, RevenueCat, App Store Connect und Play Console
