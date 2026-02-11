# BACKLOG

Letzte Aktualisierung: 2026-02-11

## Ziel

Dieses Backlog schneidet die Punkte aus `ROADMAP.md` (Phase 1) in umsetzbare Tickets mit klaren Akzeptanzkriterien und Testfaellen.

## Prioritaetslogik

- **P0:** Blockiert Kernnutzen oder Launch
- **P1:** Wichtig fuer Stabilitaet und Monetarisierung
- **P2:** Wichtige Verbesserungen, aber nicht launch-kritisch

## Definition of Done (DoD)

Ein Ticket ist erst "Done", wenn:

- Implementierung gemergt und lokal/CI gruen
- Akzeptanzkriterien vollstaendig erfuellt
- Zugehoerige Tests vorhanden und gruen
- Dokumentation angepasst (`README.md`, `ROADMAP.md`, ggf. Runbook)

## Phase 1 Tickets (MVP Build)

### CL-101 - Expo Basisprojekt + Navigation

- **Prioritaet:** P0
- **Status:** Done (MVP-Scaffold)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** keine

**Akzeptanzkriterien**
- [ ] Expo-Projekt startet auf iOS und Android ohne Build-Fehler
- [ ] Basisrouten vorhanden: `auth`, `tabs/index`, `tabs/scan`, `tabs/learn`, `tabs/decks`, `tabs/profile`
- [ ] Session-Guard leitet nicht-authentifizierte Nutzer in den Auth-Bereich

**Testfaelle**
- **Unit:** Route-Guard-Logik fuer "eingeloggt vs. nicht eingeloggt"
- **Integration:** Navigation zwischen Tabs inkl. Deep-Link zu `scan`
- **E2E (Playwright/Detox):** App startet, Login-Screen sichtbar, nach Mock-Login auf Home

### CL-102 - Supabase Setup (Auth, DB, RLS, Migrations)

- **Prioritaet:** P0
- **Status:** Done (Migrations + RLS + Client)
- **Schaetzung:** 3-4 PT
- **Abhaengigkeiten:** CL-101

**Akzeptanzkriterien**
- [ ] Supabase-Projekt konfiguriert und per ENV angebunden
- [ ] Tabellen + Indizes + RLS Policies aus dem Datenmodell als Migration angelegt
- [ ] Auth-Flows fuer E-Mail/Passwort und Social Login vorbereitet (Feature Flags erlaubt)

**Testfaelle**
- **Unit:** Policy-Helfer/Query-Builder verhindern ungescopte User-Queries
- **Integration:** User A kann keine Decks/Karten von User B lesen
- **E2E:** Registrierung -> Login -> eigenes leeres Deck-Listing sichtbar

### CL-103 - Monitoring Basics (Sentry, PostHog, Request IDs)

- **Prioritaet:** P1
- **Status:** Done (Request IDs, Analytics Mapping, CI-Basis)
- **Schaetzung:** 2 PT
- **Abhaengigkeiten:** CL-101, CL-102

**Akzeptanzkriterien**
- [ ] Sentry in Mobile + API aktiv, inklusive Release/Environment Tags
- [ ] PostHog Events fuer zentrale Funnel-Schritte erfasst
- [ ] Jede API-Response enthaelt `request_id` fuer Korrelationsanalyse

**Testfaelle**
- **Unit:** Event-Mapping produziert valide Event-Namen und Pflichtfelder
- **Integration:** API Error Log enthaelt identische `request_id` in Response und Server-Log
- **E2E:** Kontrollierter Fehler wird in Sentry sichtbar (staging)

### CL-201 - Kamera + Galerie-Import

- **Prioritaet:** P0
- **Status:** Done (Mock-Capture/Galerie-Flow)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** CL-101

**Akzeptanzkriterien**
- [ ] Nutzer kann Bild per Kamera aufnehmen
- [ ] Nutzer kann Bild aus Galerie auswaehlen
- [ ] Berechtigungen werden sauber behandelt (granted, denied, permanently denied)

**Testfaelle**
- **Unit:** Permission-Handler fuer iOS/Android Status-Mapping
- **Integration:** Ausgewaehltes Bild landet im Scan-Workflow-State
- **E2E:** Kamera denied -> Fallback-Hinweis + Galerie weiterhin nutzbar

