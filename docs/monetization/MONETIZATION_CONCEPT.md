# Monetarisierungskonzept — clearn.ai

> **Kanonische Quelle:** Numerische LP-Werte, Tier-Limits und LP-Pack-Preise werden in `packages/contracts/src/featureGates.ts` gepflegt. `apps/api/src/lib/featureGates.ts` und `apps/mobile/src/features/paywall/lpPackOffers.ts` spiegeln diese Werte für API bzw. Mobile.

Letzte Aktualisierung: 2026-07-24

---

## 1. Leitprinzipien

1. **Lernen wird belohnt, nicht bestraft** — wer täglich lernt, schaltet Funktionen frei
2. **Eine Währung für alles** — Lernpunkte (LP) als universelle Einheit
3. **Drei Einnahmequellen** — Abo + Add-ons + Werbung
4. **Harte Limits für alle Tarife** — kein „unbegrenzt", faire Obergrenzen
5. **Virales Wachstum eingebaut** — Social Features, Referrals, Community-Decks

---

## 2. Tarife

| Tarif | Preis | Abrechnung | LP/Monat |
|-------|-------|------------|----------|
| **Free** | 0 € | — | 0 LP¹ |
| **Pro Monthly** | 4,99 € | monatlich, 7 Tage Gratis-Test | 300 LP |
| **Pro Annual** | 39,99 € | jährlich (~3,33 €/Monat, −33%) | 300 LP/Monat |

¹ Free-Nutzer erhalten aktuell ein einmaliges Startguthaben über den DB-Default `lp_balance = 10`; es gibt keinen monatlichen Free-Grant (`lpGrantPerMonth: 0`).

Produkt-IDs (RevenueCat):
- `ai.clearn.pro.monthly` (Auto-Renewing Subscription)
- `ai.clearn.pro.annual` (Auto-Renewing Subscription)

---

## 3. Lernpunkte (LP) — Eine Währung

### 3.1 LP-Kosten für KI-Features

| Aktion | LP-Kosten (Free) | LP-Kosten (Pro/Lifetime) | API-Kosten (ca.) | Begründung |
|--------|-----------------|--------------------------|-------------------|------------|
| KI-Scan (Kamera/Text) | 10 LP | 5 LP | ~0,005 € | Gemini Flash, kurzer Prompt |
| URL-Import | 15 LP | 8 LP | ~0,010 € | Scraping + mehr Tokens |
| PDF-Import | 20 LP | 12 LP | ~0,020 € | Längster Prompt, mehrere Seiten |

Free-User: 10 LP Startguthaben = 1 Scan ODER anteilig URL-/PDF-Import.
Pro-User: 300 LP Monatsgrant = 60 Scans oder 37 URL-Importe.

> **Hinweis:** Die PDF-API-Route ist nicht hart auf Pro beschränkt. Free-Nutzer zahlen 20 LP; der Mobile-UI-Einstieg ist über das Feature-Flag `pdfImport: false` ausgeblendet.

### 3.2 LP verdienen durch Lernen (Gamification)

| Aktion | LP | Limit | Anmerkung |
|--------|----|-------|----------|
| Abgeschlossene Lernsession (min. 5 Karten) | +5 LP | Tagescap: 30 LP Free, 100 LP Pro/Lifetime | Wird über `earnLp("session")` verbucht |
| Tagesziel erreicht | +10 LP | 1× pro Tag | API-Regel vorhanden; Mobile-Trigger separat prüfen |
| 7-Tage-Streak | +25 LP | Einmalig | `rewards_claimed` verhindert doppelte Auszahlung |
| 30-Tage-Streak | +100 LP | Einmalig | — |
| 100-Tage-Streak | +300 LP | Einmalig | — |
| Referral: Einladender | +50 LP | Beim Code-Claim | Sofortige Gutschrift |
| Referral: Eingeladener | +25 LP | Beim Code-Claim | Signup-Bonus |
| Erstes Deck | +10 LP | Einmalig | — |
| Erste Review | +5 LP | Einmalig | — |

