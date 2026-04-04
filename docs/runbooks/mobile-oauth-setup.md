# Mobile OAuth Setup

## Ziel

Apple- und Google-Sign-In für `cloudlearn` so konfigurieren, dass Mobile-App, Web-Preview und Supabase-Redirects konsistent funktionieren.

## Supabase

### Redirect URLs

- `clearn://auth/callback`
- `https://cloudlearn.vercel.app/auth`
- Preview-Domain nur dann hinzufügen, wenn der OAuth-Provider Wildcards nicht unterstützt.

### Site URL

- Produktionswert: `https://cloudlearn.vercel.app`

## Apple Sign-In

### Voraussetzungen

- App ID und Service ID vorhanden
- Sign In with Apple für dieselbe Bundle-ID aktiviert
- Return URL in Apple exakt auf Supabase gesetzt

### Prüfen

- Bundle-ID stimmt mit Expo-/EAS-Konfiguration überein
- Team ID, Key ID und private Key sind in Supabase hinterlegt
- Apple-Login liefert nach Cancel keinen kaputten Session-State

## Google Sign-In

### Voraussetzungen

- OAuth Client für iOS
- OAuth Client für Android
- OAuth Client für Web / Supabase Redirect

### Prüfen

- SHA-1 / SHA-256 für Android hinterlegt
- iOS URL Scheme korrekt gesetzt
- Supabase Google Provider aktiviert

## App-Seite

- Deep-Link-Rückkehr landet wieder in der App
- Nach erfolgreichem Login wird die Session im Store gesetzt
- Logout leert Session und queued Offline-Daten user-sicher

## Definition of Done

- Apple Happy Path
- Google Happy Path
- Cancel-Fall
- Fehler-Fall
- Logout und erneuter Login
- Rückkehr in Auth / Root ohne Redirect-Schleife