### CL-202 - On-Device OCR + Korrektur-UI (Basis)

- **Prioritaet:** P0
- **Status:** Done (OCR-Editor-Scaffold)
- **Schaetzung:** 3-4 PT
- **Abhaengigkeiten:** CL-201

**Akzeptanzkriterien**
- [ ] OCR funktioniert auf iOS (Vision) und Android (ML Kit)
- [ ] OCR-Text kann vor KI-Verarbeitung inline editiert werden
- [ ] OCR-Laufzeit und Fehlerrate werden als Metrik erfasst

**Testfaelle**
- **Unit:** OCR-Result-Mapper normalisiert Zeilenumbrueche/Sonderfaelle
- **Integration:** Editierter Text wird exakt an den KI-Endpoint uebergeben
- **E2E:** Beispielbild laden -> OCR Text erscheint -> manuelle Korrektur speichern

### CL-203 - KI-Endpoint Text -> Flashcards (Validation + Fallback)

- **Prioritaet:** P0
- **Status:** Done (Validation + Model-Fallback)
- **Schaetzung:** 4-5 PT
- **Abhaengigkeiten:** CL-102, CL-202

**Akzeptanzkriterien**
- [ ] Endpoint nutzt Prompt-Template mit Sprachbeibehaltung
- [ ] JSON-Schema-Validation fuer Antwort ist verpflichtend
- [ ] Bei Fehlern: Retry-Strategie + Fallback-Modell + saubere Fehlercodes

**Testfaelle**
- **Unit:** Schema-Validator lehnt ungueltige Kartenstrukturen ab
- **Integration:** Provider-Fehler triggert Fallback und liefert valide Antwort
- **E2E:** OCR-Text senden -> Kartenvorschlaege angezeigt -> speichern erfolgreich

### CL-204 - Flashcard Review-Flow (Again/Hard/Good/Easy)

- **Prioritaet:** P0
- **Status:** Done (Review-Session Scaffold)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** CL-203

**Akzeptanzkriterien**
- [ ] Karte zeigt Front/Back mit klarer Reveal-Interaktion
- [ ] Vier Bewertungsaktionen schreiben Review-Event
- [ ] Session-Progress (restliche Karten, abgeschlossen) ist sichtbar

**Testfaelle**
- **Unit:** Rating-Mapping auf FSRS Inputwerte
- **Integration:** Review-Event wird mit User/Card/Timing persistiert
- **E2E:** 5 Karten Session durchklicken, Abschlussscreen erscheint

### CL-205 - FSRS Integration + Due-Queue Persistenz

- **Prioritaet:** P0
- **Status:** Done (FSRS-Domain + Persistenzpfad)
- **Schaetzung:** 3-4 PT
- **Abhaengigkeiten:** CL-204

**Akzeptanzkriterien**
- [ ] Nach jedem Review wird FSRS Zustand korrekt fortgeschrieben
- [ ] Due-Queue liefert nur faellige Karten, sortiert nach `fsrs_due`
- [ ] Zustand ist lokal und serverseitig konsistent speicherbar

**Testfaelle**
- **Unit:** FSRS Wrapper berechnet erwartete naechste Faehligkeit fuer feste Inputs
- **Integration:** Review -> Persistenz -> Due-Query enthaelt/enthaelt nicht Karte wie erwartet
- **E2E:** Karte mit spaeter `due` taucht nicht in aktueller Session auf

### CL-206 - Deck CRUD + Suche

- **Prioritaet:** P1
- **Status:** Done (Service + Domain Search)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** CL-102

**Akzeptanzkriterien**
- [ ] Deck erstellen, umbenennen, loeschen funktioniert
- [ ] Karten einem Deck zuordnen und anzeigen
- [ ] Suche filtert Decks nach Titel und Tags

**Testfaelle**
- **Unit:** Suchfunktion (case-insensitive, tag-basiert)
- **Integration:** Soft Delete blendet geloeschte Decks aus
- **E2E:** Deck erstellen -> Karte hinzufuegen -> im Deck sichtbar

