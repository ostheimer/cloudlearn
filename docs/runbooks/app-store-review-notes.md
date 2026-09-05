# App Store Review Notes

Stand: 2026-09-05 (Werbe-Scope aktualisiert; übrige Funktionen vor Einreichung am Release-Build prüfen)

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

Rewarded Ads sind in diesem Release deaktiviert (`REAL_ADS_ENABLED=false`).
Die App bietet keine Werbeaktion zum Verdienen von LP und simuliert keine Werbung.
Die Tracking-Einstellungen im Profil und der ATT-Opt-in bleiben vorhanden;
eine gespeicherte Zustimmung aktiviert keine Werbeauslieferung.
Der Werbe-Hook löst bei deaktivierten Ads keinen ATT-Dialog aus.
Die Datenschutzangaben sind vor Einreichung anhand des tatsächlichen Release-Builds
und seiner SDKs zu prüfen; der deaktivierte Werbe-Scope allein belegt nicht „kein Tracking“.

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
