# ROADMAP

Letzte Aktualisierung: 2026-06-20 (Wettbewerb-Tabelle korrigiert — Auto-Play, Test-Modus, Match-Spiel als implementiert markiert)

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
| Swipe links/rechts (4-Stufen-Rating) | ✅ | ❌ | ✅ | **✅** |
| Vorlesen (TTS) | ✅ | Add-on | ❌ | **✅** |
| Stern/Favorit markieren | ✅ | Flag | ❌ | **✅** |
| Auto-Play (Slideshow) | ✅ | ❌ | ❌ | **✅** |
| Begriff ↔ Definition umschalten | ✅ | ✅ | ❌ | **✅** |
| Fortschrittsbalken in Session | ✅ | ✅ | ✅ | **✅** |
| Streaks (Tagesserien) | ✅ | ❌ | ✅ | **✅** |
| Test-Modus (MC, Wahr/Falsch) | ✅ | ❌ | ❌ | **✅** |
| Match-Spiel (Timer) | ✅ | ❌ | ❌ | **✅** |
| Statistiken/Analytics | ✅ | ✅ | ✅ | **✅** (Home) |
| Image Occlusion | ✅ (Scaffold) | Add-on | ❌ | ❌ |
| Offline-Lernen | ✅ | ✅ | Teilweise | **✅** (Download) |
| Deck-Aktionsmenü | ✅ | ✅ | ✅ | **✅** |
| Ordner/Kurse | ✅ | ❌ | ❌ | **✅** |
| Deck teilen | ✅ | ✅ | ✅ | **✅** |
| Deck duplizieren | ✅ | ✅ | ❌ | **✅** |
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
| **URL-Import (Web)** | URL einfügen → Seitentext + relevante Bilder extrahieren → KI-Karten |
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
| **Test-Modus (MC)** | Deck-basierter Quiz mit MC + Wahr/Falsch, Timer, Score, Ergebnis-Übersicht |
| **Bildquiz + Medienkarten** | Bildbasierte Quizfragen (Label ↔ Bild) + Markdown-Bildanzeige in Learn/Deck/Scan |
| **Match-Spiel** | Begriffe zuordnen (6 Paare), Timer, Fehler-Zähler, Sterne-Bewertung |
| **Auto-Play** | Automatischer Karten-Durchlauf (1s/3s/5s/10s), Play/Pause, TTS-Integration |
| **Image Occlusion** | Bild-Upload, Rechteck-Zeichnung, Bereiche benennen, Karten-Erstellung |
| **E2E-Tests** | 14 Playwright-Tests (11 API + 3 Web), alle bestanden |
| **Deck-Dreipunktemenü** | Bottom-Sheet mit 8 Aktionen: Download, Bearbeiten, Kurs, Ordner, Duplizieren, Teilen, Details, Löschen |
| **Kurse** | Kurs-CRUD + Decks zu Kursen zuordnen/entfernen (DB + API + Mobile UI) |
| **Ordner** | Ordner-CRUD + Decks zu Ordnern zuordnen/entfernen (DB + API + Mobile UI) |
| **Deck duplizieren** | Deck + alle Karten kopieren, automatischer Titel "(Kopie)" |
| **Deck teilen** | Share-Token generieren, Deep-Link, Native Share-Sheet |
| **Deck-Details** | Modal mit Kartenanzahl, Erstelldatum, letzte Änderung, Tags, zugeordnete Kurse/Ordner |
| **Offline-Download** | Deck + Karten in AsyncStorage cachen, visueller Indikator (Download-Icon) |
| **Deck bearbeiten** | DeckEditModal für Titel und Tags. Änderungen live im Header reflektiert |
| **Bibliothek-Tab** | Segmented Control (Decks/Kurse/Ordner), erstellt/umbenennt/löscht alle drei Typen |
| **Kurs-Detail-Screen** | Zeigt zugeordnete Decks, Umbenennen/Löschen, Deck entfernen per Long-Press |
| **Ordner-Detail-Screen** | Zeigt Unterordner + Decks, Umbenennen/Löschen, verschachtelte Navigation |

### Scaffold vorhanden, NICHT funktionsfähig

| Feature | Problem |
|---------|--------|
| Offline-Sync | Store existiert, wird nie aufgerufen |
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
- [x] RevenueCat-Paywall (Offerings, Kauf/Restore, 402-Weiterleitung, Webhook-Sync)
- [x] TestFlight / Internal Testing (Runbook + Build-Preflight)

### Implementierter Stand im Repository

- [x] Monorepo (`apps/*`, `packages/*`) mit `pnpm` Workspaces
- [x] API-Endpunkte unter `apps/api/app/api/v1/*` für Scan, Decks, Cards, Learn, Subscription, Upload, Beta, Import, Export, Community, B2B
- [x] Supabase-Migration mit RLS in `apps/api/supabase/migrations`
- [x] Mobile App-Struktur mit Auth/Tabs, Capture-, OCR-, Review-, Paywall-, Onboarding-, Stats- und i18n-Scaffold
- [x] Testabdeckung für Contracts, Domain, API-Services und Mobile-Feature-Logik
- [x] Vitest Workspace-Konfiguration: `npx vitest run` vom Root läuft über alle 6 Workspaces (67+ Tests, Playwright ausgeschlossen)
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
| C1 | CL-C01 | **Test-Modus** (Multiple Choice, Wahr/Falsch aus Kartenpool) | Groß | Groß | ✅ Done |
| C2 | CL-C02 | **Match-Spiel** (Begriffe zuordnen, Timer, Highscore) | Groß | Mittel | ✅ Done |
| C3 | CL-C03 | **Auto-Play** (Karten automatisch durchlaufen, einstellbare Geschwindigkeit) | Klein | Klein | ✅ Done |
| C4 | CL-C04 | **Image Occlusion** (Bildteile verdecken als Lernkarte) | Groß | Mittel | ✅ Done (Scaffold) |

