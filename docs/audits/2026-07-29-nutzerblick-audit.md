# Nutzerblick-Audit clearn — 29.07.2026

Sechs Prüf-Durchgänge auf dem aktuellen Hauptstand, jeweils aus einer Nutzer-Rolle: neue Nutzerin, tägliche Lernerin, Pro-Zahler, Free am Limit, Randfall-Jäger, Produkt-Blick („was fehlt?"). Alles im Code belegt; bereits Erfasstes (#571, #595, #592/#596, #368) wurde ausgeschlossen. Sortierung: erst echte Fehler, dann Verlust-Momente, dann Erlebnis-Probleme, dann Vorschläge.

---

## A — Echte Fehler (sollten vor einem echten Start behoben sein)

### A1 Die App zwingt Pro-Nutzern die Gratis-Grenzen auf — mit stillem Karten-Verlust
Der Guthaben-Baustein (LpBadge) lädt beim Start Tarif und LP, aber NICHT die Grenzen — markiert den Speicher aber als „geladen". Die echte Grenzen-Abfrage im Scan steigt deshalb sofort aus. Folge für ein Pro-Konto (500 Decks / 2.000 Karten gekauft): Dauerbanner „25 von 20 Decks sind belegt", „Neues Deck" gesperrt, „Deck voll — hat bereits 150 Karten", und beim Import werden Karten CLIENTSEITIG auf 150 ausgedünnt, bevor der Server sie sieht („163 erkannt, 10 gespeichert"). Das Web macht es richtig (fehlende Grenzen = nichts sperren). Fundstellen: usageStore.ts:47-67, LpBadge.tsx:29-40, scan.tsx:110/252/608-610/645-684.

### A2 „300 LP jeden Monat" stimmt nur fürs Monatsabo
Die Gutschrift hängt allein an Kauf-/Verlängerungs-Signalen des Bezahldienstes; es gibt keinen monatlichen Zeitplan (kein Cron; grantMonthlyLp hat keinen Aufrufer). Jahresabo („Bestes Preis-Leistungs-Verhältnis"!) bekäme 300 LP pro JAHR statt 3.600; Lifetime bekäme 0 — sein Kauf-Signal steht nicht in der Gutschrift-Liste. Fundstellen: webhook/route.ts:24-27+93-112, vercel.json, lpService.ts:242.

### A3 Ein Datenbank-Schluckauf macht Pro für diesen Moment zu Free
getSubscriptionStatus fällt bei JEDEM Lesefehler auf „free" zurück: doppelte LP-Kosten (10 statt 5), 402-Paywall bei Occlusion, Statistik auf 7 Tage geklemmt. Einzige fail-closed-Stelle im Projekt. Fundstelle: db.ts:1184.

### A4 Lifetime ist an vier Stellen vergessen
Rate-Limit prüft `plan === "pro"` per String — der 89,99-€-Käufer bekommt das Free-Limit (4 Routen: scan/process, import/pdf, import/url, import/save). Profil der App zeigt roh „lifetime" (Web korrekt „Lifetime"); Paywall etikettiert ihn als „Pro"; kein „Abo verwalten"-Knopf für ihn.

### A5 Gelöschte Karte auf Gerät A → Gerät B wirft eine ganze Runde still weg
Der Server antwortet sauber 404 CARD_NOT_FOUND; Web (.catch leer) und App (404 wird weder wiederholt noch eingereiht, Hinweisbanner feuert nie) verschlucken ihn. Ergebnis: „Runde geschafft — 25 sicher gewusst" für 30 Karten, von denen KEINE verbucht wurde (kein Streak-Tag, kein Lernplan, 0 LP). Die Oberfläche behauptet das Gegenteil der Wahrheit. Fundstellen: reviewService.ts:106-109, learn-session.tsx:243-247, sendReview.ts:24-52.

### A6 „Deck bearbeiten" in der App löscht still alle Schlagwörter
Der Deck-Bildschirm kennt die Tags nicht (startet mit []), das Bearbeiten-Fenster speichert Titel + tags:[] — jede Titelkorrektur löscht die Deck-Tags. Sichtbar u. a. daran, dass im Web das „KI-erstellt"-Abzeichen verschwindet. Ein-Zeilen-Ursache: deck/[id].tsx:364/1221 + DeckEditModal.tsx:84-93.

### A7 Decks über 1.000 Karten: Kartenliste kappt still
listCardsForDeck lädt ohne Seiten-Mechanik; die Datenbank-Schnittstelle liefert max. 1.000 Zeilen. Pro erlaubt 2.000: Kachel sagt „1.500 Karten", Deckseite zeigt 1.000 — Karte 1.001+ ist unsichtbar, unlernbar, unlöschbar. Der passende Helfer (selectAllRows) existiert und wird hier nicht benutzt. db.ts:415-435 vs. 756-791.

### A8 Fällig-Zähler widersprechen sich ab 1.000 fälligen Karten
Home zählt exakt in der Datenbank; Bibliothek/Ordner summieren die (bei 1.000 gekappte) Vollliste — und ziehen dafür bei jedem Öffnen den kompletten Kartentext über die Leitung. Eigener Zähl-Endpunkt je Deck fehlt. db.ts:537-584, decks.tsx:104-108, dashboard/page.tsx:99-108.

### A9 Streak-Anzeige rechnet in Geräte-Zeit, der Server in Berlin-Zeit
Wer im Ausland lernt (oder das Gerät falsch steht), sieht 6 Stunden am Tag eine falsche Flamme/„Lerne heute!"-Aufforderung und im Kalender die falsche „heute"-Zelle. Das richtige Muster (Europe/Berlin pinnen) steht im selben Repo. index.tsx:151, streak-calendar beidseitig.

### A10 Sonstige echte Fehler (je klein)
- LP-Pille aktualisiert sich nach einer Bild-Verdecken-Runde nicht (occlusion.tsx ruft setUsage nie; alle anderen Modi tun es) — und zeigt offline erfundene „10 LP" (Startwert, Fehler verschluckt).
- App-Karteneditor ohne Doppeltipp-Schutz → doppelte Karten (saving wird gesetzt, nie gelesen); Web korrekt gesperrt.
- Fünf App-Fenster ohne onRequestClose → Android-Zurück tot (Karteneditor, Deck-Details, Deck-Edit, Deck-/Ordner-Picker).
- Deck-Auswahl beim Scan-Speichern als Alert: nur 8 Decks, auf Android real ~2 + Abbrechen (bekanntes #396-Muster).
- Bestenliste ohne zweiten Sortier-Schlüssel: Bei LP-Gleichstand springen Ränge/Podest beim Neuladen.
- Web-Ordner-Auswahl-Modal ohne max-height/Scroll: ab ~15 Ordnern ragt es aus dem Bildschirm, „Abbrechen" unerreichbar (nur Escape rettet).
- „Details"-Fenster zählt Bild-Karten mit („30 Karten"), Kopfzeile daneben sagt „20 Karten · 10 Bild-Karten".
- Deck-/Ordner-TITEL haben serverseitig keine Längen-Grenze und keinen trim; App-Eingaben ohne maxLength → 5.000-Zeichen-Titel möglich, Web rendert ihn ungeklemmt.
- App-Deckseite merkt Umbenennung vom anderen Gerät nie (Titel kommt aus dem Routen-Parameter).
- Web-Kartenliste zeigt weiterhin rohen Lücken-Code/Bild-Markdown (#591 hat nur die Lernmodi angeglichen); App-Kartenliste etikettiert Bild-Karten als „Basic".
- „Alle (N)" im Quiz-Setup zählt nur zweiseitige Karten, die Fragen-Erzeugung hält sich nicht daran.
- Toter Meilenstein dailyGoalBonus: Web bietet earnLp("dailyGoal") an, der Server-Vertrag erlaubt nur "session" → garantierter Fehler.
- Web-Meilensteine generell: claimMilestone wird im Web NIE aufgerufen — Web-Nutzer bekommen keinen der beworbenen Boni; die App löst nur first_review ein (first_deck-Text ist tot).

---

## B — Datenverlust-Momente (bezahlte/mühsame Arbeit ohne Sicherung)

1. **Scan-Vorschau** lebt nur im Arbeitsspeicher: Tab zu, App im Hintergrund beendet, versehentliche Navigation → bezahlte Karten weg, ohne Frage. (Nur „Verwerfen"/„Neuer Scan" sind abgesichert.) Vorschlag: Entwurf lokal ablegen und als „unfertiger Import" wieder anbieten — Muster existiert (Lernstand-Merker).
2. **Occlusion-Editor**: „Zurück zum Deck"-Link, „Bereiche löschen", „Anderes Bild" — alle verwerfen gezeichnete Kästchen sofort; kein beforeunload, in der App kein Verlassen-Schutz (usePreventRemove existiert im Projekt).
3. **Web-Karteneditor**: Escape oder Klick daneben wirft den getippten Text weg — kein „Verwerfen?".
4. **Web-Runden über Navigation verlassen**: Lückentext/Karteikarten/Quiz spülen die letzte gepufferte Bewertung und die Runden-LP nur am „Beenden"-Knopf; die App macht es beim Verlassen immer, der Web-TEST kann es auch (beforeunload). (Quiz-Teil bereits in #595 Punkt 8 — Lückentext/Karteikarten fehlen dort.)

---

## C — Der erste Eindruck (neue Nutzerin)

1. **Nach dem Onboarding gibt es keinen auffindbaren Lern-Einstieg.** Der globale Lern-Bildschirm ist aus der Tab-Leiste geparkt; Home fordert dreimal zum Lernen auf (Streak-Banner, „N fällig ›", „0/30 Karten") — kein Hinweis führt in eine Runde; „N fällig" endet in der Bibliothek. Web endet nach dem Onboarding ohne jede erste Runde. Vorschlag: „Jetzt lernen (N fällig)"-Knopf auf Home beidseitig; Banner/Kacheln dorthin verlinken.
2. **Der erste Fehler antwortet mit Technik:** verwackeltes Foto → „Gemini API error 400: {…}", zu langer Text → roher Validierungs-Block, Scan-PDF → „…werden im MVP noch nicht unterstützt", großes Foto → „API error 413" (App verkleinert nicht — das Web tut es). Vorschlag: Fehlercodes in der App auf verständliche Sätze mit Ausweg abbilden; Bild verkleinern; Textfeld 20.000-Grenze + Zähler.
3. **Lernpunkte sind beim ersten Ausgeben unerklärt:** Start 10 LP, erster Scan kostet 10, danach 0 — Onboarding erwähnt LP nie, Kosten-Knöpfe zeigen „⚡ 10" ohne Einheit, und das „Nicht genug LP"-Fenster bietet nur Werbung/Kauf/Pro an — der Gratis-Weg („1 LP je gelernter Karte") steht nur im Web. URL/PDF sind fürs Startguthaben von Anfang an unbezahlbar, ohne Hinweis.
4. Weitere Erste-Tage-Funde: Registrier-Abbrüche heißen alle „Fehler"; Geschlecht ist Pflicht ohne „keine Angabe"; „Supabase"/„Projekt" in Fehlermeldungen; Face-ID-Hinweis auch auf Android; keine Datenschutz-/AGB-Links am Registrierformular; Web-Bestätigungsseite kennt nur die App („Öffne die clearn-App") und widerspricht der zugesagten Auto-Anmeldung; abgelaufener Web-Anmeldelink antwortet englisch (Übersetzer existiert, wird dort nicht genutzt); Gastmodus ist eine Attrappe (jeder Tab verlangt ein Konto, kein Demo-Deck); Onboarding ohne Zurück/Überspringen, ohne LP-Wort, nennt „Gewusst" was die App „GEMERKT" nennt, erklärt die vier Knöpfe nie; Beispielkarten bleiben ewig „fällig"; keine Hilfe/FAQ danach; „Erste Review-Session!"-Toast (Denglisch) verschwindet nach 4 s; Scan-Vorschau zeigt Datenbankwörter („basic", „medium", „via heuristic-fallback"); „Speichern & Lernen" lernt nicht; App-Textfeld frisst Leerzeichen am Ende (normalize bei jedem Tastendruck); Erfolgs-Alert mit einem Knopf, auf Android wegtippbar → Sackgasse; leere Bildschirme ohne Weiter-Knopf („Neu laden"); Fachwörter unerklärt (Kartenquelle, Wackelkandidaten, Occlusion, FSRS auf der Landingpage); Landingpage nennt „clearn-web.vercel.app" und „TestFlight".

---

## D — Der Alltag (tägliche Lernerin)

1. **Kein Lernmodus merkt sich seine Einstellungen** (Richtung, Genau prüfen, Kartenquelle, Anzahl, Auf Zeit — 4 Modi × 2 Plattformen, alles flüchtig). Besonders bitter: „Genau prüfen" ist AN, während das Tippfeld die Großschreibung unterdrückt — „hund" zählt als falsch. Vorschlag: je Modus+Deck lokal merken; Strict-Voreinstellung überdenken oder „Fast — Groß/klein"-Zustand.
2. **„Nur fällige" existiert als Kartenquelle nicht**; der Deck-Lernmodus lädt immer ALLE Karten. Vier Tipper bis zur Runde — und dann ist es die falsche Menge. Vorschlag: vierte Quelle „Nur fällige (N)", vorausgewählt; Home-Kachel direkt in die Runde.
3. **Der offene Web-Tab lädt beim Zurückwechseln nie nach** (kein focus/visibility-Horcher im ganzen Web) — nach dem Handy-Lernen zeigt der Laptop alte Zahlen; die Web-Streak-Kachel „brennt" zudem immer, auch wenn heute nichts gelernt wurde (App unterscheidet kalt/warm).
4. **Lernstand-Merker ist geräte-lokal** — der Laptop beginnt bei Karte 1 und bewertet die ersten 40 Karten doppelt (genau das, wovor der Merker schützen soll). Vorschlag: serverseitig am Profil.
5. **Tastatur im Web**: kein Bewerten per 1–4; nach Klick auf „Gut" bewertet die Leertaste die nächste Karte UNGESEHEN (Fokus bleibt auf dem Knopf); im Lückentext bricht der Tippfluss nach jeder Antwort (Enter prüft, „Weiter" braucht die Maus — auch in der App).
6. Weitere Alltags-Funde: Karten aus der Runde heraus nicht korrigierbar (Stern ist die einzige Aktion; in Quiz/Test/Zuordnen/Lückentext nicht mal der); Kartenliste ohne Suchfeld, Suchtreffer springt nur zur Deck-Wurzel; App-Statistik-Tab lädt genau einmal (kein Fokus-Reload, kein Ziehen); Tagesziel taucht beim Lernen nie auf (kein „28/30 — noch 2"); App-Ordner „Alle lernen" lernt nur Fällige und endet sonst in einer Sackgassen-Meldung (Web hat beide Knöpfe); kein Gedächtnis für den zuletzt genutzten Modus; Vorlese-Geschwindigkeit wird nie gemerkt; Web lädt bei jedem Rundenstart die ganze Deck-Liste nur für Vorlese-Sprachen; dueCount im Store wird geschrieben, nie gelesen (Tab-Abzeichen wäre fast geschenkt).

---

## E — Grenzen & LP (Free am Limit)

1. **Jede Grenze außerhalb des Imports endet in „Bitte versuche es erneut."** — Web-Deck-Anlegen, Duplizieren (beidseitig), geteiltes Deck übernehmen, Karte von Hand am vollen Deck. Der Server schickt überall den ehrlichen deutschen Satz mit; die Clients ersetzen ihn durch einen Rat, der nie funktioniert. (Der im Code versprochene Berater adviceForLimit() existiert nicht.) Vorschlag: Grenz-Fehler erkennen und Server-Klartext + Ausweg zeigen — Bausteine (isPlanLimitError, planLimitMessage) existieren.
2. **Duplizieren/Übernehmen umgeht die 150er-Grenze**: ein geteiltes 800-Karten-Deck landet voll im Free-Konto und ist danach für alles andere „voll".
3. **Füllstand ist unsichtbar**: nirgends „19 von 20 Decks", nirgends „142 von 150 Karten" außer in der Import-Zielwahl; „+ Karte" scheitert statt vorher zu deaktivieren.
4. **Tagesdeckel beim Lernen**: die App sagt es in 5 von 6 Modi nie (Web überall; App-Occlusion kann es — Muster fertig). Der fertige Satz „Heute verdient: N / Cap" liegt ungenutzt im Wörterbuch.
5. **Werbe-Weg ist abgeschaltet, wird aber versprochen**: Das „Nicht genug LP"-Fenster wirbt mit „+5 LP sofort" (Chip „+5"), die Attrappe liefert 0 und sagt dann „noch nicht aktiv"; das Web schickt Nutzer für diesen toten Weg extra in die App; der 0/20-Balken wirkt wie ein Versprechen. (Der LP-Shop daneben macht es ehrlich.)
6. App warnt vor zu wenig LP nur gegen den billigsten Preis (bei 12 LP + 20-LP-PDF: keine Warnung, Upload läuft, dann 402); Streak-Reparatur (40 LP) fragt ohne Kontostand und endet bei Ebbe ohne Ausweg; „Jetzt LP verdienen" im Shop enthält nur den (toten) Werbe-Weg — Lernen fehlt.

---

## F — Pro-Erlebnis (zusätzlich zu A1–A4)

- Das „Nicht genug LP"-Fenster hat keine Tarif-Prüfung: bietet Pro Werbung (bringt ihm 0) und „Auf Pro upgraden" an; die Paywall begrüßt ihn mit „Upgrade erforderlich — Du hast dein Free-Limit erreicht" (Titel „Upgrade").
- LP-Shop rechnet Packs hart durch 10: Pro sieht „~30 KI-Scans" für 300 LP — wahr sind 60 (Web rechnet tarifbewusst).
- „Käufe wiederherstellen" gibt es nur, solange der Server ihn für Free hält; es gibt keinen Weg, ein Kauf-Signal manuell vom Gerät zum Server zu bringen (Webhook verloren = dauerhaft Free, nach 9 s Polling); TRANSFER-Ereignisse (Gerätewechsel/Family) kennt der Webhook nicht.
- Ablauf-/Verlängerungsdatum wird nirgends angezeigt; BILLING_ISSUE wird empfangen und nie gezeigt.
- Anki-Export: Server-Route fertig und Pro-gegatet, kein Client-Knopf — und der Inhalt wäre eine JSON-Attrappe mit falscher Endung.
- „Werbefrei" entfernt derzeit nichts (es gibt keine Werbung außer der freiwilligen, abgeschalteten Belohnungs-Werbung).
- Zwei Web-Stellen fallen bei unbekanntem Tarif zu (Pro-Seite zeigt Kauf-Hinweis, Wackelkandidaten bleiben gesperrt); „Pro-Vorteile schaltest du in der App frei" steht auch bei Pro-Konten.
- Occlusion trägt dauerhaft ein „Pro"-Schild — auch für Pro.

---

## G — Was dem Produkt fehlt (Top-Vorschläge, im Code verankert)

| Rang | Vorschlag | Aufwand | Fundament |
|---|---|---|---|
| 1 | Papierkorb / Rückgängig nach Löschen (30 Tage) | klein–mittel | deleted_at existiert überall; nur „Wiederherstellen"-Weg fehlt; kein Purge-Job |
| 2 | Karten verschieben + Mehrfachauswahl (+ Decks zusammenlegen) | klein–mittel | updateCard braucht nur deck_id; softDeleteCardsByIds existiert ohne Route; Picker fertig |
| 3 | Echter Export: CSV/Text je Deck + „Meine Daten" (DSGVO) | klein | exportDeckForOffline liefert alles; NICHT hinter Pro sperren |
| 4 | Bibliothek sortieren (Fällige zuerst/zuletzt gelernt/A–Z) + Tagespensum statt Kartenmauer (Fällig-Limit aus Tagesziel) | klein | Daten liegen alle vor; Tagesziel bewirkt erstmals etwas |
| 5 | Notizfeld je Karte + „Karte taugt nichts" melden mit KI-Neuformulierung | klein/mittel | extra_data jsonb vorhanden; cardQuality + LLM + LP-Verrechnung vorhanden; Feedback braucht echte Tabelle |
| 6 | Listen-Import ohne KI und ohne LP („Vorderseite;Rückseite" einfügen) | klein | import/save nimmt fertige Karten; nur Parser fehlt |
| 7 | E-Mail-Adresse ändern (+ Passwort ändern ohne Mail-Zugriff bedenken) | klein | Supabase-Fluss komplett; nur UI fehlt |
| 8 | Lernzeit gesamt (+ im Web) und „beste Lernzeit 17–19 Uhr" | klein | duration_ms wird erhoben und weggeworfen; Berlin-Zeit-Muster existiert |
| 9 | Deck-Reife + Fälligkeits-Vorschau („bei diesem Tempo Freitag durch") — Grundlage für Prüfungstermin-Bezug | mittel | fsrs_state/stability/due liegen auf jeder Karte, verlassen die DB nie |
| 10 | E-Mail-Erinnerung/Wochenrückblick (opt-in) — einziger Kanal ohne App | mittel | Auswertung + Cron fertig; Versanddienst fehlt (kein E-Mail-Kanal im Produkt) |
| 11 | Ergebnis teilen („42 Karten, 87 %, Tag 12") | klein | Share-Muster beidseitig vorhanden |
| 12 | Geteilte Decks: „Original hat 8 neue Karten — übernehmen?" | mittel | source_deck_id wird geschrieben und nie gelesen |
| 13 | Karten-Schlagwörter sichtbar machen (Kapitel-Filter) | klein | Server trägt tags voll; Clients senden hart [] |
| 14 | Deck-Beschreibung (für geteilte Decks) | klein | Spalte existiert; Ordner-Muster 1:1 übertragbar |
| 15 | Lernfortschritt zurücksetzen / Karte pausieren | klein | Rücksetz-Wertesatz steht in duplicateDeck |
| 16 | Geräte-Übersicht im Profil („iPhone, zuletzt heute") | klein | push_tokens hat platform + updated_at |

Tote Bausteine, die eine Entscheidung brauchen: courses/course_decks (Tabellen ohne Code), decks.description/cover_image_url/is_public (nie gemappt), betaFeedbackService (In-Memory-Attrappe, unverdrahtet — der einzige „Melden"-Weg im Produkt), ankiExportService (Attrappe), source_deck_id (geschrieben, nie gelesen), diverse tote i18n-Schlüssel; README-API-Baum hinkt den echten Routen hinterher.

---

## H — Barrieren (Auswahl)

- Web-Modale: keine Fokus-Falle, kein Startfokus, keine Fokus-Rückgabe; Menü ohne Escape/Pfeiltasten.
- Multiple-Choice-Ergebnis nur über Farbe + aria-hidden-Icons — für Screenreader unsichtbar; keine Live-Region.
- Suchfeld der Bibliothek ohne zugänglichen Namen; Platzhalter-/Hinweis-Grau unter AA-Kontrast (hell ≈ 2,6:1); ausgegraute Modus-Kacheln drücken den Begründungs-Satz auf ~2,7:1.
- Kartentexte/Namen im Web ohne Zeilen-Klemmung (App hat sie) — Extremtexte sprengen Listen.