### CL-301 - Cloudflare R2 Upload via Signed URLs

- **Prioritaet:** P1
- **Status:** Done (Signed URL Endpoint + Tests)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** CL-102, CL-201

**Akzeptanzkriterien**
- [ ] Upload nur ueber kurzlebige Signed URLs
- [ ] Keine langfristigen R2 Secrets im Client
- [ ] Metadaten (owner, timestamp, size) werden mitgespeichert

**Testfaelle**
- **Unit:** Signed-URL-Erstellung respektiert TTL und Content-Type
- **Integration:** Upload mit abgelaufener URL wird korrekt abgelehnt
- **E2E:** Bild hochladen -> URL in Scan-Historie vorhanden

### CL-302 - Offline Retry-Queue + idempotenter Sync

- **Prioritaet:** P0
- **Status:** Done (Queue-Store + Sync Endpoint)
- **Schaetzung:** 4-5 PT
- **Abhaengigkeiten:** CL-203, CL-205

**Akzeptanzkriterien**
- [ ] Schreiboperationen werden offline in Queue gespeichert
- [ ] Replays sind idempotent (kein doppeltes Review/keine Duplikatkarten)
- [ ] Konfliktregeln aus README fuer Metadaten/Reviews werden angewendet

**Testfaelle**
- **Unit:** Queue-Reducer und Idempotency-Key Generierung
- **Integration:** Offline erzeugte Reviews werden nach Reconnect genau einmal geschrieben
- **E2E:** Flugmodus an -> lernen -> Flugmodus aus -> Daten korrekt synchron

### CL-303 - Basis-Paywall (RevenueCat)

- **Prioritaet:** P1
- **Status:** Done (Scaffold)
- **Schaetzung:** 2-3 PT
- **Abhaengigkeiten:** CL-102

**Akzeptanzkriterien**
- [ ] Free Limit fuer Scans/KI-Nutzung erzwungen
- [ ] Paywall zeigt Monats-, Jahres- und Lifetime-Option
- [ ] Aktivierung/Entzug von Entitlements wirkt sofort auf Feature-Zugriff

**Testfaelle**
- **Unit:** Plan-Checker fuer Feature-Zugriffsrechte
- **Integration:** Webhook aktualisiert Subscription-Status im Profil
- **E2E:** Free Limit erreichen -> Paywall erscheint -> Mock-Upgrade entsperrt Funktion

### CL-304 - TestFlight / Internal Testing Pipeline

- **Prioritaet:** P1
- **Status:** Done (Runbook + Build-Preflight)
- **Schaetzung:** 2 PT
- **Abhaengigkeiten:** CL-101 bis CL-303 (Minimum lauffaehiger Build)

**Akzeptanzkriterien**
- [ ] Reproduzierbarer Build-Prozess fuer iOS und Android dokumentiert
- [ ] Interner Release-Kanal mit Versionierung vorhanden
- [ ] Smoke-Test-Checkliste fuer jedes Build-Artefakt vorhanden

**Testfaelle**
- **Unit:** n/a (Pipeline-Ticket)
- **Integration:** Build-Skript liest alle Pflicht-ENV Variablen
- **E2E/Smoke:** Installation auf Testgeraet, Login, Scan, Review, Logout erfolgreich

## Phase 2 Tickets (Scaffold umgesetzt)

- **CL-401:** Onboarding-Flow mit Abschlussrouting implementiert
- **CL-402:** Statistiken-Dashboard als App-Home-Scaffold implementiert
- **CL-403:** Push-Preferences mit Opt-In/Opt-Out und Quiet-Hours implementiert
- **CL-404:** Incident + Restore Runbooks und `restore-smoke.sh` umgesetzt
- **CL-405:** Landing Page (`apps/web`) und ASO-Checkliste angelegt
- **CL-406:** Beta-Feedback-Endpoint und Triage-Runbook implementiert

## Phase 3 Tickets (Scaffold umgesetzt)

