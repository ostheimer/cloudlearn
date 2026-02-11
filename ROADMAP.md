# ROADMAP

Letzte Aktualisierung: 2026-02-11 (Prio A+B komplett)

## Gesamtstatus

- Projektphase: **MVP-Kern funktionsfähig, UX-Verbesserungen + Feature-Ausbau nötig**
- Produktname: **clearn.ai** (vereinheitlicht)
- Plattformfokus: **Mobile first (iOS/Android)**
- Sprache: **Deutsch default**, erste Uebersetzung **Englisch**
- Detailliertes Umsetzungs-Backlog: **`BACKLOG.md`**

---

## Wettbewerbsanalyse

### Unsere USPs (Alleinstellungsmerkmale)
- **Kamera → KI → Flashcards** in einem Flow (kein Wettbewerber bietet das)
- **FSRS v5** (wissenschaftlich bester Spaced-Repetition-Algorithmus)
- **KI-generierte Deck-Titel** und inhaltlich passende Karten (Gemini 3 Flash)
- **Bild-Input** für KI-Verarbeitung (Vision → Flashcards)

### Feature-Vergleich mit Wettbewerbern

| Feature | Quizlet | Anki | Brainscape | **clearn.ai** |
|---------|:---:|:---:|:---:|:---:|
| Karte umdrehen (Tap/Animation) | ✅ | ✅ | ✅ | **✅** |
| Swipe links/rechts (weiß/weiß nicht) | ✅ | ❌ | ✅ | **✅** |
| Vorlesen (TTS) | ✅ | Add-on | ❌ | **✅** |
| Stern/Favorit markieren | ✅ | Flag | ❌ | **✅** |
| Auto-Play (Slideshow) | ✅ | ❌ | ❌ | ❌ |
| Begriff ↔ Definition umschalten | ✅ | ✅ | ❌ | **✅** |
| Fortschrittsbalken in Session | ✅ | ✅ | ✅ | **✅** |
| Streaks (Tagesserien) | ✅ | ❌ | ✅ | **✅** |
| Test-Modus (MC, Wahr/Falsch) | ✅ | ❌ | ❌ | ❌ |
| Match-Spiel (Timer) | ✅ | ❌ | ❌ | ❌ |
| Statistiken/Analytics | ✅ | ✅ | ✅ | **✅** (Home) |
| Image Occlusion | Diagramme | Add-on | ❌ | ❌ |
| Offline-Lernen | ✅ | ✅ | Teilweise | ❌ |
| KI-Kartenerstellung | Bezahlt | ❌ | ❌ | **✅ USP** |
| Kamera → Karten | ❌ | ❌ | ❌ | **✅ USP** |
| FSRS-Algorithmus | ❌ (einfach) | ✅ | Eigener | **✅** |
| Community-Decks | ✅ (riesig) | ✅ | ✅ | Scaffold |
| Push-Erinnerungen | ✅ | ❌ | ✅ | **✅** |
| PDF-Import | ❌ | Add-on | ❌ | Scaffold |
| Anki-Import/Export | ❌ | Nativ | ❌ | Scaffold |

---

## Funktionaler Ist-Stand (2026-02-11)

### Voll funktionsfähig (End-to-End mit echten Daten)

