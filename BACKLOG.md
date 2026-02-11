# BACKLOG

Letzte Aktualisierung: 2026-02-10

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
