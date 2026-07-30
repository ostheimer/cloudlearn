# App vs. Web — Feinvergleich (28.07.2026)

Grundlage: der GitHub-Stand von heute Vormittag, von sieben Prüf-Helfern Bereich für Bereich gelesen (App-Texte über die Übersetzungsdatei aufgelöst, damit wirklich die deutschen Sätze verglichen wurden). Wichtig: Verglichen wurde der **Code** — auf dem iPhone fehlt zusätzlich alles, was seit dem letzten Build gemergt wurde.

Kategorien: **[Fehler]** inhaltlich falsch oder widersprüchlich · **[nur App]** / **[nur Web]** Funktion fehlt auf der anderen Seite · **[Verhalten]** gleiche Funktion, anderes Verhalten oder andere Zahlen · **[Wortlaut]** andere Sätze · **[Detail]** Kleinkram (Icon, Reihenfolge, Platzierung).

---

## Das Wichtigste in Kürze

1. **[Fehler] Lernpunkte-Untergrenze:** Das Web vergibt Lern-LP erst ab 5 gelernten Karten pro Runde, die App schon ab 1. Wer im Web nur 3 Karten lernt, bekommt nichts.
2. **[Fehler] Tippfehler-Toleranz:** Bei „Genau prüfen: aus" akzeptiert das Web bei 4–7 Buchstaben einen Tippfehler („Maus" statt „Haus" zählt als richtig), die App nicht. Dieselbe Antwort wird je nach Gerät anders bewertet — in Lückentext und schriftlicher Prüfung.
3. **[Fehler] „Schwer" zählt gegensätzlich:** In der App gilt „Schwer" als gewusst, im Web als nicht gewusst. Dieselbe Runde ergibt „10 von 10" (App) oder „0 sicher gewusst" (Web), und nur das Web bietet die Karten zum Nachüben an.
4. **[Fehler] Quiz-Abbruch verliert alles (App):** Die App meldet Quiz-Antworten erst am Rundenende — wer abbricht, verliert Streak, Statistik und LP. Das Web meldet jede Antwort sofort.
5. **[Fehler] Lückentext „Trotzdem richtig" (Web):** Das Web schickt erst „falsch", dann zusätzlich „richtig" — die Karte gilt als beides, der Lernplan wirft sie zurück. Die App ersetzt die Bewertung sauber (dort wurde genau dieser Fehler extra behoben).
6. **[Fehler] Veralteter LP-Text (Web):** Die Lernpunkte-Seite erklärt „Ab 5 Karten +5 LP" — der Server vergibt längst 1 LP je Karte.
7. **[Fehler] Falscher Empfehlungs-Text (Web-Profil):** „+50 LP, wenn dein Freund 7 Tage lernt" — tatsächlich gibt es die LP sofort beim Einlösen (Werber 50, Einlöser 25).
8. **[Fehler] Lücken-Code sichtbar (Web):** Im Karteikarten-Modus zeigt das Web Lückentext-Karten roh als `{{c1::…}}` und Bild-Karten als Markdown-Text; die App zeigt einen Strich bzw. das Bild.
9. **[Verhalten] Quiz-Rundenlänge:** App fest 10 Fragen, Web alle Karten des Decks (bei 200 Karten: 200 Fragen).
10. **[Verhalten] Platz-Warnung beim Import:** App warnt unter 30 freien Plätzen (blockierend), Web unter 25 (nur Hinweis) — und das Web rechnet Bild-Karten bei den freien Plätzen nicht mit (zeigt zu viel Platz an).

---

## 1. Navigation, Startseite, Onboarding