- **CL-501:** Lernmodi + psychometrische Auswertung im Domain-Paket implementiert
- **CL-502:** PDF-Import Queue/Retry als API-Service implementiert
- **CL-503:** Mathpix-Kostenkontrolle als API-Service implementiert
- **CL-504:** Anki-Export (`.apkg` Scaffold) implementiert
- **CL-505:** Community-Decks mit Moderation/Abuse-Prevention implementiert
- **CL-506:** Web-Learn-Client (`apps/web/app/learn`) implementiert
- **CL-507:** B2B Klassen-Service mit Mandantenisolation implementiert

## Sprintvorschlag (erste 3 Sprints)

- **Sprint 1:** CL-101, CL-102, CL-201
- **Sprint 2:** CL-202, CL-203, CL-204, CL-205
- **Sprint 3:** CL-206, CL-301, CL-302, CL-303, CL-304

## Risiken im Backlog-Schnitt

- CL-302 (Offline Sync) ist hohes Risiko und sollte nicht nach hinten verschoben werden.
- CL-203 (KI Endpoint) braucht frueh stabile Testdaten, sonst drohen spaete Regressions.
- CL-102 (RLS) muss vor breiter Feature-Entwicklung solide stehen, um Nacharbeiten zu vermeiden.

---

## Feature-Tickets: Priorität A — Lern-Experience

### CL-A01 - Karte umdrehen (Tap + Flip-Animation)

- **Priorität:** P0
- **Status:** Offen
- **Schätzung:** 1-2 PT
- **Abhängigkeiten:** keine
- **Referenz:** Quizlet Flashcard-Modus

**Beschreibung**
Im Learn-Screen wird die Karte als große Fläche dargestellt. Tippen auf die Karte dreht sie mit einer 3D-Flip-Animation um (Vorderseite → Rückseite und zurück). Die aktuelle Button-basierte Lösung (Antwort zeigen) wird ersetzt.

**Akzeptanzkriterien**
- [ ] Karte ist als großer, tappbarer Bereich dargestellt (min. 60% der Bildschirmhöhe)
- [ ] Tippen auf Karte dreht sie mit einer flüssigen 3D-Flip-Animation um (~300ms)
- [ ] Nochmaliges Tippen dreht zurück zur Vorderseite
- [ ] Rating-Buttons (Again/Hard/Good/Easy) erscheinen erst nach dem Umdrehen
- [ ] Cloze-Karten: Vorderseite zeigt Lücke, Rückseite die Antwort

**Testfälle**
- **Unit:** Flip-State toggled korrekt (front ↔ back)
- **E2E:** Karte tippen → Animation sichtbar → Rückseite gezeigt → Buttons erscheinen

### CL-A02 - Swipe links/rechts (weiß ich / weiß ich nicht)

- **Priorität:** P0
- **Status:** Offen
- **Schätzung:** 2-3 PT
- **Abhängigkeiten:** CL-A01

**Beschreibung**
Neben den Buttons können Karten per Swipe-Geste bewertet werden. Swipe nach rechts = "Gewusst" (mapped auf "Good"), Swipe nach links = "Nicht gewusst" (mapped auf "Again"). Visuelle Indikatoren (grün/rot) zeigen die Richtung an.

**Akzeptanzkriterien**
- [ ] Swipe rechts → Karte animiert nach rechts mit grünem Overlay → Rating "Good" wird gesendet
- [ ] Swipe links → Karte animiert nach links mit rotem Overlay → Rating "Again" wird gesendet
- [ ] Swipe-Schwelle: mindestens 30% der Bildschirmbreite oder Geschwindigkeit > 500px/s
- [ ] Sanfter Rücksprung bei zu kurzem Swipe (< Schwelle)
- [ ] Rating-Buttons (Again/Hard/Good/Easy) bleiben als Alternative verfügbar
- [ ] Nächste Karte fliegt von unten/rechts ein (Deck-Gefühl)

**Testfälle**
- **Unit:** Swipe-Gesten-Erkennung mit verschiedenen Distanzen/Geschwindigkeiten
- **E2E:** Karte nach rechts wischen → nächste Karte erscheint → Review in DB gespeichert

### CL-A03 - Fortschrittsbalken in Lernsession

- **Priorität:** P0
- **Status:** Offen
- **Schätzung:** 0,5 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Oben im Learn-Screen zeigt ein Fortschrittsbalken an, wie viele Karten in der aktuellen Session bereits bearbeitet wurden (z.B. "5 / 12"). Visueller Balken + Textanzeige.