| Feature | Beschreibung |
|---------|-------------|
| **Scan → KI → Flashcards** | Kamera, Galerie oder Text → Gemini 3 Flash → Karten |
| **Deck-Management** | Erstellen, Umbenennen, Löschen, Suchen, KI-generierte Titel |
| **Card-Management** | Anzeigen, Bearbeiten, Löschen, Manuell hinzufügen (Editor-Modal) |
| **Karten zu bestehendem Deck** | Scan-Ergebnis in neues ODER vorhandenes Deck speichern |
| **FSRS-Review** | Again/Hard/Good/Easy mit persistenter Zustandsverwaltung |
| **Home-Dashboard** | Fällige Karten, Deck-Anzahl, Streak, Tagesziel, Genauigkeit, CTA |
| **Stern/Favorit** | Karten in Learn + Deck-Detail markieren, Sync mit DB |
| **Streaks** | Tagesserien-Tracking (current + longest), Streak-Banner auf Home |
| **Vorlesen (TTS)** | expo-speech auf Karten-Vorder-/Rückseite (de-DE) |
| **Push-Erinnerungen** | Lokale tägliche Notification, konfigurierbare Uhrzeit, An/Aus-Toggle |
| **Statistiken** | Reviews heute/Woche/gesamt, Genauigkeit, Lernverlauf (30 Tage) |
| **Auth** | Login, Registrierung, Passwort-Reset (Supabase) |
| **Profil** | E-Mail-Anzeige, Abo-Status, Sprache, Abmelden |
| **Daten-Persistenz** | Alles in Supabase PostgreSQL mit JWT-Auth |
| **Auto-Deploy** | Git-Push → Vercel baut `clearn-api` + `clearn-web` automatisch |

### Scaffold vorhanden, NICHT funktionsfähig

| Feature | Problem |
|---------|---------|
| Offline-Sync | Store existiert, wird nie aufgerufen |
| Paywall | Screen existiert, kein Weg dorthin, kein RevenueCat |
| PDF-Import | Nur Job-Queue, kein echtes Parsing |
| Anki-Export | Mock-Daten |
| Mathe-Formeln (Mathpix) | Mock |
| Community-Decks | In-Memory, kein Mobile-Screen |
| B2B Dashboard | In-Memory, kein Mobile-Screen |
| Beta-Feedback | In-Memory, kein Mobile-Screen |

## Phase 0 - Konzeptschärfung (abgeschlossen)

- [x] MVP klar abgegrenzt (Must/Should/Later + Nicht-Ziele)
- [x] KPI-Rahmen und North-Star-Metrik definiert
- [x] DSGVO-/Compliance-Mindestanforderungen dokumentiert
- [x] Sicherheitsbaseline dokumentiert
- [x] Offline-/Sync-Regeln (MVP) definiert
- [x] Betriebskonzept (SLOs, Alerts, Runbook-Vorbereitung) dokumentiert
- [x] Teststrategie als Basis fuer spaetere Playwright-/E2E-Tests festgelegt

## Phase 1 - MVP Build (8-10 Wochen)

- [x] Ticket-Backlog mit Akzeptanzkriterien und Testfaellen erstellt (`BACKLOG.md`)

### Foundation
- [x] Expo-Projekt Setup + Navigation
- [x] Supabase Setup (Auth, DB, RLS, Migrations)
- [x] Monitoring-Basics (Request IDs, Event-Mapping, CI-Testbasis)

### Core Product
- [x] Kamera + Galerie-Import (MVP-Scaffold)
- [x] On-Device OCR + manuelle Korrektur (Basis-Flow und Normalisierung)
- [x] KI-Endpoint Text -> Flashcards (Schema-Validation + Fallback)
- [x] Flashcard-Review-Flow (Again/Hard/Good/Easy)
- [x] FSRS-Integration inkl. Persistenz
- [x] Deck-Verwaltung (CRUD + Suche)

### Reliability & Commerce
- [x] Cloudflare R2 Upload via Signed URLs
- [x] Offline Retry-Queue + idempotenter Sync
- [x] Basis-Paywall (Scaffold mit Entitlements/Free-Limit)
- [x] TestFlight / Internal Testing (Runbook + Build-Preflight)

### Implementierter Stand im Repository

