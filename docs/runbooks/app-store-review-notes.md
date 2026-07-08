# App Store Review Notes

Stand: 2026-05-02

## Ziel

Diese Vorlage fasst zusammen, was Apple/Google Reviewer vor der Einreichung wissen sollen.
Sie ist absichtlich knapp und kann direkt in App Store Connect / Play Console übertragen werden.

## Reviewer Notes — Entwurf

`clearn` ist eine Lern-App, die aus Fotos, Texten, URLs und PDFs Karteikarten erzeugt und diese mit Wiederholungslogik zum Lernen bereitstellt.

### Zugang

- Die App kann zuerst ohne Konto geöffnet werden.
- Scan, Synchronisierung, Lernfortschritt und Käufe benötigen danach ein Konto.
- Unterstützte Login-Methoden für v1:
  - E-Mail/Passwort
  - Apple Sign-In
  - Google Sign-In
- Demo-Konto für Review:
  - E-Mail: `<REVIEW_EMAIL>`
  - Passwort: `<REVIEW_PASSWORD>`
  - Vorbereitung: [docs/runbooks/reviewer-demo-account.md](/docs/runbooks/reviewer-demo-account.md)

### Kernflow für Reviewer

1. App öffnen.
2. Optional ohne Konto starten und Home/Decks/Lernen ansehen.
3. Mit Demo-Konto anmelden.
4. `Scan` öffnen und Text eingeben oder Foto/PDF importieren.
5. Karten erzeugen.
6. `Lernen` öffnen und eine kurze Review-Session abschließen.
7. Profil öffnen und Datenschutz, Support, Tracking-Einstellungen, Face ID und Konto-Löschung prüfen.

### Passwort zurücksetzen

Die Passwort-Zurücksetzung läuft über Supabase-E-Mail-Links.
Der Link öffnet die App über `clearn://` und zeigt den Screen `Neues Passwort setzen`.

### In-App-Käufe

`clearn` nutzt RevenueCat für Store-Produkte und Entitlements.

- Pro-Monatsabo: `ai.clearn.pro.monthly`
- Pro-Jahresabo: `ai.clearn.pro.annual`
- Lifetime-Kauf: `ai.clearn.lifetime`
- Entitlements:
  - `pro`
  - `lifetime`

Die App bietet Restore und Store-Abo-Verwaltung im Profil bzw. in der Paywall an.

### Werbung und Tracking

Rewarded Ads sind Teil des Launch-Scopes.
Ohne ATT-Opt-in zeigt die App nur nicht-personalisierte Rewarded Ads.
Personalisierte Werbung und darüber hinausgehendes Tracking werden erst nach expliziter Zustimmung aktiviert.
Der native ATT-Dialog erscheint nicht direkt beim ersten App-Start, sondern kontextuell vor einem relevanten Werbe-/Tracking-Moment.

### Konto-Löschung

Nutzer können ihr Konto im Profil löschen.
Die Löschung ist sofortig und endgültig und entfernt Konto, Decks, Karten, Reviews, Scans und Lernfortschritt.
Ein aktives Apple- oder Google-Abo wird dabei nicht automatisch beendet; die App weist vor der Löschung darauf hin.

## Vor Submission ausfüllen

- `<REVIEW_EMAIL>`
- `<REVIEW_PASSWORD>`
- Hinweis, ob Reviewer ein aktives Sandbox-Abo testen sollen
- aktueller TestFlight-Build / Build-Nummer
- bekannte Einschränkungen für den Review-Build