**Akzeptanzkriterien**
- [ ] Fortschrittsbalken sichtbar oben im Learn-Screen
- [ ] Text: "X / Y" (bearbeitete / gesamte Karten in Session)
- [ ] Balken füllt sich proportional
- [ ] Farbe wechselt bei 100% (z.B. grün)
- [ ] "Raus"-Button (unten links) zum vorzeitigen Beenden der Session

**Testfälle**
- **Unit:** Fortschritts-Berechnung (0/10 → 5/10 → 10/10)
- **E2E:** Karte bewerten → Balken aktualisiert sich → bei letzter Karte Gratulation

### CL-A04 - Begriff ↔ Definition umschalten

- **Priorität:** P1
- **Status:** Offen
- **Schätzung:** 1 PT
- **Abhängigkeiten:** CL-A01

**Beschreibung**
Ein Wechsel-Symbol (⇄) oberhalb der Karte ermöglicht es, zwischen "Begriff zuerst" (Standard: Frage vorne) und "Definition zuerst" (Antwort vorne) umzuschalten. Nützlich zum Lernen in beide Richtungen.

**Akzeptanzkriterien**
- [ ] Wechsel-Symbol (⇄) oberhalb der Karte sichtbar
- [ ] Tippen wechselt die Zuordnung: front ↔ back für alle Karten der Session
- [ ] Visuelles Label zeigt aktuellen Modus: "Begriff → Definition" oder "Definition → Begriff"
- [ ] Einstellung wird pro Session beibehalten
- [ ] Auch in den Einstellungen (Settings-Icon) umschaltbar

**Testfälle**
- **Unit:** Toggle-State: front/back Zuordnung korrekt getauscht
- **E2E:** Toggle drücken → Karte zeigt jetzt die Antwort vorne

### CL-A05 - Stern/Favorit markieren

- **Priorität:** P1
- **Status:** Offen
- **Schätzung:** 1-2 PT
- **Abhängigkeiten:** keine (DB-Spalte nötig)

**Beschreibung**
Auf jeder Karte (im Learn- und Deck-Detail-Screen) gibt es ein Stern-Symbol. Tippen markiert/entmarkiert die Karte als Favorit. Im Learn-Screen kann man filtern: "Nur markierte Karten lernen".

**Akzeptanzkriterien**
- [ ] Stern-Icon (☆/★) auf Karten im Learn-Screen und Deck-Detail
- [ ] Tippen toggled Favorit-Status (sofort visuell + API-Call)
- [ ] DB: `starred` Boolean-Spalte auf `cards`-Tabelle
- [ ] Filter-Option im Learn-Screen: "Nur markierte Karten"
- [ ] Deck-Detail zeigt Stern-Status bei jeder Karte
- [ ] API: `PATCH /api/v1/cards/:id` akzeptiert `starred` Feld

**Testfälle**
- **Unit:** Stern-Toggle-Logik
- **Integration:** API setzt/entfernt `starred`; Filter gibt nur markierte zurück
- **E2E:** Stern drücken → Karte markiert → Filter aktivieren → nur markierte Karten

---

## Feature-Tickets: Priorität B — Engagement & Motivation

### CL-B01 - Streaks (Tagesserien)

- **Priorität:** P1
- **Status:** Offen
- **Schätzung:** 2-3 PT
- **Abhängigkeiten:** keine (DB-Tracking nötig)

**Beschreibung**
Nutzer sehen ihren aktuellen Streak (aufeinanderfolgende Tage mit mindestens 1 Review). Visuell prominent auf Home-Screen und nach Session-Ende. Streak-Verlust-Warnung wenn heute noch nicht gelernt.

**Akzeptanzkriterien**
- [ ] DB: `streaks`-Tabelle oder Spalten auf `profiles` (current_streak, longest_streak, last_review_date)
- [ ] Home-Screen: Streak-Anzeige mit Flammen-Icon (🔥) und Zahl
- [ ] Nach Review-Session: "Streak: X Tage!" Animation
- [ ] Streak-Warnung auf Home: "Dein Streak läuft heute ab!" (wenn noch nicht gelernt)
- [ ] Streak bricht um Mitternacht (Nutzer-Zeitzone)
- [ ] Streak zählt ab der ersten Review des Tages