### Priorität D — Daten, Ökosystem & Monetarisierung

| # | Ticket | Feature | Aufwand | Impact | Status |
|---|--------|---------|---------|--------|--------|
| D1 | CL-D01 | **Offline-Lernen** (SQLite-Cache + Sync bei Verbindung) | Groß | Groß | ❌ Offen |
| D2 | CL-D02 | **PDF-Import** (echtes Parsing → KI → Karten) | Groß | Groß | ❌ Offen |
| D3 | CL-D03 | **Anki-Import** (.apkg → clearn-Decks) | Mittel | Mittel | ❌ Offen |
| D4 | CL-D04 | **Anki-Export** (clearn-Decks → .apkg) | Mittel | Mittel | ❌ Offen |
| D5 | CL-D05 | **Apple/Google Sign-In** (OAuth neben E-Mail) | Mittel | Mittel | ❌ Offen |
| D6 | CL-D06 | **Paywall + RevenueCat** (echte In-App-Käufe) | Groß | Groß | ✅ Done (Feature-Gating DB-backed; Usage-Indicator; Auto-Paywall) — App-Store-Produkte: `CL-MON-01`/`CL-MON-02` offen |
| D7 | CL-D07 | **Community-Decks** (teilen, bewerten, suchen) | Groß | Groß | ❌ Offen |
| D8 | CL-D08 | **Onboarding-Flow** (Erster Lernerfolg in < 2 Min) | Mittel | Groß | ✅ Done |

---

## Phase 2 - Beta Launch (TODO — teilweise abgeschlossen)

Voraussetzung: Priorität A + B abgeschlossen.

- [x] Statistiken-Dashboard (CL-B02)
- [x] Streaks + Push-Notifications (CL-B01, CL-B04)
- [x] Onboarding-Flow (CL-D08)
- [ ] Incident-Runbook + Restore-Test in Regelbetrieb
- [ ] Landing Page + App Store Optimierung
- [ ] TestFlight Beta-Launch DACH

## Phase 3 - Growth (TODO — Scaffold vorhanden, nicht funktionsfähig)

Voraussetzung: Phase 2 + stabile Nutzerbasis.

