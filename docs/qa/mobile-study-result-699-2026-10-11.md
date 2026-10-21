# App-Ergebnisse und Wiederholung – #699 / #734.2

Geprüft am 11. Oktober 2026. Ausgangspunkt: frischer Main `fdf8948`.
Der anschließend erschienene Dokumentationsstand #763 (`e4f2bf5`) ist ebenfalls
Basis des PRs. Keine neuen Produktentscheidungen.

## Aktueller Befund und Umfang

Main hatte den großen grünen Pokal in Zuordnen und Prüfung sowie den
farbneutralen Prüfungs-Kommentar schon korrigiert. Offen waren die separaten
Ergebnisrahmen, der gegenläufige Quiz-Kommentar und die Wiederholungswege.

Karteikarten (`(tabs)/learn`), Quiz, Zuordnen und Prüfung nutzen jetzt ebenfalls
`StudyResult`. Üben, Lücken und Bild-Abdecken verwenden diesen Rahmen bereits.
Der Ergebnispokal bleibt immer grün, mit einem 72-Punkte-Kreis und einem
34-Punkte-Symbol. Noten, Fehler, Sterne, Bestzeit und LP behalten ihre eigene
Aussage; eine Bestzeit-Plakette ist weiterhin eine zusätzliche Auszeichnung.
Die Reihenfolge von Überschrift, Auswertung, LP/Status und Aktionen bleibt im
jeweiligen Modus erhalten. Gemeinsame Aktionen haben Button-Rollen und Namen.

Zuordnen wiederholt nur tatsächlich verfehlte, weiterhin spielbare Karten,
mit mindestens zwei Paaren wie im Web. Beide Karten eines Fehlversuchs zählen
als nicht gewusst. Prüfung startet eine neue Prüfung ausschließlich aus den
falschen, nicht nachträglich als richtig gezählten Antworten. Reicht der Vorrat
für Auswahlfragen nicht, fällt sie wie im Web auf Schriftlich zurück und zeigt
warum. Der ursprüngliche Setup bleibt erhalten. Die Karteikarten-Übung ist ein
separater Knopf; ihr Inhalt und die bisherige Kartenreihenfolge bleiben erhalten.
„Alle nochmal“ nutzt weiterhin die gewählte Quelle und Rundeneinstellungen.

Ergebnis- und Wiederholungstexte der drei umgestellten Spezialmodi sind in DE/EN
vorhanden. Die übrige bestehende Setup-/Spiel-Lokalisierung ist kein neuer Umfang.
Die weiteren fünf Punkte aus #734 bleiben offen; insbesondere beansprucht dieser
PR keine vollständige Umsetzung des „Keine Fragen“-Bildschirms aus #734.1.

## Reproduktion und Prüfung

`src/components/studyResults.test.tsx` mountet die echten Bildschirme mit
React Test Renderer. Native Hosts, Navigation, API, Storage und Animationen sind
lokale Ersatzmodule; Fragenbau, Auswertung, Ergebnis-Komponente, Review-Store,
Wiederholungs-Callbacks und die DE/EN-Ressourcen laufen als Produktcode.
Eine unerwartete Fetch-Anfrage lässt die Prüfung scheitern.

Vor dem Fix: zehn ausgewählte DE/EN-Regressionsfälle scheiterten auf dem
unveränderten Main-Produktcode (`fdf8948`): fehlender Teilmengen-Knopf in Zuordnen,
fehlender Prüfungs-Neustart für eine offene MC-Karte und fehlender gemeinsamer
Rahmen in Karteikarten/Quiz/Zuordnen. Dieselben Fälle sind nach dem Fix grün.

Die vollständige neue Matrix hat 24 Fälle (12 je Sprache):

- Zuordnen: beide verfehlten Karten, kein fremdes Paar in der Folgerunde,
  Fehler-/Zeit-Reset, einmalige Meldung der Folgerunde, LP nach den Reviews,
  perfekte Runde, Einstellungen und voller Neustart.
- Prüfung: Overrides aus der Teilmenge ausgeschlossen, neue leere Antworten,
  Ein-Karten-MC-Fallback, eigener Prüfungsversuch je Folgerunde, kein LP-Aufruf,
  Zeitbudget nach tatsächlicher Fragenzahl, Setup unverändert, separate
  Karteikarten-Route mit bisheriger Kartenreihenfolge, grüner Pokal bei 0/100 %.
- Quiz: unveränderte Quote und Fehlerauswertung, Teilmengen-/Voll-Neustart,
  Modus `quiz`, erneute LP-Abrechnung erst nach den Antworten.
- Karteikarten: gemeinsamer Ergebnisrahmen, korrekte Gesamt-/Gewusst-Zahl,
  ursprünglicher Inhalt und Reihenfolge der Fehlkarten; vollständiges Nachladen
  setzt History/Index zurück, ohne die alte Runde erneut zu melden.

Befehle mit Node 24 im isolierten Worktree:

```sh
pnpm install --frozen-lockfile
pnpm --filter @clearn/mobile exec vitest run src/components/studyResults.test.tsx
pnpm run ci
```

Lokale Logs und opt-in Snapshots des gemounteten Native-Baums liegen unter
`/Users/andreas/Documents/Codex/clearn-study-result-699-2026-10-11/`.
Final nach Rebase auf #763: `pnpm run ci` grün mit 2.415 bestandenen Tests
und 63 lokal übersprungenen API-Fällen; Mobile 967/967 einschließlich der
24 neuen UI-Fälle. Lint und alle Workspace-Typechecks bestanden. Ein kostenloser
lokaler `expo export --platform ios` hat das Hermes-Bundle erfolgreich erzeugt;
das ist noch kein nativer Geräte-Build.
Die aktuellen CI-/Preview-Nachweise am exakten PR-Head stehen im PR-Body.

## Abnahmegrenzen

Die UI-Prüfung ist eine gemountete Funktionsprüfung mit synthetischen Daten;
sie ist kein Nachweis nativer Pixel, VoiceOver-Ausgabe oder eines installierten
Geräte-Builds. Kein EAS-/bezahlter Build, echter KI-Aufruf, Produktionsdatenzugriff,
Security-Scan, Merge oder Produktionsdeployment in diesem Auftrag.

Ohne OTA gelangen diese App-Änderungen erst durch einen später gemeinsam
gebündelten, ausdrücklich beauftragten App-Build auf Geräte. Unabhängiger Review,
Merge und Produktionsmonitoring liegen beim PM; #734 wird nicht geschlossen.