**Tageslimit:** `lpEarnCapPerDay` begrenzt Lernen auf 30 LP/Tag (Free) bzw. 100 LP/Tag (Pro/Lifetime). Meilensteine und Referrals werden separat als Einmal-Boni verbucht.

→ Free-User können sich durch Lernen regelmäßig KI-Nutzung freischalten, ohne dass der kostenlose Plan einen monatlichen Grant enthält.
→ Pro/Lifetime bleiben durch niedrigere LP-Kosten, höheren Earn-Cap und Ad-Free-Erlebnis klar attraktiver.

### 3.3 LP kaufen (Consumable Add-ons via RevenueCat)

| Paket | LP | Preis | Preis/LP | Produkt-ID |
|-------|-----|-------|----------|------------|
| Starter | 100 LP | 0,99 € | 0,0099 € | `lp_pack_100` |
| **Basis** | 300 LP | 2,49 € | **0,0083 €** | `lp_pack_300` |
| Profi | 750 LP | 4,99 € | 0,0067 € | `lp_pack_750` |
| Power | 2.000 LP | 9,99 € | 0,0050 € | `lp_pack_2000` |

Best-Value-Badge auf Basis-Paket (Decoy-Effekt: Starter wirkt teuer, Power für Power-User).
Gekaufte LP verfallen **nicht** (kein Ablaufdatum).

### 3.4 LP durch Rewarded Ads verdienen

| Platzierung | Wann | LP |
|-------------|------|----|
| Rewarded Video im Scan-Screen | Freiwillig, wenn LP knapp | +5 LP |
| Rewarded Video bei LP = 0 | „Noch ein Scan? Schau ein Video!" | +5 LP |

**Limit:** Max. 20 LP/Tag durch Rewarded Ads auf Free. Pro/Lifetime sind werbefrei und erhalten kein Ad-LP.

### 3.5 Verbrauchsreihenfolge

**Ein einziger Topf** (`lp_balance`). Kein Unterschied ob verdient, gekauft oder Abo-Kontingent.
Monatliches Abo-Kontingent wird am 1. des Monats auf `lp_balance` aufaddiert (nicht ersetzt).

