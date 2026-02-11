# ROADMAP

Letzte Aktualisierung: 2026-02-11

## Gesamtstatus

- Projektphase: **Delivery Scaffold abgeschlossen (Implementierung + Tests)**
- Produktname: **clearn.ai** (vereinheitlicht)
- Plattformfokus: **Mobile first (iOS/Android)**
- Sprache: **Deutsch default**, erste Uebersetzung **Englisch**
- Detailliertes Umsetzungs-Backlog: **`BACKLOG.md`**

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

## Phase 2 - Beta Launch (4-6 Wochen, Scaffold umgesetzt)

- [x] Onboarding-Flow mit erstem Lernerfolg in < 2 Minuten
- [x] Statistiken-Dashboard
- [x] Push-Notifications (Preferences + Quiet Hours)
- [x] Incident-Runbook + Restore-Test in Regelbetrieb
- [x] Landing Page + App Store Optimierung (Scaffold)
- [x] Beta-Launch DACH vorbereitet (Feedback/Triage Loop)

## Phase 3 - Growth (laufend, Scaffold umgesetzt)

- [x] Erweiterte Lernmodi (MCQ, Matching, Cloze+)
- [x] PDF-Import (Queue/Retry)
- [x] Mathpix-Integration (Kostenkontrolle)
- [x] Anki-Export
- [x] Community-Decks (Moderation/Abuse-Prevention)
- [x] Web-App
- [x] B2B-Dashboard (Mandantenisolation)

## Exit-Kriterien

- Phase 1 -> 2: Crash-free > 99,5%, Time to First Card < 30s, stabiler End-to-End Sync
- Phase 2 -> 3: D7 Retention > 25%, Review Completion > 65%, Trial -> Paid > 35%

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