- [x] Monorepo (`apps/*`, `packages/*`) mit `pnpm` Workspaces
- [x] API-Endpunkte unter `apps/api/app/api/v1/*` für Scan, Decks, Cards, Learn, Subscription, Upload, Beta, Import, Export, Community, B2B
- [x] Supabase-Migration mit RLS in `apps/api/supabase/migrations`
- [x] Mobile App-Struktur mit Auth/Tabs, Capture-, OCR-, Review-, Paywall-, Onboarding-, Stats- und i18n-Scaffold
- [x] Testabdeckung für Contracts, Domain, API-Services und Mobile-Feature-Logik
- [x] Web App-Scaffold (`apps/web`) für Landing + Learn Client
- [x] Vercel-Projekte `clearn-web` und `clearn-api` erstellt; Preview-Deploys erfolgreich (`Ready`)
- [x] `apps/web` und `apps/api` für isolierte Vercel-Builds entkoppelt (lokale Verträge/Domain + standalone `tsconfig`)
- [x] Production-Deploys auf `clearn-web.vercel.app` und `clearn-api.vercel.app` erfolgreich (`Ready`)
- [x] Production-Härtung: Webhook fail-closed ohne Secret + keine clientseitige Tier-Overrides
- [x] Supabase-Datenbank live: Migration `20260209230000_init.sql` erfolgreich eingespielt (profiles, decks, cards, review_logs, scans + RLS)
- [x] Supabase-Umgebungsvariablen in Vercel für `clearn-api` und `clearn-web` konfiguriert (Production/Preview/Development)
- [x] Cloudflare R2 Bucket `clearn-uploads` (WEUR) erstellt und S3-Zugriff verifiziert (Upload + Read + Delete)
- [x] R2-Umgebungsvariablen in Vercel für `clearn-api` konfiguriert (Account ID, Access Key, Secret, Bucket, Endpoint)
- [x] AI-Provider-Keys in Vercel gesetzt und verifiziert: Gemini (44 Modelle) + OpenAI (123 Modelle)
- [x] Production-Deploy mit allen Env-Variablen (Supabase, R2, Gemini, OpenAI) erfolgreich
- [x] End-to-End Smoke Test bestanden: Health, Scan/Gemini, Deck CRUD, Card CRUD, FSRS Review, Due Cards, Subscription, Upload Sign, Webhook Security, Web Landing
- [x] Mobile App (Expo) mit Live-API verbunden: Scan→Gemini→Flashcards→FSRS Review Flow komplett funktionsfähig
- [x] iPhone-Test via Expo Go erfolgreich: App lädt fehlerfrei, alle Tabs erreichbar, Paketversionen synchronisiert
- [x] CORS-Middleware für API deployed (erlaubt Mobile- und Web-Zugriff)
- [x] Expo-Paketversionen auf SDK-54-Kompatibilität aktualisiert (expo-status-bar, react-native, react-native-screens)
- [x] Kamera-Integration: expo-camera + expo-image-picker mit Permissions (iOS/Android)
- [x] Scan-Screen: 3 Input-Modi (Foto aufnehmen, Galerie wählen, Text eingeben)
- [x] Echte Gemini 2.5 Flash API-Integration (Text→Flashcards + Vision/Bild→Flashcards)
- [x] Scan-API: imageBase64 + imageMimeType Support, async Gemini-Aufrufe mit Heuristik-Fallback
- [x] Upgrade auf Gemini 3 Flash (schnellstes + günstigstes Modell, Dez 2025)
- [x] Cloze-Karten-Fix: korrekte Lückenanzeige im Learn-Screen + verbesserter Gemini-Prompt
- [x] Kompletter Foto→AI→Flashcards→FSRS-Review Flow auf iPhone getestet und funktionsfähig
- [x] Supabase Auth: Echtes Login/Register/Passwort-Reset (E-Mail + Passwort)
- [x] Auth-Guard: Automatischer Redirect (nicht eingeloggt → Auth-Screen, eingeloggt → Tabs)
- [x] JWT-Token wird automatisch an alle API-Requests angehängt
- [x] Profil: E-Mail-Anzeige + Abmelden-Button
- [x] Gemini-Prompt: 5-25 Karten statt 3-10 (dynamisch nach Inhaltsdichte)
- [x] Fix: Separate Loading-States (Generieren vs. Speichern) — korrekte Ladeanzeige
- [x] **Supabase-DB-Anbindung: In-Memory Store komplett durch Postgres ersetzt**
- [x] **JWT Auth-Middleware: Alle API-Routes authentifiziert (Bearer Token)**
- [x] DB-Layer (`db.ts`): Decks, Cards, Reviews, Due Cards, Scan-History, Subscription — alles in Supabase
- [x] Auth-Layer (`auth.ts`): Token-Verifizierung + Auto-Profile-Erstellung
- [x] DB-Migration: `difficulty` + `tags` Spalten für Cards hinzugefügt
- [x] SUPABASE_SERVICE_ROLE_KEY auf Vercel Production konfiguriert
- [x] Services auf async/await umgestellt (Deck, Card, Review, Learn, Scan, Subscription, Sync, Anki-Export)
- [x] Tests in Unit (in-memory) und Integration (Supabase) aufgeteilt
- [x] Smoke Test: Health, Auth 401, Deck CRUD, Card CRUD, FSRS Review, Due Cards, Scan/Gemini, Subscription — alle bestanden
- [x] **Daten-Persistenz verifiziert**: Decks + Karten bleiben nach Redeploy erhalten
- [x] **Deck-Management in Mobile App**: Tippen → Deck-Detail, Long-Press → Umbenennen/Löschen, "+ Neu"-Button
- [x] **Card-Management**: Karten anzeigen, bearbeiten (Tap), löschen (Long-Press), manuell hinzufügen (Editor-Modal)
- [x] **Karten zu bestehendem Deck**: Scan-Ergebnis in neues ODER vorhandenes Deck speichern (Auswahl-Dialog)
- [x] Stack-Navigation mit Back-Button für Deck-Detail-Screen
- [x] API-Client erweitert: updateDeck, deleteDeck, listCardsInDeck, updateCard, deleteCard
- [x] **KI-generierter Deck-Titel**: Gemini erstellt passenden Titel (z.B. "Zellbiologie Grundlagen") statt generischem "Scan DD.MM.YYYY"