**Testfälle**
- **Unit:** Streak-Berechnung (aufeinanderfolgende Tage, Mitternachts-Grenze)
- **Integration:** Review speichern → Streak aktualisiert
- **E2E:** Tag 1 lernen → Tag 2 lernen → Streak = 2 → Tag 3 nicht lernen → Streak = 0

### CL-B02 - Statistiken-Screen

- **Priorität:** P1
- **Status:** Offen (API-Endpoint `/api/v1/stats` existiert)
- **Schätzung:** 2-3 PT
- **Abhängigkeiten:** CL-B01 (Streak-Daten)

**Beschreibung**
Eigener Tab oder Bereich mit Lernstatistiken: Karten gelernt (heute/Woche/gesamt), Genauigkeit (% korrekt), Streak-Verlauf, Deck-Fortschritt (% gemeistert), Lernzeit.

**Akzeptanzkriterien**
- [ ] Stats-Screen erreichbar (eigener Tab oder von Home)
- [ ] Anzeige: Karten heute / diese Woche / gesamt gelernt
- [ ] Genauigkeit: % der Reviews mit "Good" oder "Easy"
- [ ] Streak-Kalender (Heatmap der letzten 30 Tage)
- [ ] Deck-Fortschritt: Balkengrafik pro Deck (% im Review-Status)
- [ ] Daten kommen live von `/api/v1/stats`

**Testfälle**
- **Unit:** Statistik-Berechnungen (Genauigkeit, Fortschritt)
- **Integration:** Reviews durchführen → Stats-API gibt korrekte Werte
- **E2E:** 5 Karten lernen → Stats-Screen zeigt "5 heute gelernt"

### CL-B03 - Vorlesen (TTS)

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 1 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Lautsprecher-Button auf Karten-Vorder- und Rückseite. Nutzt `expo-speech` (On-Device TTS) zum Vorlesen des Textes. Sprache wird automatisch erkannt oder aus Deck-Einstellungen übernommen.

**Akzeptanzkriterien**
- [ ] Lautsprecher-Icon (🔊) auf Vorder- und Rückseite der Karte
- [ ] Tippen liest den Text per TTS vor
- [ ] Sprache: automatisch aus Karten-Tags oder Deck-Sprache
- [ ] Funktioniert offline (On-Device TTS)
- [ ] Button zeigt Lade-/Abspiel-Status

**Testfälle**
- **Unit:** TTS-Aufruf mit korrektem Text und Sprache
- **E2E:** Button drücken → Text wird vorgelesen (manueller Test)

### CL-B04 - Push-Erinnerungen

- **Priorität:** P1
- **Status:** Offen
- **Schätzung:** 2-3 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Tägliche Push-Notification: "Du hast X fällige Karten!" Konfigurierbare Uhrzeit und Ruhezeiten in den Profil-Einstellungen.

**Akzeptanzkriterien**
- [ ] `expo-notifications` eingebunden
- [ ] Lokale Notification täglich zur eingestellten Uhrzeit
- [ ] Inhalt: Anzahl fälliger Karten
- [ ] Profil-Settings: Uhrzeit wählen, Notifications an/aus
- [ ] Ruhezeiten (z.B. 22:00–08:00) konfigurierbar
- [ ] Tippen auf Notification öffnet Learn-Screen

**Testfälle**
- **Unit:** Notification-Scheduling-Logik
- **E2E:** Notification-Permission erteilen → Notification erscheint zur eingestellten Zeit

### CL-B05 - Home-Screen aufwerten

- **Priorität:** P1
- **Status:** Offen
- **Schätzung:** 1-2 PT
- **Abhängigkeiten:** CL-B01 (Streaks), CL-B02 (Stats)

**Beschreibung**
Home-Screen um Streak-Anzeige, Mini-Statistik (heute gelernt), nächste fällige Karten-Preview und Lernziel-Tracker erweitern.

