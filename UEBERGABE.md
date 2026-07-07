# Übergabedokument: Computerwechsel — cloudlearn / clearn.ai

Stand: 2026-07-07 · Erstellt für den Umzug auf einen neuen Mac.

> Hinweis: Dies ist die für das öffentliche Repo **bereinigte Fassung** (keine Secrets,
> keine persönlichen Daten, keine Account-Namen). Die vollständige Fassung liegt lokal
> als `UEBERGABE-PRIVAT.md` (nicht in Git).

---

## 1. Das Wichtigste in Kürze

- **Der Code ist komplett gesichert:** `main` ist identisch mit `origin/main` auf
  GitHub (`ostheimer/cloudlearn`), Arbeitsverzeichnis sauber. Alle gemergten
  Feature-Branches liegen auf GitHub; die lokalen Branch-Reste kannst du zurücklassen.
- **Nur 3 Dinge müssen vom alten Mac mitgenommen werden:**
  1. Die **4 `.env`-Dateien** (Secrets — sind absichtlich nicht in Git)
  2. Der **Claude-Projektordner** mit Memory **und den 8 PIT-PDFs**
  3. Deine **Logins** (GitHub, Vercel, Expo/EAS) — die richtest du auf dem neuen Mac neu ein
- **Zur PDF-Frage: Nein, erneutes Hochladen ist nicht nötig,** wenn du den
  Claude-Projektordner mitkopierst (siehe Abschnitt 3). Die PDFs liegen **nicht** im
  Git-Repo, sondern nur dort. Details in Abschnitt 4.

---

## 2. Projekt-Steckbrief

**clearn.ai** — Foto → KI → Lernkarten (FSRS Spaced Repetition). pnpm-Monorepo:

| Teil | Technik | Deployment |
|------|---------|------------|
| `apps/mobile` | Expo / React Native | `eas build` — **OTA ist NICHT aktiv** |
| `apps/api` | Next.js Route Handlers | Vercel-Projekt `clearn-api`, Auto-Deploy bei Push auf `main` |
| `apps/web` | Next.js (Landing + Share-Seiten) | Vercel-Projekt `clearn-web`, Auto-Deploy bei Push auf `main` |
| `packages/*` | contracts (Zod), domain (FSRS), testkit | — |

**Dienste:** Supabase (PostgreSQL + Auth), Cloudflare R2 (Bilder), Google Gemini (KI),
RevenueCat (Käufe), Sentry/PostHog (vorbereitet).

**Arbeitsweise:** Die primäre Nutzerin steuert und testet das Projekt (mobile-first,
iPhone), Claude implementiert. Kommunikation auf Deutsch und leicht verständlich.
Sie darf PRs selbst mergen (Checks müssen grün sein). Details: `UEBERGABE-PRIVAT.md`.

---

## 3. Checkliste: Neuen Mac einrichten

### Schritt 1 — Werkzeuge installieren

Referenz-Versionen vom alten Mac (neuere sind okay):

```bash
# Node ≥ 20 (alt: v24.16.0), pnpm ≥ 10 (alt: 10.29.2)
brew install node pnpm git gh
npm i -g vercel@latest eas-cli          # Vercel CLI (alt: 54.5.0 — ruhig neueste nehmen), EAS 18.x
brew install supabase/tap/supabase      # optional (alt: 2.75.0)
```

Außerdem: **Xcode** (App Store) für iOS-Simulator + CocoaPods, und **Claude Code**
(Desktop-App oder CLI).

### Schritt 2 — Repo klonen

```bash
mkdir -p ~/GitHub && cd ~/GitHub
git clone https://github.com/ostheimer/cloudlearn.git
cd cloudlearn && pnpm install --no-frozen-lockfile
```

Gleicher Pfad wie bisher (`~/GitHub/cloudlearn`) macht Schritt 5 einfacher.

### Schritt 3 — Secrets übertragen (4 Dateien)

Diese Dateien sind gitignored und existieren nur auf dem alten Mac:

```
~/GitHub/cloudlearn/.env.local
~/GitHub/cloudlearn/apps/web/.env.local
~/GitHub/cloudlearn/apps/api/.env.local
~/GitHub/cloudlearn/apps/api/.env.production
```