---

## Feature-Prioritäten (nach Nutzer-Impact)

### Priorität A — Lern-Experience (macht oder bricht die App)

| # | Ticket | Feature | Aufwand | Impact | Status |
|---|--------|---------|---------|--------|--------|
| A1 | CL-A01 | **Karte umdrehen (Tap + Flip-Animation)** | Klein | Riesig | ✅ Done |
| A2 | CL-A02 | **Swipe links/rechts** (weiß ich / weiß ich nicht) | Mittel | Riesig | ✅ Done |
| A3 | CL-A03 | **Fortschrittsbalken** in Lernsession (3/12 Karten) | Klein | Groß | ✅ Done |
| A4 | CL-A04 | **Begriff ↔ Definition umschalten** (Wechsel-Symbol) | Klein | Groß | ✅ Done |
| A5 | CL-A05 | **Stern/Favorit** markieren (Subset lernen) | Klein | Mittel | ✅ Done |

### Priorität B — Engagement & Motivation

| # | Ticket | Feature | Aufwand | Impact | Status |
|---|--------|---------|---------|--------|--------|
| B1 | CL-B01 | **Streaks** (Tagesserien + visuelles Tracking) | Mittel | Groß | ✅ Done |
| B2 | CL-B02 | **Statistiken** (Karten gelernt, Genauigkeit, Streak, Tagesziel) | Mittel | Groß | ✅ Done |
| B3 | CL-B03 | **Vorlesen (TTS)** (Button auf Karten-Vorder-/Rückseite) | Klein | Mittel | ✅ Done |
| B4 | CL-B04 | **Push-Erinnerungen** ("Lernzeit!", konfigurierbar) | Mittel | Groß | ✅ Done |
| B5 | CL-B05 | **Home-Screen aufwerten** (Streak, Tagesziel, Genauigkeit) | Mittel | Groß | ✅ Done |

### Priorität C — Erweiterte Lernmodi