- [x] Erweiterte Lernmodi: Test-Modus, Match-Spiel, Auto-Play, Image Occlusion (CL-C01–C04)
- [ ] PDF-Import (CL-D02)
- [ ] Anki-Import/Export (CL-D03, CL-D04)
- [ ] Paywall + RevenueCat (CL-D06, Kernflow umgesetzt; finale Store-Offerings ausstehend)
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
- 2026-02-12: RevenueCat-Kernintegration umgesetzt: Mobile Offerings/Kauf/Restore, 402-Weiterleitung auf Paywall, Backend-Webhook-Mapping + Subscription-Fallback auf `free`, Unit-Tests ergänzt.
- 2026-02-12: Expo-Start-Fehler behoben: `react-native-purchases` als ungültiges Config-Plugin aus `apps/mobile/app.json` entfernt; `expo config` + `pnpm --filter @clearn/mobile dev` erfolgreich verifiziert.
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
- 2026-02-11: **QA & Bugfix-Runde**: TypeScript-Fehler in `offlineQueueStore.ts` behoben (`@clearn/domain`/`@clearn/contracts` durch Inline-Typen ersetzt), Expo SDK 54 Paketversionen korrigiert (gesture-handler ~2.28.0, reanimated ~4.1.1, svg 15.12.1). API-Tests 19/19, Mobile-Tests 15/15, iOS-Bundle fehlerfrei (3374 Module), API Smoke-Test 10/10 bestanden.
- 2026-02-11: **Test-Modus (CL-C01)**: Neuer `quiz.tsx` Screen mit Multiple-Choice und Wahr/Falsch-Fragen. Automatische Distraktoren aus anderen Deck-Karten. Timer optional, Score + Ergebnis-Übersicht. Deck-Detail zeigt "Test"-Button ab 2+ Karten.
- 2026-02-11: **Match-Spiel (CL-C02)**: Neuer `match.tsx` Screen mit Kachel-Grid (6 Paare max). Timer, Fehler-Zähler, Sterne-Bewertung (0-3). Visuelles Feedback bei Match/Fehler. Deck-Detail zeigt "Match"-Button.
- 2026-02-11: **Auto-Play (CL-C03)**: Play/Pause-Button im Learn-Screen Header. Geschwindigkeit 1s/3s/5s/10s. Automatisches Flip + "Good"-Rating + nächste Karte. TTS-Vorlesen während Auto-Play.
- 2026-02-11: **Image Occlusion (CL-C04)**: Neuer `occlusion.tsx` Screen. Bild-Auswahl (Galerie), PanResponder für Rechteck-Zeichnung. Bereiche benennen/löschen, Speichern als Deck mit Karten.
- 2026-02-11: **E2E-Tests (Playwright)**: 14 Tests aufgesetzt und bestanden — 11 API-Tests (Health, Auth 401, Auth 200, Deck-CRUD, Card-CRUD, Starred, Review + FSRS, Streak, Stats, Cleanup) + 3 Web-Tests (Landing Page, Responsive, Performance). `playwright.config.ts` mit API + Web Projekten.
- 2026-02-12: **Expo Go SDK 54 Fix**: `react-native-reanimated@4.1.1` + `react-native-worklets@0.5.1` gepinnt für Worklets-Kompatibilität.
- 2026-02-12: **FSRS-Bug behoben**: `reviewService.ts` lädt jetzt bestehende FSRS-Kartenwerte aus der DB statt jedes Mal eine leere Karte zu erzeugen. Intervalle wachsen jetzt korrekt (erst Minuten → Stunden → Tage → Wochen → Monate). Neue DB-Felder: `fsrs_elapsed_days`, `fsrs_scheduled_days`, `fsrs_learning_steps`.
- 2026-02-12: **4-Level Swipe-Rating**: Swipe-Distanz/Geschwindigkeit mappt auf alle 4 FSRS-Ratings (sanft links=Schwer, stark links=Nochmal, sanft rechts=Gut, stark rechts=Leicht). Visuelle Labels und Farboverlays pro Stufe.
- 2026-02-12: **UI-Verbesserungen**: 4 Bewertungs-Buttons immer sichtbar (kein "Antwort anzeigen"-Gate), Tap togglet Karte immer (Front↔Back), Swipe immer aktiv (ohne vorheriges Tippen).
- 2026-02-12: **Quizlet-Style Free-Drag Swipe**: Karte folgt Finger frei in 2D mit Tinder-artiger Rotation. Labels "NOCHMAL"/"GEMERKT" blenden graduell ein mit Skalierung. Loslassen nach Threshold: Karte fliegt raus + Rating; vorher: federndes Snap-Back. Hintergrund-Farbindikator (rot/grün).
- 2026-02-12: **Dark Mode**: Komplett neues Farbschema (22 Farben), persistenter Zustand via Zustand+AsyncStorage. Toggle im Profil-Screen (Moon/Sun-Icon). `useColors()` Hook für dynamische Theme-Farben.
- 2026-02-12: **Swipe-Animationen verbessert**: Sichtbare Fly-out-Animation (Karte fliegt nach links/rechts weg mit geschwindigkeitsbasierter Duration + Easing). Neue Karte erscheint mit Scale+Opacity-Eingangsanimation (spring von 0.88→1.0 + fade-in). Bouncy Snap-back beim Zurückfedern (damping: 8, stiffness: 120).
- 2026-02-12: **Deck-Dreipunktemenü**: Bottom Sheet (`@gorhom/bottom-sheet`) mit 8 Aktionen im Deck-Detail-Header (MoreVertical-Icon). Alle Aktionen voll funktional implementiert.
- 2026-02-12: **Kurse**: DB-Schema (`courses`, `course_decks`), API-Routen (`/courses`, `/courses/[id]/decks`), Service-Layer, Mobile CoursePickerModal mit Erstellen + Zuordnen.
- 2026-02-12: **Ordner**: DB-Schema (`folders`, `folder_decks` mit verschachtelter Ordnerstruktur via `parent_id`), API-Routen (`/folders`, `/folders/[id]/decks`), Mobile FolderPickerModal.
- 2026-02-12: **Deck duplizieren**: API-Route `POST /decks/[id]/duplicate` kopiert Deck + alle Karten. Navigation zum Duplikat. Titel automatisch "(Kopie)".
- 2026-02-12: **Deck teilen**: Share-Token (UUID) in DB, API-Routen `POST /share` + `GET /share/[token]`. Native Share-Sheet (React Native `Share.share()`) mit Deep-Link.
- 2026-02-12: **Deck-Details-Modal**: Kartenanzahl, Erstelldatum, letzte Änderung, Tags, zugeordnete Kurse/Ordner.
- 2026-02-12: **Offline-Download**: Deck + Karten via Export-API in AsyncStorage cachen. Grünes Download-Icon im Header wenn offline verfügbar.
- 2026-02-12: **Deck bearbeiten**: DeckEditModal für Titel und Tags. Änderungen live im Header reflektiert.
- 2026-02-12: **i18n erweitert**: 65+ neue Übersetzungskeys (de + en) für alle Menüpunkte, Modals, Feedback-Meldungen.
- 2026-02-12: **Tests**: Unit-Tests für Course/Folder/Duplicate/Share Services + E2E Playwright-Tests für alle neuen API-Routen.
- 2026-02-12: **Learn-UX-Feinschliff**: Langsameres Snap-Back, längerer sichtbarer Fly-out, Exit-Button (`X`) im Lernmodus, Zurück-Navigation zur letzten Karte (Arrow-Button), Tab-Bar im Lernmodus ausgeblendet.
- 2026-02-12: **Theme-Verhalten verbessert**: Tab-Bar nutzt nun dasselbe dynamische Farbschema wie der Rest der App; neuer Systemmodus (folgt Geräte-Light/Dark) mit Auswahl in Profil.
- 2026-02-13: **Learn-Screen Redesign**: Header + Kartenfortschritt zentriert; Swipe-Counter (rot/grün) für falsch/richtig; Lautsprecher- und Stern-Icons von Karte entfernt (unten rechts platziert); Schriftgröße erhöht; "Gemerkt→" entfernt; Zurück-Pfeil nur noch als Icon unter den Buttons; Fly-Out langsamer + sichtbarer; Snap-Back noch weicher; alle hartkodierten Strings in i18n überführt (de+en).
- 2026-02-13: **Supabase-Migration eingespielt**: `courses`, `folders`, `course_decks`, `folder_decks` Tabellen + `share_token`/`source_deck_id` auf `decks` in Production-DB angelegt (via `supabase db push`).
- 2026-02-13: **Vercel-Bereinigung (erneut)**: Versehentlich neu erstelltes `cloudlearn` Root-Vercel-Projekt endgültig gelöscht (verursachte Error-Deploys bei jedem Push). Lokale `.vercel`-Config im Repo-Root entfernt. `clearn-api` + `clearn-web` bleiben die einzigen aktiven Projekte.
- 2026-02-13: **Alle Tests bestanden**: 28/28 E2E-Playwright-Tests, 29 API-Unit-Tests, 24 Mobile-Unit-Tests — keine Regressionen.
- 2026-02-13: **Vitest Workspace-Konfiguration**: Root `vitest.config.ts` mit `test.projects` für alle 6 Workspaces. `npx vitest run` vom Root liefert jetzt 67 passed / 14 skipped über alle Packages. Playwright-Specs korrekt ausgeschlossen. `migrations.test.ts` Pfad-Fix (`import.meta.url` statt `process.cwd()`). `apps/web/vitest.config.ts` hinzugefügt.
- 2026-02-14: **Bibliothek-Tab**: Decks-Tab durch "Bibliothek" ersetzt mit Segmented Control (Decks | Kurse | Ordner). Unified Search, Create/Rename/Delete per Long-Press-Menü, Library-Icon in Tab-Bar.
- 2026-02-14: **Kurs-Detail-Screen** (`/course/[id]`): Zugeordnete Decks anzeigen, Umbenennen/Löschen via Drei-Punkte-Menü, Deck per Long-Press aus Kurs entfernen.
- 2026-02-14: **Ordner-Detail-Screen** (`/folder/[id]`): Unterordner + Decks anzeigen mit verschachtelter Navigation, Umbenennen/Löschen, Deck per Long-Press entfernen.
- 2026-02-14: **API-Client erweitert**: `listDecksInCourse()` + `listDecksInFolder()` hinzugefügt. 69 neue i18n-Keys (de + en).
- 2026-02-14: **Bibliothek-Detailnavigation über Tab-Stack**: Neue In-Tab-Routen `/(tabs)/library-course/[id]` und `/(tabs)/library-folder/[id]` (in Tab-Bar versteckt via `href: null`) halten die Tab-Bar beim Öffnen von Kursen/Ordnern aus der Bibliothek sichtbar. `buildLibraryCourseRoute()`/`buildLibraryFolderRoute()` + Tests (`src/navigation/libraryRoutes.test.ts`) ergänzt. Header-Options via `navigation.setOptions(...)`; Drei-Punkte-Button im Header zentriert.
- 2026-02-14: **Screen-Dokumentation & Wireframes**: `docs/screens/SCREENS.md` mit vollständiger Screen-Map (Route, Zweck, Inhalte, Navigation, Zustände) für alle 13 Screens. Wireframes in `docs/screens/wireframes/` für Home, Scan, Lernen, Bibliothek, Kurs-/Ordner-/Deck-Detail, Profil (08 von 13); Auth, Paywall, Quiz, Match, Occlusion als Platzhalter zum Nachziehen.
- 2026-02-14: **Screen-Dokumentation Ist-Zustand**: `docs/screens/SCREENS.md` komplett überarbeitet — dokumentiert jetzt den exakten Ist-Zustand aller 13 Screens wie auf iPhone 16 Pro gerendert. Jede Komponente mit exakten Farb-Hex-Codes, Spacing-Werten (aus theme.ts), Icon-Namen (Lucide), Font-Größen, borderRadius, Schatten-Werten. Inkl. Design-Token-Referenz (Light/Dark), Tab-Bar-Konfiguration, Zustands-Beschreibungen (Loading, Empty, Error, Completed).
- 2026-02-14: **Screen-Screenshots**: 13 hochpräzise Mockup-Screenshots (iPhone 16 Pro, 393×852pt) in `docs/screens/screenshots/` abgelegt. Alle basierend auf exaktem Code: Auth, Home, Scan, Lernen, Bibliothek, Profil, Deck-Detail, Paywall, Quiz, Match, Image Occlusion, Kurs-Detail, Ordner-Detail. SCREENS.md mit Screenshot-Referenzen für jeden Screen ergänzt.
- 2026-02-16: **Xcode 26.2 installiert**: iOS Simulator Runtime (iOS 26.2, 8.39 GB), iPhone 16 Pro Simulator erstellt und gebootet.
- 2026-02-16: **Expo Go auf Simulator**: App erfolgreich im iOS-Simulator geladen via `npx expo start --ios`.
- 2026-02-16: **Echte Simulator-Screenshots**: 11 native Screenshots (1179×2556px @3x) aufgenommen — Auth/Login, Home (mit Testdaten), Scan, Lernen (Empty State), Bibliothek (mit Deck), Profil, Paywall, Deck-Detail (mit 3 Karten), Quiz/Test, Match, Image Occlusion. AI-Mockups durch echte Screenshots ersetzt. Testdaten via Supabase API + clearn-API erstellt (Test-User, Deck "Deutsch Vokabeln" mit 3 Karten). SCREENS.md aktualisiert.
- 2026-02-16: **Simulator-Automatisierung**: cliclick für Touch-Interaktion, xcrun simctl für Screenshots und Deep-Link-Navigation. Python-Skript für Koordinaten-Mapping (Fensterposition → Device-Prozent).
- 2026-02-16: **Kurs- & Ordner-Screenshots nachgeholt**: Test-Kurs "Deutsch A1" + Test-Ordner "Sprachen" via API erstellt, Deck zugeordnet. 4 neue Screenshots: Bibliothek Kurse-Tab, Bibliothek Ordner-Tab, Kurs-Detail, Ordner-Detail. SCREENS.md mit Screenshot-Referenzen und Varianten-Beschreibungen (Kurse-/Ordner-Tab) ergänzt. Insgesamt 15 Screenshots.
- 2026-02-16: **Learn-Screen-Bug behoben**: `useEffect(fn, [])` durch `useFocusEffect(useCallback(fn, deps))` ersetzt. Der Learn-Tab lädt jetzt fällige Karten bei jedem Tab-Fokus neu statt nur beim ersten Mount. Screenshot `04-learn-active.png` mit aktiven Karten aufgenommen (Karte 1 von 3: "Hund").
- 2026-02-19: **Soll-Konzept**: SCREENS.md um Abschnitt "Soll-Konzept (Ziel-UI)" erweitert. 3 Prioritäts-Ebenen mit konkreten UI-Verbesserungen je Screen (Home, Lernen, Bibliothek, Kurs/Ordner-Detail, Scan, Auth, Profil, Deck-Detail). Nicht-Ziele dokumentiert. Nächste empfohlene Umsetzungsschritte: Tab-Badge, Deck-Kartenanzahl, "Alle lernen"-Button.
- 2026-02-16: **Kurs/Ordner-Detail: Titel-Fix + Stale-Closure-Fix**: Neue GET-Endpunkte `GET /api/v1/courses/[id]` und `GET /api/v1/folders/[id]` im API hinzugefügt. Mobile: `getCourse()` + `getFolder()` API-Client-Funktionen. Screen lädt Titel aus API wenn kein URL-Parameter vorhanden. Handler (`handleRenameCourse`, `handleDeleteCourse`, `handleMoreMenu`) mit `useCallback` stabilisiert, `handleMoreMenu` in `useLayoutEffect`-Dependencies aufgenommen.
- 2026-02-14: **Tab-Badge für fällige Karten**: `sessionStore` um `dueCount`/`setDueCount` erweitert. `index.tsx` schreibt `dueCount` nach `getStats()`. `_layout.tsx` zeigt `tabBarBadge` auf dem "Lernen"-Tab wenn `dueCount > 0`.
- 2026-02-14: **Deck-Kartenanzahl in Bibliothek**: `db.ts listDecks` Query um `cards(count)` Sub-Select erweitert. `DeckRecord` + mobiles `Deck`-Interface um `cardCount?: number` ergänzt. `decks.tsx` zeigt "X Karten" unter dem Deck-Titel an. 4 neue i18n-Keys (de+en).
- 2026-02-14: **"Alle lernen"-Button in Kurs/Ordner-Detail**: Button erscheint wenn `decks.length > 0`. Lädt alle fälligen Karten via `getDueCards()`, filtert clientseitig nach Deck-IDs, startet Review-Session via `useReviewSession.start()` und navigiert zu `/(tabs)/learn`.
- 2026-02-14: **"Zuletzt gelernt"-Navigation korrigiert**: Kachel auf Home-Screen navigiert jetzt direkt zur Lernsession (`/(tabs)/learn`) statt zum Deck-Bearbeitungsmodus. Icon von `Clock` auf `BookOpen` geändert.
- 2026-02-24: **Render Error behoben**: `ThemeProvider` von `@react-navigation/native` verursachte „Element type is invalid … got: object“. Theme wird nun direkt über die `theme`-Prop an die `Stack`-Komponente übergeben; `ThemeProvider`-Wrapper entfernt.
- 2026-02-24: **App im iOS-Simulator**: cloudlearn startet lokal mit `CI=false pnpm dev -- --ios --port 8083` im iPhone-Simulator (Metro auf 127.0.0.1:8083). QR-Code/URL für Expo Go auf dem Handy: `exp://<LAN-IP>:8083`.
- 2026-03-11: **Onboarding-Routing Fix**: Root-Redirects in `apps/mobile/app/_layout.tsx` über `resolveRootRedirect()` zentralisiert. Fix für zwei echte Simulator-Funde: leerer Root-Screen bei direktem App-Start und veralteter `onboardingCompleted`-Status in derselben Session nach `completeAndPersist()`. Authentifizierte Nutzer werden nun nach geladenem Onboarding-Status korrekt zu `/onboarding` bzw. `/(tabs)` geleitet; bei abgeschlossenem Onboarding wird auch eine geöffnete Onboarding-Route sofort auf Tabs umgeleitet.
- 2026-03-11: **Simulator-Verifikation D8**: Onboarding manuell im iPhone-16-Pro-Simulator durchgespielt (Schritt 1 → Schritt 2 → Schritt 3 → `Jetzt starten`). Starter-Deck wurde angelegt und die Navigation wechselte in die Lernsession. Zusätzliche Unit-Tests für Root-Redirect-Fälle ergänzt (`src/navigation/rootRedirect.test.ts`).
- 2026-02-24: **Doku & Regression**: SCREENS.md Ist-Zustand angepasst (Tab-Badge, 1.5 Zuletzt gelernt → learn/BookOpen, Bibliothek Kartenanzahl, Kurs/Ordner „Alle lernen“). Manuelle Regression-Checkliste `docs/testing/regression-mobile.md` angelegt. Unit-Tests für sessionStore dueCount und Filter-Logik; Playwright-Tests für GET learn/due und decks mit cardCount.
- 2026-02-28: **URL-Import Phase 1**: Neuer API-Endpunkt `POST /api/v1/import/url` mit URL-Extraktion (Text + Bilder), multimodaler LLM-Generierung und Speicherung ins Deck. Mobile Scan-Screen um URL-Eingabe erweitert, Quiz um Bildfragen ergänzt, Kartenansichten (Scan/Deck/Learn) rendern Markdown-Bilder. Neue Unit-Tests für Extractor/Service/Quiz-Media sowie E2E-Spec für URL-Import (auf Live-Umgebung derzeit per Skip, solange Endpoint noch nicht ausgerollt ist).
- 2026-03-01: **Monetarisierung Phase 1 (CL-D06)**: Feature-Gating vollständig implementiert. DB-Migration (`ai_scans_used`, `ai_url_imports_used`, `usage_period_start` auf `profiles`). DB-backed Quota-Enforcement ersetzt in-memory Store (persistent über Serverless-Restarts). Separate Limits für KI-Scans (5/Monat) und URL-Importe (2/Monat). Neuer Endpoint `GET /api/v1/usage`. `TIER_LIMITS`-Objekt in `packages/contracts` für Free/Pro/Lifetime. Scan-Screen zeigt Usage-Badge (z.B. „2/5 KI“). Automatischer Paywall-Trigger bei 402 via globalem `registerPaywallTrigger()`. Paywall-Screen um Feature-Vergleichsliste und Usage-Progressbars erweitert. Jährliches Angebot mit „Bestes Preis-Leistungs-Verhältnis“-Badge hervorgehoben. Supabase Edge Function `reset-ai-usage` für monatlichen Cron-Reset. RevenueCat Setup-Dokumentation (`docs/monetization/REVENUECAT_SETUP.md`). 59 API-Tests + 12 Contracts-Tests grün.
- 2026-03-01: **URL-Import Bildfragen-Tuning**: Bildkandidaten werden nach Komponenten-Relevanz priorisiert, `componentHint` wird aus HTML-Metadaten extrahiert und in den multimodalen Prompt gegeben. Prompt-Regeln fokussieren Bildfragen stärker auf UI-Komponenten statt Branding; URL-LLM-Aufruf hat Retry + Quality-Gate-Regeneration (mind. 2 komponentenbezogene Bildfragen, falls Bilder vorhanden). Neue API-Unit-Tests fuer den Quality-Gate-Flow (`llmUrlQualityGate`) sowie erweiterte Tests fuer Extractor/Service sind gruen.
- 2026-02-25: **Onboarding-Flow (CL-D08)**: Nach erstem Login 3 Schritte (Willkommen → So funktioniert's → Dein erstes Deck). „Jetzt starten“ erstellt ein Starter-Deck mit 3 Beispielkarten (Hund/dog, Katze/cat, Vogel/bird), speichert „onboarding completed“ in AsyncStorage und navigiert zum Learn-Tab. Root-Layout lädt Onboarding-Status und leitet neue Nutzer nach Auth auf `/onboarding` um. i18n de+en.
- 2026-03-11: **Gitignore & thematische Commits**: `.gitignore` um Temp-Screenshots (`.tmp-sim-*.png`, `sim-window-desktop.png`), `.tmp/` und `apps/mobile/expo-qr.png` erweitert. Übrige Änderungen in 11 thematische Commits gruppiert (Contracts, API Usage Limits, URL-Import, Scan-Quota, Mobile Usage/Paywall/Tabs/Libs, Docs/E2E). API-Build-Fix: `qualityDirective` bei `exactOptionalPropertyTypes` nur bei Vorhandensein übergeben (`llm.ts`). Vercel-Deployment nach Fix erfolgreich (Ready).
- 2026-02-12: **LP-System Phase 2**: Scan-Screen zeigt LP-Balance-Badge (⚡N LP) + LP-Kosten auf jedem Action-Button (⚡10 LP). `LpInsufficientModal` öffnet sich bei fehlendem LP-Guthaben mit Optionen: Werbung ansehen (+5 LP), LP-Pack kaufen, Upgrade. `useRewardedAd`-Hook (Scaffold für AdMob, server-seitig fertig). `LpStoreScreen` (`/lp-store`) mit Balance, Tages-Earn-Progressbars, Rewarded-Ad-Button, LP-Pack-Grid (100/300/750/2000 LP) und Pro-Teaser. Paywall-Screen LP-Balance statt monatliche Quota. 69 API-Tests grün.
- 2026-02-12: **LP-System Phase 1 abgeschlossen**: DB-Migration (`lp_balance`, `lp_earned_today`, `lp_ads_today`, `lp_period_start`, `referral_code` auf `profiles`; neue Tabellen `lp_transactions`, `rewards_claimed`). API: `GET /api/v1/usage` auf LP umgestellt; neue Routen `/api/v1/lp/balance`, `/api/v1/lp/earn`, `/api/v1/lp/spend`, `/api/v1/lp/milestone`. `featureGates.ts` überarbeitet: Lifetime-Tier entfernt, echte Limits, LP-Kosten pro Tier, LP-Verdienregeln, LP-Packs. `revenueCatService.ts` ohne Lifetime. Mobile: `LpBadge`-Komponente im Home-Header, LP verdienen nach Review-Session, `usageStore.ts` auf LP-Format migriert. 69 API-Tests grün.
- 2026-03-13: **clearn auf iPhone installiert**: `expo-dev-client` verursacht `reloadAppAsync`-Kompilierungsfehler in `expo-dev-menu` — entfernt. Preview-Build ohne Dev-Client kompiliert sauber (93 Pods, ~11 Min Erstbuild). App via `npx expo run:ios --device` auf „Andreas iPhone“ (iOS 26.3.1) deployed. Signing: „Apple Development: Andreas Ostheimer (Z3ADG9J8X9)“. Metro Bundler auf localhost:8081.
- 2026-03-13: **iOS Prebuild für Xcode**: `npx expo prebuild --platform ios --clean` generiert nativen `ios/`-Ordner mit `clearn.xcworkspace`. 104 CocoaPods (inkl. Google-Mobile-Ads-SDK, RevenueCat, Expo Dev Client). `newArchEnabled: true` für React Native New Architecture. Metro-Bundler (`npx expo start --dev-client`) läuft auf Port 8081. Xcode-Workflow: Workspace öffnen → Signing Team auswählen → iPhone anschließen → Build & Run (⌘R).
- 2026-03-13: **Erster EAS Android Build erfolgreich**: Preview-APK generiert (`4DQg4tduDMZ5F38dfX2mt9.apk`). App-Icons (icon.png, adaptive-icon.png, favicon.png, splash.png) generiert. EAS Secrets konfiguriert (API URL, Supabase, AdMob Test-IDs, google-services.json). `compileSdkVersion` auf 36 erhöht (benötigt von `androidx.core:core:1.17.0`). Development-Build scheitert an `expo-dev-menu` Kotlin-Inkompatibilität mit SDK 36 – Preview/Production-Profile funktionieren.
- 2026-03-12: **EAS Build Setup**: `eas.json` mit 4 Profilen (development/simulator/preview/production). `app.config.js` für dynamische AdMob-App-IDs (Test-IDs in Dev/Preview, echte IDs via `EXPO_PUBLIC_ADMOB_APP_*` in Production). `buildNumber: 1` + `versionCode: 1` + `runtimeVersion`-Policy. `updates.url` auf EAS Project ID (`5495e637`) gesetzt. `.env.example` für API + Mobile. `.gitignore` um `google-services.json`, `google-play-service-account.json`, `.p8/.p12/.mobileprovision` ergänzt. EAS-Build-Runbook `docs/runbooks/eas-build.md` mit 6-Schritt-Checklist (AdMob, Firebase, Credentials, Build, Submit, OTA).
- 2026-03-12: **Phase 5 – Deployment-Infrastruktur**: Supabase-Migration `20260312200000_add_social_features.sql` in Production eingespielt (`friend_connections`, `push_tokens`, `leaderboard_public`-View, Streak-Spalten). `app.json` um `react-native-google-mobile-ads`-Plugin (AdMob Test-App-IDs iOS+Android, SKAdNetwork-Liste), `expo-notifications`-Plugin, `expo-build-properties` (iOS 15.1, Android compileSdk 35), `bundleIdentifier: app.clearn` und `package: app.clearn` erweitert. `CRON_SECRET` in Vercel (Production/Preview/Development) gesetzt. `POST /api/v1/push/streak-alerts` live getestet → `{"sent":0}` (korrekt, keine aktiven Nutzer mit Token noch).
- 2026-03-12: **LP-System Phase 4 – Virales Wachstum**: DB-Migration `friend_connections` (bidirektional, RLS), `push_tokens`-Tabelle (Expo Push), `leaderboard_public`-View. API: `GET /leaderboard/global` (Top-50 nach LP), `GET /leaderboard/friends` (Freunde + eigener Eintrag), `GET|POST|DELETE /friends` (Freundschaft bidirektional), `POST /push/register` (Token-Upsert), `POST /push/streak-alerts` (Cron-Endpoint). `notificationService.ts` mit Expo-Push-HTTP-API, `sendStreakAlertNotifications()` (Freunde bei Streak-Gefahr), `sendSelfStreakReminder()`. Mobile: Leaderboard-Screen (`/leaderboard`) mit Global/Freunde-Tabs, Podest-Visualisierung (Platz 1/2/3), Rang-Badges, LP+Streak pro Zeile. Leaderboard-Button im Profil. Push-Token automatisch registriert nach Login. AdMob: `useRewardedAd.ts` ersetzt `simulateAdView()` durch echten `react-native-google-mobile-ads`-Flow (TestIds im Dev, env-basierte IDs in Prod), Fallback auf Simulation in Expo Go. CRON_SECRET in `env.ts`. 13 neue Unit-Tests. 15+ i18n-Keys (de+en). API-Build clean.
- 2026-03-12: **LP-System Phase 3 abgeschlossen**: Streak-Milestone Auto-Claim nach Review-Session (streak_7/30/100 + first_review via `claimMilestone()`, `useMilestoneToast`-Hook, `MilestoneToastView`). RevenueCat LP-Pack Webhook: `NON_RENEWING_PURCHASE` mit `product_id = lp_pack_*` → `grantLpPurchase()` (idempotent). `POST /api/v1/lp/purchase` für direkten Kauf (Client-Grant, Webhook-Backup). `LP_PACKS` in `featureGates.ts` (`lp_pack_100/300/750/2000`). Echter Purchase-Flow im LP-Store: RevenueCat → API → Balance. Referral-System: `POST /api/v1/referral/claim` (+25 LP Claimer, +50 LP Sender), `GET /api/v1/referral/info`. `/referral`-Screen (Code teilen, Clipboard, Einlösen). Referral-Button im Profil. `expo-clipboard`. 19 neue Unit-Tests. 40+ i18n-Keys (de+en). API-Build clean.
- 2026-03-12: **CL-MON-01 vollständig**: Vault Secrets + Cron-Job `reset-ai-usage-monthly` (`0 0 1 * *`, active=true) per Supabase Management API in Production gesetzt. Migration `20260301100000_add_ai_usage_limits.sql` per `supabase db push` in Production eingespielt (Spalten `ai_scans_used`, `ai_url_imports_used`, `usage_period_start` auf `profiles`). Edge Function `reset-ai-usage` per `supabase functions deploy reset-ai-usage` deployed. Runbook `docs/runbooks/supabase-usage-cron.md` für monatlichen Cron (Dashboard oder pg_cron+pg_net) und manuellen curl-Test angelegt. BACKLOG CL-MON-01 auf „Teilweise erledigt“ gesetzt; Cron einmalig im Dashboard (Integrations → Cron, `0 0 1 * *`) setzen.
- 2026-03-24: **Supabase Security Advisor**: Migration `20260324120000_security_advisor_rls_leaderboard.sql` — `ENABLE ROW LEVEL SECURITY` auf `lp_transactions` und `rewards_claimed` (keine Policies: nur Service-Role-API, kein PostgREST für Clients); View `leaderboard_public` mit `security_invoker = true` statt implizitem Security Definer. Runbook `docs/runbooks/supabase-security-advisor.md`. Erweiterung `migrations.test.ts`. Security Advisor: **0 Errors** bestätigt.
- 2026-05-18: **Dokumentations-Sync**: Phase-2-Checkliste korrigiert — Statistiken-Dashboard (CL-B02), Streaks (CL-B01) und Push-Notifications (CL-B04) waren als `[ ]` offen gelistet, obwohl sie gemäß Feature-Prioritäten-Tabelle und Ist-Stand-Dokumentation vollständig implementiert sind.
- 2026-05-13: **RevenueCat Production Guard**: SDK-Initialisierung nur bei verfügbarem Native Module und gültiger Konfiguration; verhindert Fehler in Expo Go und Dev-Builds ohne Store-Secrets.
- 2026-05-13: **AdMob Production Guard**: außerhalb von Store-Builds werden Test-Ad-Unit-IDs genutzt; Produktions-IDs bleiben Store-/Production-Builds vorbehalten.
- 2026-05-14: **Release- und Store-Konfigurationsguards**: öffentliche Release-Links vereinheitlicht, LP-Pack-Käufe gegen fehlende RevenueCat-Konfiguration abgesichert und nutzerfreundliche Fehlermeldungen dokumentiert.
- 2026-05-16: **Readiness Gates ergänzt**: TestFlight-, Dashboard- und Store-Metadata-Checks für mobile Release-Vorbereitung hinzugefügt.
- 2026-05-20: **Tech-Stack- und Status-Doku aktualisiert**: Gemini 3 Flash, OAuth-Status und LP-System-Hinweise in der Produktdokumentation nachgezogen.
- 2026-06-20: **Wettbewerbsvergleich korrigiert**: Auto-Play (CL-C03), Test-Modus (CL-C01) und Match-Spiel (CL-C02) waren fälschlich als ❌ für clearn.ai markiert — alle drei sind voll implementiert (quiz.tsx, match.tsx, learn.tsx Auto-Play-Feature).
