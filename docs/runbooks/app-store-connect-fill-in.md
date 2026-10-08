# App Store Connect Fill-In Pack

Stand: 2026-09-22

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
- Anbieter/Verkäufername: Andreas Ostheimer
- Copyright: `2026 Andreas Ostheimer`
- Support-URL: `https://clearn-web.vercel.app/support`
- Marketing-URL: `https://clearn-web.vercel.app`
- Datenschutz-URL: `https://clearn-web.vercel.app/privacy`
- Impressum/Kontakt: `https://clearn-web.vercel.app/impressum`

Der Anbieter-/Verkäufername wird bei der aktuellen persönlichen
Apple-Developer-Mitgliedschaft durch den gesetzlichen Namen des Mitglieds
bestimmt und ist daher für diesen Release `Andreas Ostheimer`.

Andreas Ostheimer hat für diesen Release den Copyright-Eintrag
`2026 Andreas Ostheimer` festgelegt. Apple verlangt hier die Person oder
Rechtsperson, die die ausschließlichen Rechte an der App hält; dies folgt nicht
automatisch aus dem Apple-Verkäufernamen.

Quellen: [Apple zum Entwicklernamen](https://developer.apple.com/help/app-store-connect/create-an-app-record/set-your-developer-name),
[Apple zum Copyright-Feld](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information).

## Dashboard-Stand vom 22. September 2026

- Das Copyright-Feld der iOS-Version 1.0 ist in App Store Connect als
  `2026 Andreas Ostheimer` gespeichert.
- Der Vertrag für gebührenpflichtige Apps, das Bankkonto und W-8BEN werden in
  App Store Connect als aktiv angezeigt. DAC7 zeigt noch fehlende Informationen.
- Die Abo-Gruppe `clearn Pro` enthält `ai.clearn.pro.monthly` und
  `ai.clearn.pro.annual`. Beide Abos sind in allen 175 Regionen verfügbar,
  haben deutsche und US-englische Anzeigetexte und sind noch nicht zur Prüfung
  eingereicht. Der österreichische Basispreis beträgt 4,99 € pro Monat bzw.
  39,99 € pro Jahr. Das Monatsabo hat ein Einführungsangebot: die erste Woche
  kostenlos, ab 22. September 2026 ohne Enddatum in 175 Regionen.
  Beide Abos stehen in derselben Apple-Abo-Stufe 1, weil sie denselben
  Pro-Zugang mit unterschiedlicher Laufzeit gewähren.
- Der nicht verbrauchbare Kauf `ai.clearn.lifetime` ist in 175 Regionen
  verfügbar, hat deutsche und US-englische Anzeigetexte und einen
  österreichischen Basispreis von 89,99 €. Er ist noch nicht zur Prüfung
  eingereicht.
- Die Apple-In-App-Kauf-Integration zeigt derzeit **0 aktive Schlüssel**.
  Deshalb ist die echte Apple-App in RevenueCat noch nicht verbunden; dort
  existieren bislang nur die Entitlements `pro` und `lifetime` ohne Produkte.
  Erst nach der Apple-Verbindung können Store-Produkte und das Offering
  verknüpft und auf einem Gerät geprüft werden.

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

Für den ersten Upload ist die fokussierte 5er-Serie in
[docs/screens/app-store/README.md](/docs/screens/app-store/README.md)
priorisiert. Weitere Screenshots können danach ergänzt werden.

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
gegen [docs/runbooks/app-store-privacy-ads.md](/docs/runbooks/app-store-privacy-ads.md)
prüfen.

Der ausfüllbare Entwurf liegt in
[docs/runbooks/app-store-privacy-questionnaire.md](/docs/runbooks/app-store-privacy-questionnaire.md).

Wichtig für die Antworten:

- Rewarded Ads sind deaktiviert (`REAL_ADS_ENABLED=false`); die App bietet
  keine Werbeaktion zum Verdienen von LP und simuliert keine Werbung.
- Die Tracking-Einstellungen bleiben vorhanden und zeigen den deaktivierten
  Werbeumfang. ATT-Codefix und Production-Prebuild sind lokal geprüft; ein
  korrigierter signierter Store-Build und dessen IPA-Readback stehen noch aus.
- Google Mobile Ads und weitere enthaltene SDKs anhand des tatsächlichen
  Release-Builds prüfen. Nicht allein aus deaktivierten Ads auf `kein Tracking` schließen.

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
Rewarded Ads sind in diesem Release deaktiviert (REAL_ADS_ENABLED=false). Es gibt keine Werbeaktion zum Verdienen von LP und keine simulierte Werbung. Die Tracking-Einstellungen zeigen den deaktivierten Umfang. ATT-Codefix und Production-Prebuild sind lokal geprüft; eine frühere Zustimmung aktiviert keine Werbung. Vor der Einreichung muss der korrigierte signierte Store-Build bestätigen, dass keine ATT-Freigabe abgefragt wird.

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