**Sicher übertragen:** AirDrop, USB-Stick oder Passwortmanager — nicht unverschlüsselt
mailen. Alternative, falls Dateien verloren gehen: In `apps/api` bzw. `apps/web`
`vercel link` + `vercel env pull` ausführen (Vercel hat die Produktionswerte).
Hinweis: Die `.env.example`-Dateien sind unvollständig (bekanntes Issue #87) —
verlass dich auf die echten Dateien.

### Schritt 4 — Logins

```bash
gh auth login          # GitHub
vercel login           # Vercel
eas login              # Expo/EAS
supabase login         # optional
```

### Schritt 5 — Claude-Kontext + PIT-PDFs übertragen

Der Ordner
`~/.claude/projects/-Users-<benutzer>-GitHub-cloudlearn/`
enthält zwei wichtige Unterordner:

- `memory/` — Claudes Projektgedächtnis (5 Dateien, siehe Abschnitt 6)
- `pit-material/` — **die 8 PIT-PDFs** (7,9 MB)

**So geht's:** Auf dem alten Mac packen …

```bash
cd ~/.claude/projects/-Users-<benutzer>-GitHub-cloudlearn
zip -r ~/claude-cloudlearn-kontext.zip memory pit-material
```

… per AirDrop rüberschicken, dann auf dem neuen Mac: einmal Claude Code im geklonten
Repo starten (dadurch entsteht der Projektordner unter `~/.claude/projects/` — der
Ordnername ist vom Repo-Pfad abgeleitet, bei gleichem Benutzernamen und Pfad heißt er
wieder genauso), dann `memory/` und `pit-material/` dort hineinentpacken.

Optional zusätzlich: `~/.claude/settings.json` (globale Claude-Code-Einstellungen) und
`~/.claude.json` (u. a. MCP-Server-Registrierungen — kann Tokens enthalten, also ebenfalls
nur sicher übertragen). Die claude.ai-Connectors (Supabase MCP usw.) hängen am Account
und wandern automatisch mit.

### Schritt 6 — Alles prüfen

```bash
cd ~/GitHub/cloudlearn
pnpm run ci                                          # Lint + Typecheck + Tests
cd apps/mobile && npx expo run:ios --device "iPhone 16 Pro"   # Mobile im Simulator (erster Lauf kompiliert)
```

---

## 4. Die PIT-PDFs (Antwort auf die Hochlade-Frage)

- Die 8 Themengebiet-PDFs („Programmieren" … „KI") liegen **nicht im Git-Repo** und
  kommen daher **nicht** mit dem Clone mit. Sie liegen ausschließlich im
  Claude-Projektordner (siehe Schritt 5).
- **Kopierst du den Ordner mit → kein erneutes Hochladen nötig.**
- Falls die Kopie nicht klappt: PDFs einfach in einer neuen Claude-Session hochladen
  und darum bitten, sie wieder unter `pit-material/` im Claude-Projektordner abzulegen.
- **Nicht ins GitHub-Repo einchecken:** Das Repo ist öffentlich und die PDFs sind
  urheberrechtlich geschütztes Schulmaterial.

Der Dauerauftrag dazu: Die Nutzerin lernt den PIT-Stoff entlang echter Projektaufgaben
(„PIT-Momente" — kurze Erklärungen mit clearn.ai-Bezug, kein Frontalunterricht).

---

## 5. Aktueller Arbeitsstand (2026-07-07)

**Zuletzt gemergt:** #101 Deck-Import als Kopie (Teil 1 von Feature #99),
#100 Ownership-Fix (IDOR geschlossen), #97/#98 `/auth/confirm`-Fixes,
#96 Share-Seite mobil.

**Offene Pull Requests:**

| PR | Inhalt | Bemerkung |
|----|--------|-----------|
| [#102](https://github.com/ostheimer/cloudlearn/pull/102) | „Übernehmen"-Knopf für geteilte Decks | **Teil 2 von Feature #99 — nächster logischer Schritt** |
| [#103](https://github.com/ostheimer/cloudlearn/pull/103) | Doku: Mobile-Simulator-Test & OTA-Runbook | |
| [#72](https://github.com/ostheimer/cloudlearn/pull/72)–[#75](https://github.com/ostheimer/cloudlearn/pull/75) | Doku-Sync + codex-Bugfixes (Offline-Cache, Tier-Limits) | #75 ist Draft |

**Wichtigste offene Issues:**

- [#76](https://github.com/ostheimer/cloudlearn/issues/76) **Security:** Live-Zugangsdaten hartkodiert in `e2e/helpers.ts`
- [#77](https://github.com/ostheimer/cloudlearn/issues/77) Mobile: API-/Supabase-URLs hartkodiert, `EXPO_PUBLIC_*` ignoriert
- [#83](https://github.com/ostheimer/cloudlearn/issues/83) / [#81](https://github.com/ostheimer/cloudlearn/issues/81) Monetarisierung: Free-Tier-Limits serverseitig nicht erzwungen; LP-Abbuchung nicht atomar
- [#80](https://github.com/ostheimer/cloudlearn/issues/80) In-Memory-Stores (Rate-Limit, Idempotenz) überleben auf Vercel nicht

**Lokale Branches auf dem alten Mac:** Alle inhaltlich relevanten sind auf GitHub
(gemergte PRs bzw. offene PRs #102/#103). Nichts geht verloren — auf dem neuen Mac
einfach frisch klonen.

---

## 6. Claudes Projektgedächtnis (Kurzfassung)

Falls die Ordner-Kopie aus Schritt 5 nicht klappt, kann Claude die Memories aus dieser
Liste neu anlegen:

1. **primäre Nutzerin** — steuert seit 2026-07-06 das Projekt; keine Entwicklerin.
   Deutsch, „du", leicht verständlich; Claude implementiert, sie steuert/testet/lernt.
   Sie darf PRs mergen (vorher bestätigen, dass Checks grün sind). Persönliche
   Details bewusst nur in `UEBERGABE-PRIVAT.md`.
2. **pit-lernbegleitung** — Dauerauftrag: PIT-Stoff (8 PDFs in `pit-material/`) bei
   passenden Aufgaben anhand von clearn.ai erklären. Themen: Programmieren, Software,
   Sicherheit, Hardware, Filius/Netzwerke, IoT, Datenbanken, KI.
3. **ui-qualitaet** — Die Nutzerin testet am iPhone: jede Web-UI-Änderung am
   375-px-Viewport prüfen, mit realistisch langen Inhalten testen, auf horizontalen
   Overflow messen, Screenshot zeigen.
4. **deck-ownership-pattern** — Seit PR #100: alle Deck-/Karten-Zugriffe in
   `apps/api/src/lib/db.ts` per `user_id` filtern (der Supabase-Admin-Client umgeht
   RLS!). Fremdzugriff → 404. Öffentliche Ausgaben datensparsam (keine internen IDs,
   keine `user_id`, kein FSRS-State).
5. **mobile-ota-shipping** — **OTA ist NICHT verdrahtet** (`expo-updates` fehlt):
   App-Änderungen erreichen das Handy nur per `eas build`. Simulator-Test:
   `npx expo run:ios`. Runbook: `docs/runbooks/mobile-dev-and-ota.md`. Nur der
   Entwicklungs-Mac mit eingeloggtem EAS-Account kann bauen und ausliefern.

---

## 7. Konventionen & wichtige Befehle

- **Bug-Workflow** (`AGENTS.md`): erst Test schreiben, der den Bug reproduziert — dann fixen.
- **LP-/Tier-Änderungen:** `packages/contracts/src/featureGates.ts` ist die kanonische
  Quelle; Spiegel synchron halten: `apps/api/src/lib/featureGates.ts`,
  `apps/mobile/src/features/paywall/lpPackOffers.ts`, README „Monetarisierung",
  `docs/monetization/MONETIZATION_CONCEPT.md`.
- **Tests:** `pnpm run ci` · `npx vitest run` · `npx playwright test`
- **Deploy Web/API:** Push auf `main` → Vercel baut automatisch. **Mobile:** `eas build`.
- **Doku:** `README.md` (Architektur/Setup), `ROADMAP.md`, `BACKLOG.md`, `docs/runbooks/`.