### Fehler / veraltet
- **[Fehler]** Onboarding Schritt 2 beschreibt verschiedene Bedienungen: App „Wische links = Nochmal, rechts = Gewusst", Web „bewerte: Nochmal, Schwer, Gut oder Leicht" — beide Apps haben aber dieselben 4 Knöpfe (die App zusätzlich Wischen).
- **[Detail]** Falscher Code-Kommentar im Web-Onboarding („Dieser Schritt existiert nur im Web") — der Scan-Schritt existiert auch in der App.

### Nur App / Nur Web
- **[nur App]** Abgemeldeten-Startseite („Ohne Konto starten" mit Erklärkacheln) — das Web leitet Abgemeldete direkt zum Login.
- **[nur App]** Benachrichtigungs-Abfrage („Bleib mit Freunden dran").
- **[nur Web]** Persönliche Begrüßung „Willkommen zurück, {Name}" (App grüßt nie mit Namen).
- **[nur Web]** Klebende Kopfzeile mit Marke „clearn.ai" auf jeder Seite.
- **[nur Web]** Symbole über den Onboarding-Schritten.

### Verhalten
- **[Verhalten]** Tagesziel ohne Serverdaten: App zeigt „0/30", Web „0/—".
- **[Verhalten]** Streak-Banner: App hat einen „kalten" (grauen) Zustand, solange heute nicht gelernt wurde; Web ist immer bernsteinfarben.
- **[Verhalten]** Home lädt in der App bei jeder Rückkehr neu, im Web nur einmal (Fällig-Zahl kann veraltet sein).
- **[Verhalten]** „Zuletzt genutzt"-Kachel: App kennt drei Beschriftungen (auch lokale Nutzung), Web nur zwei.
- **[Verhalten]** Ladefehler auf Home: App zeigt die rohe technische Meldung, Web einen freundlichen Satz.
- **[Verhalten]** Anzeigenamen-Dialog: in der App wegtippbar (Abbrechen), im Web Pflicht; App fragt nur auf Home, Web auf jeder Seite.
- **[Verhalten]** Onboarding-Weiche: App fängt jede Route ab, Web nur das Dashboard; nach Abschluss entlässt die App in den Lern-Tab, das Web auf Home. Bei gesperrtem Browser-Speicher erscheint die Web-Einführung nie.
- **[Verhalten]** Beispiel-Deck heißt im Web immer „Erste Karten", die App übersetzt je nach Sprache.

### Wortlaut / Detail
- **[Wortlaut]** Anzeigenamen-Untertext: Web ergänzt „Du kannst ihn später im Profil ändern."
- **[Wortlaut]** Claim abgemeldet in der App: „Foto — Flashcards — Wissen" statt „Foto — Karte — Wissen".
- **[Wortlaut]** Streak-Reparatur: App eigener Dialog („Streak zurückholen?"), Web einfacher Browser-Dialog; Ladezustand Kreisel vs. „Bitte warten…".
- **[Wortlaut]** Onboarding Schritt 3: „im Tab ‚Scan'" (App) vs. „unter ‚Scan'" (Web).
- **[Detail]** Statistik-Icon (BarChart3 vs. BarChart), Decks-Kachel-Farbe, Tagesziel-Farben (App: Balken wird grün + Violett-Symbol; Web: immer grün + graues Symbol), Pfeil-Abstände in Pillen, Freunde-Hinweis an anderer Position, LP-Pille im Web ohne Tausenderpunkt und ohne Rot-Warnung auf Home.

---

## 2. Bibliothek, Deck-Seite, Ordner

### Nur App / Nur Web
- **[nur Web]** Leeres Deck anlegen („+ Neues Deck") — in der App führt „+" immer in den Scan.
- **[nur Web]** Volles Deck-Menü schon in der Bibliothek (Lernen, Umbenennen, Zu Ordner, Duplizieren, Teilen, Löschen) — App-Bibliothek kann nur Umbenennen/Löschen, der Rest liegt in der Deck-Seite.
- **[nur Web]** „KI-erstellt"-Abzeichen statt roher Technik-Tags („scan", „auto") — die App zeigt die rohen Tags.
- **[nur Web]** Deck-/Ordner-Zähler unter dem Bibliothek-Titel; Deck-Anzahl und „N fällig" auf Ordner-Kacheln und im Ordner.
- **[nur Web]** Unterordner anlegen, umbenennen, löschen; App zeigt Unterordner nur an (und in der Bibliothek fälschlich flach mit aufgelistet).
- **[nur Web]** Teilen-Dialog mit Link-Anzeige, „Kopieren" und „Neuen Link erstellen" — die App öffnet direkt das System-Teilen-Blatt.
- **[nur App]** Offline speichern (fehlt im Web komplett), Deck-Details-Ansicht, Tags bearbeiten, Schwierigkeit im Karten-Editor + Anzeige, Erstelldatum auf Deck-Karten, Ladefehler mit „Erneut versuchen".
- **[nur App]** Meldung „Dieses Deck hat keinen aktiven Teilen-Link" (im Web nicht erreichbar).

### Verhalten
- **[Verhalten]** Ordner-Reihenfolge: App nach Erstelldatum, Web alphabetisch.
- **[Verhalten]** Modus-Kacheln: Web graut bei zu wenigen Karten aus („Braucht mindestens 2 Karten"), App blendet Quiz/Zuordnen ganz aus — und zeigt die Prüfung schon ab 1 Karte. App zählt dabei Bild-Karten mit, Web nicht.
- **[Verhalten]** Occlusion-Kachel: App immer aktiv, Web führt bei 0 Bildern zum Editor („Noch kein Bild — zum Erstellen klicken").
- **[Verhalten]** Deck aus Ordner entfernen: App fragt nach, Web entfernt sofort.
- **[Verhalten]** „Alle lernen" im App-Ordner lernt nur die fälligen Karten; das Web hat zwei ehrliche Knöpfe („N fällig lernen" / „Alle N lernen").
- **[Verhalten]** Nach Duplizieren: App springt ins neue Deck mit Meldung, Web bleibt still in der Bibliothek.
- **[Verhalten]** Suchfeld wird in der App beim Tab-Wechsel geleert, im Web nicht.
- **[Verhalten]** Karten-Editor: Web meldet „Bitte Vorder- und Rückseite ausfüllen", App graut nur aus.

### Wortlaut / Detail
- **[Wortlaut]** Deck/Karte/Ordner löschen: überall leicht andere Sätze (App nennt z. B. den Kartenanfang, Web fragt allgemein; Web-Ordner-Dialog nennt die Unterordner namentlich und beruhigt „Decks bleiben erhalten" — der App-Ordner-Dialog lässt den beruhigenden Nachsatz weg).
- **[Wortlaut]** Leerzustände unterscheiden sich fast überall in Nebensätzen (Ordner, Deck, leeres Deck, Deck-Auswahl).
- **[Wortlaut]** Web-Karten-Editor: „Hinzufügen" beim Anlegen / „Speichern" beim Bearbeiten; App immer „Speichern".
- **[Detail]** Web-Ordnernamen-Platzhalter uneinheitlich („z. B. Schule" vs. „z. B. Statistik"); App ohne Längenbegrenzung, Web max. 120; Bild-Karten im Web eigener Abschnitt, in der App in der Liste; „Zurück"-Beschriftungen unterschiedlich.

---

## 3. Karteikarten-Lernen, Üben, Lückentext

### Fehler
- **[Fehler]** „Schwer" = gewusst (App) vs. nicht gewusst (Web) — siehe oben.
- **[Fehler]** LP-Untergrenze 1 (App) vs. 5 (Web) — siehe oben.
- **[Fehler]** Lücken-/Bild-Anzeige im Web roh — siehe oben.
- **[Fehler]** „Trotzdem als richtig zählen" erzeugt im Web eine widersprüchliche Doppel-Bewertung — siehe oben.
- **[Fehler]** Tippfehler-Toleranz „Haus/Maus" — siehe oben.
- **[Fehler]** Wackelkandidaten-Üben meldet im Web das Etikett „flashcard" statt „practice" — in der Statistik nicht mehr unterscheidbar.

### Nur App / Nur Web
- **[nur App]** Globaler Lern-Tab (alle fälligen Karten über alle Decks) — das Web kann nur je Deck oder je Ordner lernen.
- **[nur App]** „Weitermachen" (Lernstand je Deck und Modus gemerkt, mit „Von vorne beginnen").
- **[nur App]** Zurück-Pfeil zur vorigen Karte samt Rückgängig-Puffer; Stern-Markieren während der Runde; Richtung tauschen (Setup + mitten in der Runde); Wisch-Zähler.
- **[nur App]** Offline-Warteschlange (Antworten gehen nie verloren; Web verliert Bewertungen bei Netzfehler still).
- **[nur App]** Meilenstein-Feiern und -Toasts („Erstes Deck! +LP") — im Web existiert die Meilenstein-Vergabe gar nicht.
- **[nur Web]** LP-Anzeige im Ergebnis („+N Lernpunkte") und Tageslimit-Hinweis — die App bucht still beim Verlassen.
- **[nur Web]** Ordner-Lernen „alle statt nur fällige" als Wahl; Etiketten „Frage/Antwort" auf der Karte; Tastatur-Umdrehen + Vorlese-Knopf nur wenn der Browser Sprachausgabe kann.

### Verhalten
- **[Verhalten]** Bewerten ohne Umdrehen: App-Knöpfe decken selbst auf; im Web muss man erst „Antwort zeigen".
- **[Verhalten]** Auto-Abspielen dreht die App-Karte optisch nicht um (liest aber die Rückseite vor) — im Web dreht sie sich sichtbar. Stufen und Standard sind identisch (3 s; 1/3/5/10).
- **[Verhalten]** „Alle nochmal": App lädt neu vom Server, Web wiederholt exakt denselben Stapel.
- **[Verhalten]** LP-Zählung beim Gutschreiben: App zählt tatsächlich gemeldete Antworten, Web die volle Rundenlänge; App schickt die Kartenzahl nicht an den Server mit.
- **[Verhalten]** Wackelkandidaten im Web für Gratis-Konten immer gesperrt (Tarif wird vorab geprüft); Einzel-Karte üben geht nur in der App.
- **[Verhalten]** Üben-Runde: im Web mit voller Ausstattung (Vorlesen, Auto), in der App bewusst abgespeckt.
- **[Verhalten]** Leere Quellen-Auswahl: App sperrt den Start, Web fällt still aufs ganze Deck zurück.
- **[Verhalten]** Lückentext-Fortsetzen sperrt in der App das Zurückblättern in bezahlte Karten (Web hat kein Fortsetzen); der App-Zurück-Pfeil sieht dabei aktiv aus, tut aber nichts (kleiner App-Schönheitsfehler).

### Wortlaut / Detail
- **[Wortlaut]** Fortschritt: „Karte 3 von 12" (App) vs. „3 / 12" (Web); Ergebnis-Überschrift „8 von 10" (App) vs. „Runde geschafft, {Name}!" (Web); Lückentext-Auswertung mit Prozent nur im Web.
- **[Wortlaut]** „Nur die falschen (N)" (App-Lückentext) vs. „Nur die nicht gewussten (N)" (Web überall).
- **[Wortlaut]** Umdreh-Hinweise („Tippen zum Umdrehen"/„wischen oder tippen" vs. „Zum Umdrehen klicken"/„Wie gut wusstest du es?"), „Zur Auswertung" vs. „Auswertung".
- **[Detail]** Vorlese-Knopf: App unten in der Leiste, Web oben auf der Karte; „Auto"-Wort im Ruhezustand nur im Web; Pokal grün+klein (App) vs. bernstein+groß (Web); Fortschrittsbalken-Details; Screenreader-Beschriftungen fast nur im Web.

---

## 4. Quiz, Zuordnen, Prüfung, Bild-Verdecken

### Fehler
- **[Fehler]** Quiz-Abbruch (App) verliert alle Antworten — siehe oben.
- **[Fehler]** Quiz-Rundenlänge 10 (App) vs. unbegrenzt (Web) — siehe oben.
- **[Fehler]** „Trotzdem als richtig zählen" in der Prüfung: das Web korrigiert auch den Lernplan mit, die App nicht — die Karte bleibt in der App-Statistik „nicht gewusst".
- **[Fehler]** Prüfungs-Leerbildschirm: das Web zählt quellen-gefiltert und kann in eine Sackgasse ohne Rückweg führen; die App zählt bewusst deck-weit.

### Nur App / Nur Web
- **[nur App]** Bild-Fragen im Quiz („BILD QUIZ") — das Web hat keine Bild-/Medienfragen und zeigt auch keine Bilder.
- **[nur App]** Zurück-Pfeil zur vorigen Frage im Quiz; Fortschritt „N richtig" im Kopf; „Falsche als Karteikarten üben" nach der Prüfung; Fein-Auswahl der Fragenanzahl (Stepper 1–Alle plus 50/75/100).
- **[nur App]** Occlusion: Bilder-Verwaltung („Deine Bilder" mit Bearbeiten/Löschen), Editor-Bearbeiten bestehender Bilder, Zoom + Kamera, Bild-Verkleinerung vor dem Upload.
- **[nur Web]** „Nur die nicht gewussten" in Zuordnen und Prüfung; „Zurück zum Deck" in allen Ergebnissen; „Keine Fragen"-Bildschirme (die App tut bei unbaubaren Fragen einfach nichts); automatischer Rückfall auf „Schriftlich" mit Hinweis; LP-Hinweis „Eine Prüfung misst — Lernpunkte gibt es beim Lernen."; „Bereiche löschen" (alle auf einmal) und „Deck voll"-Meldung im Occlusion-Editor.

### Verhalten
- **[Verhalten]** Quiz/Zuordnen-Rohtexte: das Web bereinigt Karten nicht (Markdown-Bilder/Übersetzungs-Zusätze erscheinen als Text), filtert dafür leere Karten (die App nicht).
- **[Verhalten]** Prüfungs-Ergebnisfarben: drei Stufen (App) vs. zwei (Web); Fragenanzahl-Wähler Chips+Stepper (App) vs. Durchtipp-Knopf (Web); Kartenquelle zählt in der App nur nutzbare Karten.
- **[Verhalten]** Zuordnen-Abbruch: App verlässt den Bildschirm, Web geht zurück ins Setup.
- **[Verhalten]** Occlusion-Pro-Sperre: App wirbt mit „Pro ansehen" (Kaufweg), Web sagt „Pro gibt es in der clearn-App" mit „Zurück zum Deck".
- **[Verhalten]** Setup-Reihenfolge in allen drei Modi unterschiedlich (App: Optionen zuerst, Kartenquelle spät; Web: Kartenquelle direkt nach dem Intro).

### Wortlaut / Detail
- **[Wortlaut]** „Nur die falschen" (App-Quiz) vs. „Nur die nicht gewussten" (Web); „Neuer Test" vs. „Alle nochmal/Nochmal"; „Nochmal" vs. „Alle nochmal" (Zuordnen); Ergebnis mit Prozent nur im Web; Occlusion-Ergebnis komplett anders formuliert.
- **[Detail]** Frage-Badges GROSS (App) vs. normal (Web); Ergebnis-Symbolik; Bestzeit-Speicherschlüssel unterschiedlich benannt; LP-Pille an anderer Stelle im Zuordnen-Ergebnis; Web-Quellen-Auswahl mit Stern-Icon und „mind. N Karten"-Hinweis.

---

## 5. Scan / Import

### Fehler
- **[Fehler]** Freie Plätze: das Web ignoriert Bild-Karten beim Zählen — zeigt bei Decks mit Occlusion-Karten zu viel freien Platz.
- **[Fehler]** Platz-Warnschwelle 30 (App, blockierender Dialog) vs. 25 (Web, stiller Hinweis).
- **[Fehler]** App bucht bei Kamera/Galerie/PDF sofort LP ab — ohne den Kosten-Bestätigungsschritt, den das Web bei jeder Quelle hat.
- **[Fehler]** Wer in der App-Vorschau alle Karten löscht, verliert die bezahlte Vorschau kommentarlos; das Web warnt und lässt „Karte hinzufügen" stehen.
- **[Fehler]** App-Singular fehlt: „1 Plätze frei".

### Nur App / Nur Web
- **[nur Web]** Zeichen-Zähler und harte 20.000-Zeichen-Grenze beim Text; Größenprüfung für Bild/PDF (~3 MB) mit eigenen Meldungen; Datei-Vorschau mit „Anderes Foto/Andere PDF"; editierbarer Titel fürs neue Deck; Auswahl unter ALLEN Decks (die App bietet nur die ersten 8 an!); eigener „Verwerfen"-Knopf mit Dauerhinweis; verständliche PDF-Fehlertexte; 3-Schritte-Erklärung.
- **[nur App]** Zuschneiden beim Galerie-Bild; „Beispieltext laden"; Bild-Anzeige und Typ-/Schwierigkeits-Chips in der Vorschau; PDF-/Quellen-Kontext („N Seiten importiert", „via {Modell}"); LP-Nachlade-Wege (Werbung/Shop/Pro) bei zu wenig LP; Anmelde-Hinweiskarte.

### Verhalten
- **[Verhalten]** Web sperrt Bild-/Lückentext-Karten nicht vor dem Bearbeiten — roher Bild-/Lücken-Code kann im Textfeld zerschrieben werden; die App sperrt solche Karten (nur löschen).
- **[Verhalten]** Speichern: App legt Karten einzeln an (mit eigenem Ausdünnen), Web mit einer Anfrage über den Server; nach dem Speichern zeigt die App immer einen Dialog, das Web springt direkt ins Deck.
- **[Verhalten]** Zielwahl: App über Dialogketten ohne Vorauswahl, Web als ständig sichtbare „Wohin damit?"-Box mit „Neues Deck" vorausgewählt.
- **[Verhalten]** Zu wenig LP: App merkt es erst am Server-Fehler (dann Modal mit Auswegen), das Web sperrt den Knopf vorab (aber ohne Auswege).
- **[Verhalten]** Fehler erscheinen in der App als blockierende Dialoge, im Web als Inline-Kästen; Pro-Fehler zeigt in der App eine englische Servermeldung.
- **[Verhalten]** Deck-Grenze: gleicher Hinweistext, aber die App zeigt das Banner nicht während der Vorschau — man merkt es erst beim Speichern.

### Wortlaut / Detail
- **[Wortlaut]** Fast alle Kachel-Untertitel unterschiedlich (Galerie sogar Titel+Untertitel vertauscht/vermischt); Info-Kasten nennt in der App den Anbieter („Gemini AI"), im Web nur „die KI"; URL-Text verspricht nur in der App Bilder; Erzeugen-Knopf „Flashcards generieren"/„URL analysieren" vs. einheitlich „Karten erstellen".
- **[Detail]** App-Kacheltitel sind nicht übersetzt (im Englischen halb deutsch); „..." vs. „…"; Ladetexte quellenabhängig (App) vs. einheitlich (Web); Web-Kachelfarben ohne Dunkelmodus-Anpassung (außer PDF).

---

## 6. Statistik, Lernpunkte, Pro

### Fehler / veraltet
- **[Fehler]** Web-LP-Seite: „Ab 5 Karten +5 LP" ist veraltet (Server: 1 LP je Karte).
- **[Fehler]** Statistik-Reihenfolge weicht ab, obwohl ein App-Kommentar Parität behauptet: Prüfungen direkt nach Genauigkeit (App) vs. nach „Karten pro Tag" und „Trefferquote genauer" (Web).

### Nur App / Nur Web
- **[nur Web]** Block „Trefferquote genauer" (Abrufen vs. Wiedererkennen) — fehlt in der App komplett; KPI-Kacheln und Kennzahlen-Panel; „So bekommst du Lernpunkte"-Erklärung mit Meilenstein-Liste; Bestenlisten-Ampelfarben im Deck-Vergleich.
- **[nur App]** „Pro freischalten"-Knöpfe in den Statistik-Teasern (das Web hat dort keinen Link); Tagesdetail mit Prozent und Lernminuten im Balkendiagramm; Antwort-Absolutzahlen in der Deck-Statistik; Einzel-Wackelkandidat üben + „zuletzt"-Datum; „Deck öffnen"-Knopf; Streak-Schutz kaufen (fehlt im Web komplett — nur ein Hinweis im Streak-Kalender); LP-zu-wenig-Modal mit Auswegen; echte Preise (Web zeigt keinerlei Preise).

### Verhalten
- **[Verhalten]** Verlaufskurven-Bedingung unterschiedlich (App: 2 Einträge, Web: 2 Lerntage mit Antworten) — an Randtagen zeigt eine Seite eine Kurve, die andere nicht.
- **[Verhalten]** Deck-Vergleich bei Gratis: App fragt an und wertet die Sperre aus, Web fragt gar nicht erst.
- **[Verhalten]** Scan-Umrechnung der LP-Pakete: App fest „~N KI-Scans" (durch 10), Web tarifabhängig „N Foto-Scans" (Pro sieht doppelt so viele).
- **[Verhalten]** Pro-Vorteilslisten: 6 Punkte ohne Zahlen (App) vs. 8 Punkte mit konkreten Zahlen (Web); „Mehr pro Tag verdienen" und „Erweiterte Statistik" fehlen in der App-Liste — obwohl gerade die App dafür wirbt.

### Wortlaut / Detail
- **[Wortlaut]** „LP-Shop" (App) vs. „Lernpunkte" (Web); „Beliebt" (App) vs. „Bester Wert" (Web) am selben Paket; „Bestes Preis-Leistungs-Verhältnis" als dritte Variante beim Abo; „Offline-Download" vs. „Offline lernen"; Pro-Sperrtexte überall leicht anders (Web hängt „in der clearn-App" an); „Deine Statistik" vs. „Statistik" + Untertitel.
- **[Detail]** Vier verschiedene „nur in der App"-Formulierungen im Web; Balken-/Farb-/Icon-Details; App-Übersetzungs-Schlüssel der Pro-Liste sind untereinander vertauscht (Wartungsfalle).

---

## 7. Profil, Freunde, Bestenliste, Tagesziel, Streak-Kalender, Konto

### Fehler / veraltet
- **[Fehler]** Web-Profil: Empfehlungsbonus-Text falsch (siehe oben).
- **[Fehler]** Web-Registrierung ohne Passwort-Bestätigung (App fragt das Passwort doppelt ab).

### Nur App / Nur Web
- **[nur Web]** Passwort ändern im Profil; Bestenlisten-Vorschau (Top 5) im Profil; Empfehlungscode direkt im Profil sichtbar; „Deine Platzierung"-Karte und eigene Zeile außerhalb der Top 50 in der Bestenliste; Ladefehler-Zustand in der Freundesliste; „Neu laden"-Knopf beim eigenen Code.
- **[nur App]** Tägliche Erinnerung mit Uhrzeit; Face-ID-Entsperren; Gastmodus samt Gast-Einstieg im Login; Versionsanzeige; Werbe-/Tracking-Einstellungen; „Lifetime"-Tarif kennt nur das Web als Beschriftung.

### Verhalten
- **[Verhalten]** Konto löschen: zweistufige Nachfrage (App, mit Abo-Warnhinweis) vs. einstufig (Web).
- **[Verhalten]** Tagesziel-Editor: gleiche Zahlen überall, aber die App übernimmt den Startwert aus der Verlinkung (Direktaufruf zeigt 30 statt des echten Ziels), das Web lädt ihn selbst.
- **[Verhalten]** Streak-Kalender: App ersetzt die Tageszahl durch Flamme/Schild, das Web lässt die Zahl stehen (die App hat den #496-Fix nicht); App-Kalender flackert beim Monatswechsel; Web ohne „Streak-Schutz kaufen"- und „Freunde-Streak"-Knöpfe.
- **[Verhalten]** Google/Apple-Login: App zeigt die Knöpfe immer (mit „wird noch freigeschaltet"-Dialog), das Web blendet sie aus, wenn nicht verfügbar.
- **[Verhalten]** Nach neuem Passwort: App meldet ab („Melde dich neu an"), das Web bleibt angemeldet und leitet zur Bibliothek.
- **[Verhalten]** Freundes-Dialoge: App mit Titeln und benannten Knöpfen, Web nackte Browser-Bestätigungen.
- **[Verhalten]** LP-Guthaben nach Freund-Hinzufügen aktualisiert nur die App sofort.

### Wortlaut / Detail
- **[Wortlaut]** Bonus-Erklärung nennt nur in der App die Zahlen (25/50); Teilen-Text im Web mit Webadresse; Erfolgsmeldung Dialog (App) vs. grüne Box (Web).
- **[Wortlaut]** Streak-Kalender-Chips „Vorrat/Best" vs. „Freezes/Bestwert"; Legenden unterschiedlich (App ohne „Heute", Web ohne „leer = nicht gelernt").
- **[Wortlaut]** Anmeldung: „Registrieren" vs. „Konto erstellen" (Knopf), Platzhalter („deine@email.de" vs. „du@beispiel.de"), Passwort-Meldungen minimal anders, Bestätigungs-Hinweise (App nennt Spam-Ordner, Web nennt Adresse + Auto-Login).
- **[Detail]** Design-Umschalter-Reihenfolge, Medaillen gefüllt vs. konturiert, eigener Avatar hat je Plattform eine andere Farbe, Profil-Titel „Profil" vs. „Profil & Einstellungen".

---

## Als gleich geprüft (Auswahl)

Tab-Reihenfolge und -Beschriftungen; Onboarding-Auslöser und -Speicherschlüssel; Bewertungsknöpfe (4, wortgleich); Auto-Abspielen-Stufen (1/3/5/10, Standard 3 s); Vorlese-Lückenregel und Sprache; Kartenquellen-Optionen und Filterlogik; Tagesziel-Zahlen (1–500, Standard 30, Vorschläge); Registrierungs-Pflichtfelder (Name 2–20 + Geschlecht) samt Fehlertexten; Prüfungs-Abbruchdialog wortgleich; Zuordnen-Kernregeln (6 Paare, Sterne, Bestzeit); LP-Tagesdeckel (30/20 Free, 100 Pro) und Paketgrößen; Import-Kosten je Quelle und `savedSummary`-Texte; Teilen-Link-Deaktivieren-Wortlaut (seit heute).
