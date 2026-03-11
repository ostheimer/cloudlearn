# Regression-Test-Checkliste Mobile (iOS Simulator)

Manuelle Checkliste für die Verifikation der Features: Tab-Badge, Deck-Kartenanzahl, „Alle lernen“, „Zuletzt gelernt“ → Lernsession, Onboarding, URL-Import und Bildquiz.

**Voraussetzung:** App im iOS-Simulator gestartet (`pnpm dev -- --ios` bzw. `npx expo start --ios`), mit Test-User eingeloggt, der Decks/Kurse/Ordner und ggf. fällige Karten hat.

Optionaler Referenz-Screenshot (Simulator-Zustand): `docs/screens/screenshots/simulator-regression-2026-02-24.png`

---

## 1. Tab-Badge

- [ ] **Home mit fälligen Karten:** Home-Screen laden → Tab „Lernen“ in der Tab-Bar zeigt Badge mit der Anzahl fälliger Karten (z. B. „3“).
- [ ] **Badge verschwindet:** Nach einer vollständigen Lernsession (alle Karten bewertet) oder wenn keine fälligen Karten mehr vorhanden sind → Badge ist nicht mehr sichtbar (oder 0).

---

## 2. Bibliothek – Kartenanzahl

- [ ] **Decks-Tab:** Bibliothek öffnen, Segment „Decks“ aktiv → unter jedem Deck-Titel ist „X Karten“ bzw. „1 Karte“ in kleinerer, tertiärer Schrift sichtbar.

---

## 3. „Alle lernen“ (Kurs)

- [ ] **Button sichtbar:** Kurs mit mindestens einem Deck öffnen → unter der Kurs-Header-Card ist der Button „Alle lernen“ sichtbar.
- [ ] **Tap startet Session:** Auf „Alle lernen“ tippen → Lernsession startet mit nur den fälligen Karten dieses Kurses; Navigation wechselt in den Learn-Tab.

---

## 4. „Alle lernen“ (Ordner)

- [ ] **Button sichtbar:** Ordner mit mindestens einem Deck öffnen → unter der Ordner-Header-Card ist der Button „Alle lernen“ sichtbar.
- [ ] **Tap startet Session:** Auf „Alle lernen“ tippen → Lernsession startet mit den fälligen Karten der Decks dieses Ordners; Navigation wechselt in den Learn-Tab.

---

## 5. „Zuletzt gelernt“

- [ ] **Navigation:** Auf dem Home-Screen auf die „Zuletzt gelernt“-Kachel tippen → Wechsel in den Learn-Tab (Lernsession), **nicht** in den Deck-Detail-/Bearbeitungsmodus.
- [ ] **Icon:** Die Kachel zeigt das Icon „BookOpen“ (offenes Buch), kein Uhr-Symbol (Clock).

---

## 6. URL-Import (Scan-Screen)

- [ ] **Button sichtbar:** Scan-Screen (Modus „choose“) zeigt den zusätzlichen CTA „URL importieren“.
- [ ] **Validierung:** Im URL-Modus ist der Eingabe-Button deaktiviert, bis eine gültige `http(s)`-URL eingegeben wurde; ungültige URL zeigt eine Fehlermeldung.
- [ ] **Import erfolgreich:** Nach gültiger URL werden Karten erzeugt und angezeigt (inklusive Deck-Titel, falls vom Modell geliefert).

---

## 7. Bildkarten & Bildquiz

- [ ] **Kartenansicht:** Wenn eine Karte Markdown-Bilder enthält (`![alt](url)`), wird das Bild in Scan-Ergebnis, Deck-Detail und Learn-Screen sichtbar gerendert.
- [ ] **Quiz-Fragetyp:** Quiz enthält bei passenden Karten den Typ „Bild Quiz“ mit Bild + 4 Antwortoptionen.
- [ ] **Fragequalität (Bild):** Bei URL-Importen mit Komponenten-Screenshots enthalten Bildfragen bevorzugt komponentenbezogene Stems (z. B. „Welche UI-Komponente ist dargestellt?“) statt reiner Marken-/Design-System-Abfrage.
- [ ] **Fallback robust:** Wenn kein Bild geladen werden kann, bleibt die Frage textlich lösbar (kein Crash, Navigation funktioniert weiter).

---

## 8. Onboarding (D8)

- [ ] **Erststart zeigt Onboarding:** Authentifizierter Nutzer ohne gesetztes AsyncStorage-Flag landet auf Schritt 1 des Onboardings, nicht auf einer leeren Root-Ansicht.
- [ ] **3 Schritte vollständig:** `Weiter` wechselt von „Willkommen“ zu „So funktioniert's“ und anschließend zu „Dein erstes Deck“.
- [ ] **Starter-Deck anlegen:** `Jetzt starten` zeigt den Ladezustand „Erstelle dein erstes Deck…“ und wechselt danach in die Lernsession.
- [ ] **Persistenz in derselben Session:** Nach abgeschlossenem Onboarding darf ein erneuter Aufruf von `/auth` oder `/onboarding` nicht wieder im Onboarding landen; die App leitet stattdessen in die Tabs/Lernsession weiter.

---

## Optional

- Screenshots bei jeder Nummer für spätere Vergleiche ablegen (z. B. in `docs/screens/screenshots/`). Simulator-Screenshot: `xcrun simctl io booted screenshot <path>`.
- Ergebnis und Datum in ROADMAP.md oder SCREENS.md vermerken: *Regression (Simulator) durchgeführt am TT.MM.JJJJ – Tab-Badge, Kartenanzahl, Alle lernen, Zuletzt gelernt OK.*

---

## Automatisierte Tests (Ergänzung)

- **Unit (Vitest):** `sessionStore` (dueCount/setDueCount), `learnFilters` (filterDueCardsByDeckIds) — `pnpm --filter @clearn/mobile test`
- **API (Playwright):** GET `/api/v1/learn/due` (Response-Struktur `cards` mit id, deckId, front, back), GET `/api/v1/decks` (Decks mit `cardCount`) — `npx playwright test --project=api`