| # | Ticket | Feature | Aufwand | Impact | Status |
|---|--------|---------|---------|--------|--------|
| C1 | CL-C01 | **Test-Modus** (Multiple Choice, Wahr/Falsch aus Kartenpool) | Groß | Groß | ❌ Offen |
| C2 | CL-C02 | **Match-Spiel** (Begriffe zuordnen, Timer, Highscore) | Groß | Mittel | ❌ Offen |
| C3 | CL-C03 | **Auto-Play** (Karten automatisch durchlaufen, einstellbare Geschwindigkeit) | Klein | Klein | ❌ Offen |
| C4 | CL-C04 | **Image Occlusion** (Bildteile verdecken als Lernkarte) | Groß | Mittel | ❌ Offen |

### Priorität D — Daten, Ökosystem & Monetarisierung

| # | Ticket | Feature | Aufwand | Impact | Status |
|---|--------|---------|---------|--------|--------|
| D1 | CL-D01 | **Offline-Lernen** (SQLite-Cache + Sync bei Verbindung) | Groß | Groß | ❌ Offen |
| D2 | CL-D02 | **PDF-Import** (echtes Parsing → KI → Karten) | Groß | Groß | ❌ Offen |
| D3 | CL-D03 | **Anki-Import** (.apkg → clearn-Decks) | Mittel | Mittel | ❌ Offen |
| D4 | CL-D04 | **Anki-Export** (clearn-Decks → .apkg) | Mittel | Mittel | ❌ Offen |
| D5 | CL-D05 | **Apple/Google Sign-In** (OAuth neben E-Mail) | Mittel | Mittel | ❌ Offen |
| D6 | CL-D06 | **Paywall + RevenueCat** (echte In-App-Käufe) | Groß | Groß | ❌ Offen |
| D7 | CL-D07 | **Community-Decks** (teilen, bewerten, suchen) | Groß | Groß | ❌ Offen |
| D8 | CL-D08 | **Onboarding-Flow** (Erster Lernerfolg in < 2 Min) | Mittel | Groß | ❌ Offen |

---

## Phase 2 - Beta Launch (TODO — Scaffold vorhanden, nicht funktionsfähig)

Voraussetzung: Priorität A + B abgeschlossen.

- [ ] Statistiken-Dashboard (CL-B02)
- [ ] Streaks + Push-Notifications (CL-B01, CL-B04)
- [ ] Onboarding-Flow (CL-D08)
- [ ] Incident-Runbook + Restore-Test in Regelbetrieb
- [ ] Landing Page + App Store Optimierung
- [ ] TestFlight Beta-Launch DACH

## Phase 3 - Growth (TODO — Scaffold vorhanden, nicht funktionsfähig)

Voraussetzung: Phase 2 + stabile Nutzerbasis.

- [ ] Erweiterte Lernmodi: Test-Modus, Match-Spiel, Auto-Play (CL-C01–C03)
- [ ] PDF-Import (CL-D02)
- [ ] Anki-Import/Export (CL-D03, CL-D04)
- [ ] Paywall + RevenueCat (CL-D06)
- [ ] Community-Decks (CL-D07)
- [ ] Web-App (funktionsfähig machen)
- [ ] B2B-Dashboard

## Exit-Kriterien

- Phase 1 → 2: Crash-free > 99,5 %, Time to First Card < 30s, Priorität A abgeschlossen
- Phase 2 → 3: D7 Retention > 25 %, Review Completion > 65 %, Trial → Paid > 35 %

## Aenderungsprotokoll