**Akzeptanzkriterien**
- [ ] Streak-Anzeige (🔥 X Tage) prominent sichtbar
- [ ] "Heute gelernt: X Karten" Zähler
- [ ] Preview der nächsten 3 fälligen Karten (antippbar)
- [ ] Tages-Lernziel: "5/10 Karten heute" mit Fortschrittsring
- [ ] Motivations-Nachricht basierend auf Fortschritt

**Testfälle**
- **E2E:** Karten lernen → Home-Screen zeigt aktualisierte Werte

---

## Feature-Tickets: Priorität C — Erweiterte Lernmodi

### CL-C01 - Test-Modus (Multiple Choice, Wahr/Falsch)

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 3-4 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Prüfungssimulation: Aus den Karten eines Decks werden automatisch MC-Fragen und Wahr/Falsch-Fragen generiert. Timer optional. Ergebnis-Übersicht am Ende.

**Akzeptanzkriterien**
- [ ] Test starten von Deck-Detail oder Learn-Screen
- [ ] Fragetypen: Multiple Choice (4 Optionen, 1 korrekt), Wahr/Falsch
- [ ] Falsche Optionen werden aus anderen Karten des Decks generiert
- [ ] Timer pro Frage (optional, konfigurierbar)
- [ ] Ergebnis: Score, falsch beantwortete Karten markiert
- [ ] Falsche Karten können direkt zum Review hinzugefügt werden

**Testfälle**
- **Unit:** MC-Options-Generator (keine Duplikate, korrekte Antwort enthalten)
- **E2E:** Test starten → Fragen beantworten → Ergebnis sehen

### CL-C02 - Match-Spiel (Begriffe zuordnen)

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 3-4 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Spielerisches Zuordnen: Begriffe und Definitionen werden gemischt angezeigt. Nutzer tippt Paare an. Timer + Highscore.

**Akzeptanzkriterien**
- [ ] 6-8 Karten pro Runde (Begriff + Definition getrennt)
- [ ] Tippen auf Begriff, dann auf Definition → Match (grün) oder Fehler (rot)
- [ ] Timer läuft, Highscore wird gespeichert
- [ ] Animation bei Match (Karten verschwinden)
- [ ] Ergebnis: Zeit, Fehler, Highscore-Vergleich

### CL-C03 - Auto-Play (Karten-Slideshow)

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 1 PT
- **Abhängigkeiten:** CL-A01 (Flip-Animation)

**Beschreibung**
Play-Button startet automatischen Durchlauf: Karte zeigen → warten → umdrehen → warten → nächste Karte. Geschwindigkeit einstellbar. Pausieren/Stoppen jederzeit.

**Akzeptanzkriterien**
- [ ] Play-Button (▶) im Learn-Screen
- [ ] Automatischer Ablauf: Vorderseite (3s) → Flip → Rückseite (3s) → nächste Karte
- [ ] Geschwindigkeit einstellbar (1s/3s/5s/10s)
- [ ] Pause/Stop jederzeit möglich
- [ ] Optional: TTS vorlesen bei jeder Seite (wenn CL-B03 implementiert)

### CL-C04 - Image Occlusion

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 4-5 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Nutzer kann auf einem Bild Bereiche markieren (Rechtecke), die verdeckt werden. Beim Lernen wird jeweils ein Bereich aufgedeckt → der Rest ist verdeckt. Ideal für Anatomie, Diagramme, Karten.

**Akzeptanzkriterien**
- [ ] Bild hochladen → Bereiche mit Fingern/Rechteck markieren
- [ ] Pro markiertem Bereich wird eine Karte erstellt
- [ ] Beim Lernen: markierter Bereich verdeckt, Rest sichtbar
- [ ] Tippen → Bereich wird aufgedeckt
- [ ] Mehrere Bereiche pro Bild möglich

---

## Feature-Tickets: Priorität D — Daten, Ökosystem & Monetarisierung

### CL-D01 - Offline-Lernen (SQLite-Cache)

- **Priorität:** P1
- **Status:** Offen (Scaffold für Offline-Queue existiert)
- **Schätzung:** 4-5 PT
- **Abhängigkeiten:** keine

