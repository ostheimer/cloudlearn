# App Store Connect Fill-In Pack

Stand: 2026-05-06

## Ziel

Diese Datei ist das Copy/Paste-Paket für die App-Store-Connect-Seite von `clearn`.
Sie bündelt die Felder, die auf der Version-1.0-Seite und den angrenzenden
App-Store-Bereichen einzutragen sind.

Nicht auf `Zur Prüfung hinzufügen` klicken, bevor die offenen Punkte im
Abschnitt [Vor Review-Submission](#vor-review-submission) erledigt sind.

## Kanonische App-Daten

- App-Name: `clearn`
- Bundle ID: `app.clearn`
- SKU: `app.clearn`
- App Store Connect App ID: `6766691399`
- Primäre Sprache: Deutsch
- Kategorie: Bildung
- Anbieter: Ostheimer OG
- Copyright: `2026 Ostheimer OG`
- Support-URL: `https://clearn-web.vercel.app/support`
- Marketing-URL: `https://clearn-web.vercel.app`
- Datenschutz-URL: `https://clearn-web.vercel.app/privacy`
- Impressum/Kontakt: `https://clearn-web.vercel.app/impressum`

## Version 1.0 — Deutsch

### Werbetext

```text
Fotografiere Lernmaterial, erstelle Karteikarten und wiederhole sie direkt auf deinem iPhone.
```

### Beschreibung

```text
clearn ist für alle gedacht, die Lernstoff schnell in wiederholbare Karteikarten verwandeln möchten.

Scanne Lernmaterial, importiere Text oder nutze PDFs, um daraus Karten zu erstellen. Danach kannst du deine Decks organisieren, fällige Karten lernen und deinen Fortschritt über Tagesziele und Streaks verfolgen.

Wichtige Funktionen:

- Karteikarten aus Fotos, Texten, URLs und PDFs erstellen
- Decks und Karten übersichtlich organisieren
- Fällige Karten in kurzen Sessions lernen
- Fortschritt, Tagesziel und Streak verfolgen
- Optional mit Face ID lokal schützen
- Mit Konto über Geräte hinweg synchronisieren

clearn kann zuerst ohne Konto ausprobiert werden. Für Scans, Synchronisierung, Lernfortschritt und Käufe ist danach ein Konto erforderlich.
```

Hinweis: Vor Submission die PDF-/URL-Claims nur beibehalten, wenn der hochgeladene
Build diese Flows stabil abdeckt. Sonst die Beschreibung enger auf Foto/Text
formulieren.

### Keywords

```text
karteikarten,lernen,schule,studium,prüfung,flashcards,ocr,notizen,wissen,quiz
```

### Support-URL

```text
https://clearn-web.vercel.app/support
```

### Marketing-URL

```text
https://clearn-web.vercel.app
```

## App-Informationen

### Untertitel

```text
Aus Fotos Karteikarten machen
```

### Kategorie

- Primär: Bildung
- Sekundär: Produktivität oder keine sekundäre Kategorie

### Inhaltsrechte

Vorschlag: `Nein`, sofern keine fremden, lizenzierten Inhalte in der App selbst
ausgeliefert werden. Nutzerimportierte Inhalte zählen nicht als App-eigene
lizenzierte Inhalte.

### Altersfreigabe

Die Altersfreigabe nicht manuell raten, sondern über den App-Store-Connect-
Fragebogen erzeugen. Erwartung für den aktuellen Scope ist eine niedrige
Freigabe, solange keine frei zugänglichen Community-Inhalte, Chats oder
ungefilterten UGC-Flows enthalten sind.

## Screenshots

### Upload-Regel

- App Store Connect verlangt 1 bis 10 Screenshots pro relevanter Lokalisierung.
- Formate: `.png`, `.jpg` oder `.jpeg`.
- Für die aktuell sichtbare iPhone-Version-1.0-Seite werden Portrait-Sizes wie
  `1242 x 2688` oder `1284 x 2778` akzeptiert.
- Apple listet für neue 6.9-Zoll-iPhones zusätzlich größere Portrait-Sizes
  wie `1260 x 2736`, `1290 x 2796` und `1320 x 2868`.
- Falls die UI über Gerätegrößen hinweg gleich ist, reicht laut Apple die
  höchste benötigte Auflösung; App Store Connect skaliert dann für kleinere
  Größen.

### Shotlist für v1

1. Home: Tagesziel, Streak und `Karten lernen`
2. Scan: Foto/Text/PDF-Einstieg mit klarer Konto- oder Scan-Kommunikation
3. Karten-Erstellung: erkannter Text oder Import-Ergebnis vor dem Speichern
4. Lernen: Karten-Review mit Antwort/Feedback-Aktion
5. Bibliothek: Decks und Fortschritt
6. Profil: Konto, Face ID, Datenschutz, Support und Abo-Verwaltung
7. Paywall: Pro-/Lifetime-Angebot mit Restore
8. Onboarding oder Login: `Erst einmal ohne Login starten` und Login-Optionen

### Captions

```text
Foto aufnehmen und Lernmaterial erfassen
Aus Text automatisch Karteikarten erstellen
Fällige Karten in kurzen Sessions lernen
Decks und Fortschritt im Blick behalten
Konto, Datenschutz und Face ID verwalten
```

## App-Datenschutz

Vor dem Privacy Questionnaire ein echtes iOS-Archive bauen und den Privacy Report
gegen [docs/runbooks/app-store-privacy-ads.md](/Users/andreasostheimer/Documents/GitHub/cloudlearn/docs/runbooks/app-store-privacy-ads.md)
prüfen.

Wichtig für die Antworten:

- Nicht `kein Tracking` angeben, solange personalisierte Werbung nach ATT-Opt-in
  technisch möglich ist.
- Google Mobile Ads und Google User Messaging Platform müssen mitgedacht werden.
- Ohne ATT-Opt-in zeigt die App nur nicht-personalisierte Rewarded Ads.
- ATT wird erst kontextuell vor einem relevanten Werbe-/Tracking-Moment gefragt,
  nicht beim ersten App-Start.

## Review Notes

Direkt übernehmen und vor Submission die Platzhalter ersetzen:

```text
clearn ist eine Lern-App, die aus Fotos, Texten, URLs und PDFs Karteikarten erzeugt und diese mit Wiederholungslogik zum Lernen bereitstellt.

Die App kann zuerst ohne Konto geöffnet werden. Scan, Synchronisierung, Lernfortschritt und Käufe benötigen danach ein Konto.

Demo-Konto:
E-Mail: <REVIEW_EMAIL>
Passwort: <REVIEW_PASSWORD>

Kernflow:
1. App öffnen.
2. Optional ohne Konto starten und Home/Decks/Lernen ansehen.
3. Mit dem Demo-Konto anmelden.
4. Scan öffnen und Text eingeben oder Foto/PDF importieren.
5. Karten erzeugen.
6. Lernen öffnen und eine kurze Review-Session abschließen.
7. Profil öffnen und Datenschutz, Support, Tracking-Einstellungen, Face ID und Konto-Löschung prüfen.

Passwort-Zurücksetzung:
Die Passwort-Zurücksetzung läuft über Supabase-E-Mail-Links. Der Link öffnet die App über clearn:// und zeigt den Screen "Neues Passwort setzen".

In-App-Käufe:
clearn nutzt RevenueCat für Store-Produkte und Entitlements.
- ai.clearn.pro.monthly
- ai.clearn.pro.annual
- ai.clearn.lifetime

Werbung und Tracking:
Ohne ATT-Opt-in zeigt die App nur nicht-personalisierte Rewarded Ads. Personalisierte Werbung und darüber hinausgehendes Tracking werden erst nach expliziter Zustimmung aktiviert.

Konto-Löschung:
Nutzer können ihr Konto im Profil löschen. Die Löschung ist sofortig und endgültig und entfernt Konto, Decks, Karten, Reviews, Scans und Lernfortschritt. Ein aktives Apple- oder Google-Abo wird dabei nicht automatisch beendet; die App weist vor der Löschung darauf hin.
```

## Vor Review-Submission

- [ ] Screenshots für Deutsch hochladen.
- [ ] Beschreibung/Keywords/Support-URL/Marketing-URL eintragen.
- [ ] App-Datenschutz-Fragebogen ausfüllen.
- [ ] Preis und Verfügbarkeit setzen.
- [ ] In-App-Käufe/Abos in App Store Connect anlegen.
- [ ] RevenueCat Offerings mit den Store-Produkten verknüpfen.
- [ ] Production- oder TestFlight-Build hochladen und in Version 1.0 auswählen.
- [ ] Reviewer-Demo-Konto eintragen.
- [ ] Review Notes mit Build-Nummer und bekannten Einschränkungen finalisieren.
- [ ] TestFlight-Smoke auf echtem iPhone bestehen.

## Quellen

- Apple App Store Connect: Screenshot-Spezifikationen
  `https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications`
- Apple App Store Connect: App Previews und Screenshots hochladen
  `https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots`
- Apple App Store Connect: Platform Version Information
  `https://developer.apple.com/help/app-store-connect/reference/platform-version-information`