- 2026-02-09: ROADMAP initial erstellt.
- 2026-02-09: Konzeptstatus aus README in strukturierte Phasen ueberfuehrt.
- 2026-02-09: README konzeptionell erweitert (KPI, Compliance, Security, Sync, Betrieb, Teststrategie, Risiken).
- 2026-02-09: `BACKLOG.md` mit Phase-1 Tickets, Akzeptanzkriterien und Testfaellen erstellt.
- 2026-02-09: README um Verweis auf das Detail-Backlog erweitert.
- 2026-02-10: Wave 1 (CL-101, CL-102, CL-103, CL-201, CL-202, CL-203) mit lauffaehiger Codebasis umgesetzt.
- 2026-02-10: Wave 2 Kernpunkte (CL-204, CL-205, CL-206, CL-302) als MVP-Scaffold implementiert.
- 2026-02-10: Wave 3 (Paywall, Internal Testing, Perf, Runbook-Hardening) umgesetzt.
- 2026-02-10: Phase-2-Scaffold (Onboarding, Stats, Push-Prefs, Landing, Restore/Beta-Triage) umgesetzt.
- 2026-02-10: Phase-3-Scaffold (Learning-Modes, PDF, Mathpix, Anki, Community, Web, B2B) umgesetzt.
- 2026-02-10: Orchestrator-Loop mit Verify/Deploy/Poll-Skripten dokumentiert und ausführbar gemacht.
- 2026-02-10: README um einfache API-Erklärung inkl. Diagrammen erweitert.
- 2026-02-10: Projektname vollständig auf `clearn.ai` umgestellt (Branding und technische IDs).
- 2026-02-10: Vercel-Preview-Deploys für `clearn-web` und `clearn-api` erfolgreich eingerichtet und auf `Ready` verifiziert.
- 2026-02-10: Web/API-Apps für standalone Vercel-Deployments stabilisiert (ohne `workspace:*`-Runtime-Abhängigkeiten).
- 2026-02-10: Production-Deploys für Web/API erfolgreich eingerichtet und verifiziert (`Ready`).
- 2026-02-10: Production-Sicherheits-Härtung (RevenueCat Webhook fail-closed, kein `x-subscription-tier`-Override).
- 2026-02-10: Supabase-Datenbank aufgesetzt: CLI Login + Link + Migration Push (`profiles`, `decks`, `cards`, `review_logs`, `scans` + RLS).
- 2026-02-10: Supabase-Env-Variablen in Vercel für beide Projekte (`clearn-api`, `clearn-web`) auf Production/Preview/Development gesetzt.
- 2026-02-10: Cloudflare R2 aktiviert, Bucket `clearn-uploads` (WEUR) erstellt, S3-Zugriff getestet (Lesen/Schreiben/Löschen OK).
- 2026-02-10: R2-Env-Variablen (Account ID, Access Key, Secret, Bucket, Endpoint) in Vercel `clearn-api` gesetzt.
- 2026-02-10: Gemini + OpenAI API-Keys in Vercel `clearn-api` konfiguriert und verifiziert (beide aktiv).
- 2026-02-11: Production-Deploy mit allen konfigurierten Services; E2E Smoke Test 10/10 bestanden.
- 2026-02-11: Mobile App (Expo) für Handy-Test vorbereitet: Workspace-Deps ersetzt, API-Client integriert, Screens mit Live-API verbunden.
- 2026-02-11: CORS-Middleware in `apps/api/middleware.ts` implementiert und deployed.
- 2026-02-11: Expo-Paketversionen auf SDK-54-Kompatibilität fixiert; iPhone-Test via Expo Go erfolgreich (alle Tabs + API-Anbindung funktionsfähig).
- 2026-02-11: Kamera-Integration implementiert: expo-camera + expo-image-picker, Scan-Screen mit 3 Modi (Kamera/Galerie/Text).
- 2026-02-11: Echte Gemini 2.5 Flash API angebunden: Text- und Bild-Input für KI-generierte Flashcards. Heuristik-Fallback bei fehlendem API-Key.
- 2026-02-11: Upgrade auf Gemini 3 Flash; Cloze-Karten-Display-Fix; Foto→AI→Flashcards→Review auf iPhone erfolgreich getestet.
- 2026-02-11: Supabase Auth implementiert: Login/Register/Passwort-Reset, Auth-Guard, JWT-Token in API-Calls, Profil mit Abmelden.
- 2026-02-11: Gemini-Prompt auf 5-25 Karten erweitert; Separate Loading-States für Generieren vs. Speichern im Scan-Screen.
- 2026-02-11: **Supabase-DB-Anbindung**: In-Memory Store durch Postgres ersetzt; JWT Auth-Middleware; alle API-Routes authentifiziert; Daten-Persistenz verifiziert.
- 2026-02-11: **Deck/Card CRUD**: Deck-Detail-Screen, Card-Editor-Modal, Umbenennen/Löschen via Long-Press, Karten zu bestehendem Deck hinzufügen.
- 2026-02-11: **KI-generierte Deck-Titel**: Gemini-Prompt liefert `{ title, cards }` statt nur `[cards]`; Titel wird in Scan-Ergebnis + beim Speichern verwendet.
- 2026-02-11: **Vercel-Bereinigung**: `cloudlearn`-Projekt gelöscht; `clearn-api` + `clearn-web` mit Git verbunden; Root Directories korrekt gesetzt; Auto-Deploy verifiziert.
- 2026-02-11: **Wettbewerbsanalyse + Feature-Priorisierung**: Quizlet/Anki/Brainscape verglichen; 21 konkrete Feature-Tickets in 4 Prioritätsstufen (A–D) definiert; Ist-Stand (funktionsfähig vs. Scaffold) dokumentiert; Phase 2+3 als TODO korrigiert (waren fälschlich als [x] markiert).
- 2026-02-11: **UI-Redesign**: Lucide Icons (statt Emojis), Theme-System (colors/spacing/radius/typography/shadows), 3D-Flip-Animation (CL-A01), Fortschrittsbalken (CL-A03), react-native-reanimated für GPU-beschleunigte Animationen.
- 2026-02-11: **Swipe-Gesten (CL-A02)**: Links wischen = "Nochmal" (rot), rechts = "Gewusst" (grün). PanGestureHandler mit Schwelle (30% Bildschirm / Velocity 500px/s), animierte Farboverlays + Labels. Buttons bleiben als Alternative.
- 2026-02-11: **Begriff ↔ Definition Toggle (CL-A04)**: Wechsel-Button (ArrowLeftRight-Icon) in der Header-Leiste. Tauscht Vorder-/Rückseite für alle Karten der Session. Visuelles Label zeigt aktuellen Modus.
- 2026-02-11: **Stern/Favorit (CL-A05)**: DB-Migration (`starred` boolean auf `cards`), API-Update (PATCH), Star-Icon im Learn-Screen (Vorder+Rückseite) und Deck-Detail (pro Karte). Optimistisches UI-Update.
- 2026-02-11: **Streaks (CL-B01)**: DB-Migration (`current_streak`, `longest_streak`, `last_review_date`, `daily_goal` auf `profiles`), Streak-Update nach jeder Review, Streak-Banner + Best-Streak auf Home.
- 2026-02-11: **Statistiken (CL-B02)**: Stats-API erweitert (Reviews heute/Woche/gesamt, Genauigkeit, Lernverlauf 30 Tage), Home-Screen mit Tagesziel-Fortschrittsbalken + Genauigkeits-KPI.
- 2026-02-11: **Vorlesen/TTS (CL-B03)**: expo-speech integriert, Lautsprecher-Button auf Karten-Vorder- und Rückseite, Sprache de-DE, automatischer Stopp bei Kartenwechsel.
- 2026-02-11: **Push-Erinnerungen (CL-B04)**: expo-notifications, tägliche lokale Notification, konfigurierbare Uhrzeit (7-21 Uhr), An/Aus-Toggle im Profil-Screen, Android-Channel.
- 2026-02-11: **Home-Screen aufwerten (CL-B05)**: Streak-Banner mit Flammen-Icon, Tagesziel-Fortschrittsbalken, 3-KPI-Reihe (Fällig/Decks/Genauigkeit), Streak-Warnung wenn heute nicht gelernt.