**Beschreibung**
Fällige Karten werden lokal in SQLite gecached. Reviews werden offline gespeichert und bei Verbindung synchronisiert. Conflict-Resolution bei gleichzeitiger Nutzung auf mehreren Geräten.

**Akzeptanzkriterien**
- [ ] SQLite-DB mit lokaler Kopie von Decks + fälligen Karten
- [ ] Review-Queue: Offline-Reviews werden lokal gespeichert
- [ ] Sync bei Verbindungsherstellung (automatisch)
- [ ] Conflict-Resolution: Server-Timestamp gewinnt bei Konflikt
- [ ] Visueller Indikator: Online/Offline-Status + "X Reviews warten auf Sync"

### CL-D02 - PDF-Import

- **Priorität:** P1
- **Status:** Offen (Job-Queue-Scaffold existiert)
- **Schätzung:** 3-4 PT
- **Abhängigkeiten:** keine

**Beschreibung**
PDF hochladen → Text extrahieren → KI generiert Flashcards → neues Deck. Unterstützt mehrseitige PDFs. Upload via R2 Signed URL.

**Akzeptanzkriterien**
- [ ] PDF-Upload im Scan-Screen (zusätzliche Option)
- [ ] Serverseitige Text-Extraktion (pdf-parse oder ähnlich)
- [ ] KI-Verarbeitung wie bei Text-Input (Gemini)
- [ ] Fortschrittsanzeige für längere PDFs
- [ ] Max. Dateigröße: 10 MB (Free), 50 MB (Pro)

### CL-D03 - Anki-Import

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 3-4 PT

**Beschreibung**
.apkg-Dateien (Anki-Export) importieren → clearn-Decks mit Karten erstellen. Unterstützt Basic- und Cloze-Karten. Medien-Anhänge optional.

### CL-D04 - Anki-Export

- **Priorität:** P2
- **Status:** Offen (Mock-Scaffold existiert)
- **Schätzung:** 2-3 PT

**Beschreibung**
clearn-Decks als .apkg exportieren (Anki-kompatibel). Kein Vendor-Lock-in.

### CL-D05 - Apple/Google Sign-In (OAuth)

- **Priorität:** P2
- **Status:** Offen
- **Schätzung:** 2-3 PT

**Beschreibung**
Zusätzlich zu E-Mail/Passwort: Sign-In with Apple und Google OAuth über Supabase Auth.

### CL-D06 - Paywall + RevenueCat

- **Priorität:** P1
- **Status:** Offen (Scaffold existiert)
- **Schätzung:** 3-4 PT

**Beschreibung**
Echte In-App-Käufe über RevenueCat. Free-Tier-Limits (z.B. 5 Scans/Monat), Pro-Tier ohne Limits. Paywall-Screen bei Limit-Erreichen.

### CL-D07 - Community-Decks

- **Priorität:** P2
- **Status:** Offen (In-Memory-Scaffold existiert)
- **Schätzung:** 4-5 PT

**Beschreibung**
Decks teilen, öffentlich durchsuchen, bewerten, kopieren. Moderation und Abuse-Prevention.

### CL-D08 - Onboarding-Flow

- **Priorität:** P1
- **Status:** Offen (Scaffold existiert)
- **Schätzung:** 2 PT

**Beschreibung**
Erster Start → Beispiel-Scan → erste Review → Erfolgserlebnis in unter 2 Minuten. Keine Registrierung nötig für den ersten Durchlauf.

---

## Empfohlene Umsetzungsreihenfolge

### Sprint Prio-A (1-2 Wochen)
- **CL-A01** Karte umdrehen (Flip)
- **CL-A02** Swipe links/rechts
- **CL-A03** Fortschrittsbalken
- **CL-A04** Begriff ↔ Definition
- **CL-A05** Stern/Favorit

### Sprint Prio-B (2-3 Wochen)
- **CL-B01** Streaks
- **CL-B02** Statistiken-Screen
- **CL-B03** Vorlesen (TTS)
- **CL-B04** Push-Erinnerungen
- **CL-B05** Home-Screen aufwerten

### Sprint Prio-C/D (fortlaufend)
- Nach Bedarf und Nutzer-Feedback priorisieren