**Balance-Cap:** Bewusste Entscheidung (Issue #84, 24.07.2026): Es gibt **keinen** LP-Balance-Cap — weder für verdiente noch für gekaufte LP. Das Ansparen wird ausschließlich über die Tagescaps (`lpEarnCapPerDay`, `lpAdCapPerDay`) begrenzt; große LP-Packs werden vollständig gutgeschrieben. Bitte nicht erneut als Lücke melden.

---

## 4. Harte Limits (nicht durch LP umgehbar)

| Limit | Free | Pro | Lifetime |
|-------|------|-----|----------|
| Max. Decks | 10 | 500 | 500 |
| Max. Karten/Deck | 100 | 2.000 | 2.000 |
| LP-Grant/Monat | 0 | 300 LP | 300 LP |
| LP-Verdienst-Cap/Tag | 30 LP | 100 LP | 100 LP |
| LP-Cost KI-Scan | 10 LP | 5 LP | 5 LP |
| LP-Cost URL-Import | 15 LP | 8 LP | 8 LP |
| LP-Cost PDF-Import | 20 LP | 12 LP | 12 LP |
| PDF-Import | ❌ | ✅ | ✅ |
| Image Occlusion | ❌ | ✅ | ✅ |
| Offline-Download | ❌ | ✅ | ✅ |
| Erweiterte Statistiken | ❌ | ✅ | ✅ |
| Werbefrei | ❌ | ✅ | ✅ |

Lifetime ist im Code vorhanden und wird über `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME` klassifiziert; die Store-Sichtbarkeit hängt von RevenueCat Offerings ab.

---

## 5. Werbung (Free-Nutzer)

### SDK: Google AdMob (empfohlen für Expo/React Native)

| Platzierung | Typ | Frequenz |
|-------------|-----|----------|
| Home-Screen unten | Banner (320×50) | Permanent |
| Nach jeder 3. Lernsession | Interstitial | Max. 5/Tag |
| Freiwillig im Scan-Screen | Rewarded Video → +5 LP | Max. 20 LP/Tag |

**Pro-Nutzer: komplett werbefrei** (starker Upgrade-Anreiz).

### Geschätzte Werbeeinnahmen pro Free-User
- eCPM Europa (Bildung): 2–5 €
- ~5–10 Ad-Impressions/Tag bei aktivem Nutzer
- → **~0,30–1,50 €/Monat** pro aktivem Free-User
- Deckt API-Kosten (~0,11 €/Monat bei fleißigem Nutzer) locker

---

## 6. Virales Wachstum & Social Features

### 6.1 Referral-Programm

| Aktion | Belohnung Einlader | Belohnung Neuer Nutzer |
|--------|-------------------|------------------------|
| Freund registriert sich und löst Referral-Code ein | +50 LP | +25 LP (Signup-Bonus) |
| Freund wird Pro-Abonnent | Bereits durch Referral-Bonus abgedeckt | — |

→ Anreiz zum Teilen. Viraler Loop wie Duolingo (90% Wachstum durch Word-of-Mouth).

### 6.2 Friend-Streaks

- Nutzer können mit bis zu 5 Freunden einen **gemeinsamen Streak** führen
- Beide müssen täglich lernen, sonst bricht der Friend-Streak
- **Bonus: +1 LP pro Woche** für jeden aktiven Friend-Streak
- Soziale Verpflichtung → höhere Retention (Duolingo: +22% tägliche Nutzung)

### 6.3 Community-Decks

- Nutzer können Decks **öffentlich teilen** (wie Quizlet)
- Bewertungen (1–5 Sterne) + Download-Zähler
- **Top-Creator-Belohnung:** Deck mit 100+ Downloads → +20 LP
- Free-User können 3 Community-Decks erstellen, Pro unbegrenzt

### 6.4 Leaderboard (Wöchentlich)

- Rangliste nach Lern-XP (Reviews × Qualität)
- Top 3 jede Woche: +10 / +5 / +3 LP
- Liga-System wie Duolingo (Bronze → Silber → Gold → Diamant)
- **Aufstieg/Abstieg** jede Woche → regelmäßige Rückkehr

### 6.5 Share-Karte

- Nach jeder Session: teilbare Grafik mit Stats ("7-Tage-Streak! 150 Karten gelernt")
- Instagram/TikTok/WhatsApp-Share → kostenlose User Acquisition
- **Bonus: +1 LP** wenn geteilt (1× pro Tag)

---

## 7. Vergleich mit Top-Apps — Lückenanalyse

### Was wir von den Besten übernehmen

| App | Strategie | Unser Äquivalent |
|-----|-----------|------------------|
| **Duolingo** | Gems (eine Währung), Streak, Leaderboard, Friend-Streak, Rewarded Ads, 90% Word-of-Mouth | LP, Streak-Belohnungen, Leaderboard, Friend-Streak, Rewarded Ads, Referral |
| **Quizlet** | Freemium + tägliche Limits auf Free | LP-System mit klaren Limits |
| **Tinder** | Consumables (Super-Like, Boost) + Abo + Decoy-Pricing | LP-Pakete mit Decoy (Starter/Basis/Profi/Power) |
| **Candy Crush** | Rewarded Ads + Consumables + Zeitdruck | Rewarded Ads für LP + Add-on-Pakete |
| **Spotify** | Free + Ads vs. Premium werbefrei | Free mit Ads vs. Pro werbefrei |

### Gefundene Lücken und deren Lösung

| # | Lücke | Risiko | Lösung |
|---|-------|--------|--------|
| 1 | **Kein Onboarding-Hook** — Nutzer muss sich registrieren, bevor er Wert sieht | 80% verlassen App in 3 Tagen | **Erster Scan ohne Registrierung** (5 LP geschenkt beim App-Start). Registrierung erst für Speichern/Sync nötig. |
| 2 | **Keine Push-Re-Engagement** bei inaktiven Nutzern | Hohe Churn nach Tag 7 | **Progressive Push**: Tag 1: "Dein Streak wartet!", Tag 3: "Deine Karten werden vergessen…", Tag 7: "+5 Bonus-LP wenn du heute zurückkommst!" (Win-Back-LP) |
| 3 | **Kein zeitlich begrenztes Angebot** | Keine Kaufdringlichkeit | **Flash Sales**: "Nur heute: 300 LP für 1,49 € statt 2,49 €" (1× pro Woche, zufälliger Tag). Countdown-Timer. |
| 4 | **Kein Pro-Trial-Trigger bei richtigem Moment** | Niedrige Conversion Free→Pro | **Kontextuelle Pro-Trigger**: Wenn Free-User zum 3. Mal LP-Limit erreicht → "7 Tage Pro gratis testen?" (nicht generisch beim Start). |
| 5 | **Keine Klassenraum-/Gruppen-Funktion** | Kein B2B-Umsatz, keine Schulen | **Später (Phase 3)**: Lehrer-Accounts mit Klassen-Management, Schul-Lizenzen. |
| 6 | **Kein Content-Marktplatz** | Beschränkt auf eigene Inhalte | Community-Decks (oben), später: **Premium-Decks** von verifizierten Erstellern (Creator verdient 70%, wir 30%). |
| 7 | **Keine saisonalen Events** | Monotonie nach Wochen | **Lern-Challenges**: "Prüfungswoche: Doppelte LP für 7 Tage" (vor typischen Prüfungsphasen Feb/Jun/Sep). Begrenzter Zeitraum → FOMO + Aktivität. |
| 8 | **Kein Social Proof auf Paywall** | Paywall fühlt sich kalt an | Paywall zeigt: "12.847 Nutzer lernen mit Pro" + Testimonials + Sternebewertung. |

---

## 8. Kostenrechnung

### API-Kosten pro LP

| Aktion | LP (Free) | LP (Pro/Lifetime) | API-Kosten | Kosten/LP (Free) |
|--------|-----------|-------------------|-----------|------------------|
| KI-Scan | 10 LP | 5 LP | ~0,005 € | 0,0005 € |
| URL-Import | 15 LP | 8 LP | ~0,010 € | 0,0007 € |
| PDF-Import | 20 LP | 12 LP | ~0,020 € | 0,0010 € |

### Szenarien

| Nutzertyp | LP/Monat | API-Kosten | Einnahmen | Marge |
|-----------|----------|------------|-----------|-------|
| Free, passiv (nur Basis) | 10 | ~0,03 € | ~0,30 € (Ads) | +0,27 € |
| Free, fleißig (30 LP/Tag-Cap genutzt) | 900 | ~0,45 € | ~0,80 € (Ads) | +0,35 € |
| Free, kauft Basis-Paket (300 LP) | 310 | ~0,16 € | 2,49 € + Ads | +3,13 € |
| Pro, normal | 300 | ~0,75 € | 4,99 € | +4,24 € (85%) |
| Pro, Power + Bonus | 335 | ~0,84 € | 4,99 € | +4,15 € (83%) |

**Worst Case:** Free-User farmt max. Lernen (30 LP/Tag × 30 = ~900 LP) + max. Rewarded Ads (20 LP/Tag × 30 = ~600 LP) = ~1.500 LP. API-Kosten je nach Feature-Mix: ~0,75 € (nur KI-Scans) bis ~1,50 € (nur PDF-Imports). Werbeeinnahmen durch tägliche Ad-Nutzung: grob ~1,50 €. → `lpEarnCapPerDay` und `lpAdCapPerDay` begrenzen das Missbrauchsrisiko.

### Skalierung

| MAU | Free (80%) | Pro (8%) | Add-on-Käufer (5%) | Monatsumsatz (geschätzt) |
|-----|-----------|---------|--------------------|-----------------------|
| 10.000 | 8.000 | 800 | 500 | ~8.000 € |
| 50.000 | 40.000 | 4.000 | 2.500 | ~40.000 € |
| 100.000 | 80.000 | 8.000 | 5.000 | ~80.000 € |

Annahmen: Pro Ø 4,50 €/Monat (Mix Monthly/Annual), Add-on Ø 2,49 €, Free-Ads Ø 0,50 €.

---

## 9. Datenbank-Schema

```sql
-- Erweiterung profiles
ALTER TABLE profiles
  ADD COLUMN lp_balance INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN lp_earned_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN lp_ads_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN lp_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN referral_code TEXT UNIQUE,
  ADD COLUMN referred_by TEXT;

-- LP-Transaktionslog
CREATE TABLE lp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('abo_grant', 'earned', 'purchased', 'ad_reward', 'referral', 'spent', 'win_back', 'event_bonus')),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lp_transactions_user_idx ON lp_transactions (user_id, created_at DESC);

-- Rewards-Tracking (einmalige Meilensteine)
CREATE TABLE rewards_claimed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  reward_key TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_key)
);

-- Community-Decks
ALTER TABLE decks
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN avg_rating NUMERIC(2,1);

-- Friend-Streaks
CREATE TABLE friend_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES profiles(id),
  user_b UUID NOT NULL REFERENCES profiles(id),
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_both_active DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);
```

---

## 10. Implementierungs-Reihenfolge

| Phase | Inhalt | Priorität |
|-------|--------|----------|
| **Phase 1** | LP-System (Balance, Spend, Earn durch Lernen), featureGates anpassen, Paywall aktualisieren | P0 |
| **Phase 2** | RevenueCat: Abo (ohne Lifetime) + Consumable Add-ons, Rewarded Ads (AdMob) | P0 |
| **Phase 3** | Referral-Programm, Friend-Streaks, Leaderboard | P1 |
| **Phase 4** | Community-Decks (öffentlich teilen, bewerten), Share-Karte | P1 |
| **Phase 5** | Flash Sales, saisonale Events, Win-Back-Push | P2 |
| **Phase 6** | Premium-Creator-Marktplatz, B2B/Schul-Lizenzen | P3 |

---

## 11. KPIs

| KPI | Ziel (6 Monate) | Benchmark |
|-----|-----------------|----------|
| Free→Pro Conversion | 5–8% | Duolingo: 8,8%, Branchenschnitt: 2–5% |
| D7 Retention | >30% | Top-Apps: 25–35% |
| D30 Retention | >15% | Top-Apps: 10–20% |
| ARPU (alle Nutzer) | >0,80 € | Duolingo: ~1,20 € |
| Streak >7 Tage | >25% der MAU | Duolingo: ~30% |
| Referral-Rate | >10% laden Freunde ein | Duolingo: ~15% |
| Ad-Revenue/Free-User | >0,40 €/Monat | Branchenschnitt: 0,30–0,80 € |

---

## Referenzen

- [Duolingo Monetization Lessons](https://medium.com/@nicobottaro/monetization-7-lessons)
- [Duolingo Friend Streak](https://blog.duolingo.com/friend-streak)
- [RevenueCat: Gamification in Apps](https://revenuecat.com/blog/growth/gamification-in-apps-complete-guide/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [App Monetization Strategies 2025](https://blog.funnelfox.com/how-app-monetization-strategies-impact-user-acquisition-and-retention/)
