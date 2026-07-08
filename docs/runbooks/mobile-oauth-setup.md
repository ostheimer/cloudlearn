# Mobile OAuth Setup

## Ziel

Apple- und Google-Sign-In für `clearn` so konfigurieren, dass Mobile-App,
Mobile-Web/Preview und Marketing-Web konsistent funktionieren.

Für v1 gilt:

- Supabase OAuth Flow ist die kanonische Implementierung
- Apple Sign-In und Google Sign-In kommen zusammen mit E-Mail/Passwort
- gleiche verifizierte E-Mail soll in dasselbe Konto laufen
- wir verlassen uns dabei auf Supabase Identity Linking / Account Linking statt auf eigene Duplikat-Logik

Kanonische Identitäten:
[docs/runbooks/product-identities.md](/docs/runbooks/product-identities.md)

## Supabase

### Redirect URLs

- `clearn://auth`
- `https://clearn-web.vercel.app/auth/confirm` für E-Mail-Bestätigung
- Mobile-Web/Preview verwendet die jeweilige `/auth`-Route der laufenden `cloudlearn`-Instanz
- `cloudlearn` ist Preview-/Mobile-Web-Fläche, nicht die kanonische Produktions-Domain.
- Mobile-Web/Preview darf OAuth verwenden, soll aber denselben Kontostand wie die App abbilden.

### Site URL

- Produktionswert: `https://clearn-web.vercel.app`
- Preview-URL nur ergänzen, wenn ein konkreter Testfall sie erfordert.

## Apple Sign-In

### Voraussetzungen

- App ID und Service ID vorhanden
- Sign In with Apple für dieselbe Bundle-ID aktiviert
- Return URL in Apple exakt auf Supabase gesetzt
- Supabase Apple Provider ist aktiviert
- dieselbe verifizierte E-Mail muss bei Apple und E-Mail/Passwort in dasselbe Konto führen

### Prüfen

- Bundle-ID stimmt mit Expo-/EAS-Konfiguration überein
- Team ID, Key ID und private Key sind in Supabase hinterlegt
- Apple-Login liefert nach Cancel keinen kaputten Session-State

## Google Sign-In

### Voraussetzungen

- OAuth Client für iOS
- OAuth Client für Android
- OAuth Client für Web / Supabase Redirect
- Supabase Google Provider ist aktiviert
- dieselbe verifizierte E-Mail muss bei Google und E-Mail/Passwort in dasselbe Konto führen

### Prüfen

- SHA-1 / SHA-256 für Android hinterlegt
- iOS URL Scheme korrekt gesetzt
- Supabase liefert nach erfolgreichem Login eine Session ohne Redirect-Schleife

## App-Seite

- Deep-Link-Rückkehr landet wieder in der App
- Native OAuth-Rückkehr nutzt bewusst die bestehende `/auth`-Route und keinen separaten Callback-Screen
- Nach erfolgreichem Login wird die Session im Store gesetzt
- Logout leert Session und queued Offline-Daten user-sicher
- Web/Preview nutzt dieselben Provider, aber die Session-Übergabe muss auch im Browser ohne App-Redirect sauber funktionieren.

## Definition of Done

- Apple Happy Path
- Google Happy Path
- gleiche E-Mail führt bei OAuth und E-Mail/Passwort zum selben Konto
- Cancel-Fall
- Fehler-Fall
- Logout und erneuter Login
- Rückkehr in Auth / Root ohne Redirect-Schleife
