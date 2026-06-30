> **⚠️ VERALTET — Konzeptversion nicht mehr aktuell**
> 
> Dieses Dokument beschreibt eine frühere Konzeptversion mit abweichenden LP-Werten und Tier-Limits.
> Die **kanonischen Werte** für LP-Kosten, Deck-Limits und Tier-Grenzen liegen in:
> - Code: `packages/contracts/src/featureGates.ts`
> - Dokumentation: `README.md` (Abschnitt "Monetarisierung")  
> 
> Konkrete Abweichungen: Free LP/Monat (dieses Dok: 10, aktuell: 0), LP-Pack (dieses Dok: 15 LP/€0,99, aktuell: 100 LP/€0,99), Free Max Decks (dieses Dok: 20, aktuell: 10).
> Ticket CL-MON-06 tracking the reconciliation.

# Monetarisierungskonzept — clearn.ai

> **⚠️ ACHTUNG (Stand 2026-06-06):** Die Werte in diesem Dokument divergieren von der tatsächlichen Implementierung in `packages/contracts/src/featureGates.ts`. Entscheidung über die kanonische Quelle steht aus — siehe BACKLOG CL-MON-06.

Letzte Aktualisierung: 2026-03-12

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
| **Free** | 0 € | — | 10 LP |
| **Pro Monthly** | 4,99 € | monatlich, 7 Tage Gratis-Test | 200 LP |
| **Pro Annual** | 39,99 € | jährlich (~3,33 €/Monat, −33%) | 200 LP/Monat |

Produkt-IDs (RevenueCat):
- `ai.clearn.pro.monthly` (Auto-Renewing Subscription)
- `ai.clearn.pro.annual` (Auto-Renewing Subscription)

---

## 3. Lernpunkte (LP) — Eine Währung

### 3.1 LP-Kosten für KI-Features

| Aktion | LP-Kosten | API-Kosten (ca.) | Begründung |
|--------|-----------|-------------------|------------|
| KI-Scan (Kamera/Text) | 2 LP | ~0,005 € | Gemini Flash, kurzer Prompt |
| URL-Import | 3 LP | ~0,010 € | Scraping + mehr Tokens |
| PDF-Import (nur Pro) | 5 LP | ~0,020 € | Längster Prompt, mehrere Seiten |

Free-User: 10 LP = 5 Scans ODER 3 URL-Importe ODER Mix.
Pro-User: 200 LP = 100 Scans oder 66 URL-Importe — reicht für Power-User.

### 3.2 LP verdienen durch Lernen (Gamification)

| Aktion | LP | Limit | Anti-Abuse |
|--------|----|-------|------------|
| Tagesziel erreicht (mind. 10 Karten reviewed) | +1 LP | 1× pro Tag | Tagesziel muss echte Reviews sein, kein Farming |
| 7-Tage-Streak | +3 LP | 1× pro Woche | Streak zählt nur bei ≥10 Karten/Tag |
| 30-Tage-Streak | +10 LP | 1× pro Monat | — |
| Perfekte Session (≥10 Karten, ≥90% „Gut/Leicht") | +1 LP | 2× pro Tag | Min. 10 verschiedene Karten, keine Wiederholungen |

**Max. verdienbar pro Monat: ~35 LP** (bei perfektem Verhalten).

→ Free-User: 10 (Basis) + 35 (verdient) = **45 LP max.** = 22 Scans. Spürbar, aber kein Abo-Ersatz.
→ Pro-User: 200 + 35 = **235 LP** — Bonus fühlt sich generös an.

### 3.3 LP kaufen (Consumable Add-ons via RevenueCat)

| Paket | LP | Preis | Preis/LP | Produkt-ID |
|-------|-----|-------|----------|------------|
| Starter | 15 LP | 0,99 € | 0,066 € | `ai.clearn.addon.lp.15` |
| **Standard** | 50 LP | 2,49 € | **0,050 €** | `ai.clearn.addon.lp.50` |
| Power | 150 LP | 5,99 € | 0,040 € | `ai.clearn.addon.lp.150` |

Best-Value-Badge auf Standard-Paket (Decoy-Effekt: Starter wirkt teuer, Power für Power-User).
Gekaufte LP verfallen **nicht** (kein Ablaufdatum).

### 3.4 LP durch Rewarded Ads verdienen

| Platzierung | Wann | LP |
|-------------|------|----|
| Rewarded Video im Scan-Screen | Freiwillig, wenn LP knapp | +1 LP |
| Rewarded Video bei LP = 0 | „Noch ein Scan? Schau ein Video!" | +2 LP |

**Limit: Max. 3 Rewarded Ads pro Tag** (verhindert Ad-Farming, schützt Abo-Wert).

### 3.5 Verbrauchsreihenfolge

**Ein einziger Topf** (`lp_balance`). Kein Unterschied ob verdient, gekauft oder Abo-Kontingent.
Monatliches Abo-Kontingent wird am 1. des Monats auf `lp_balance` aufaddiert (nicht ersetzt).

**Cap:** LP-Balance kann max. 500 betragen (verhindert unbegrenztes Horten).

---

## 4. Harte Limits (nicht durch LP umgehbar)

| Limit | Free | Pro |
|-------|------|-----|
| Max. Decks | 20 | 500 |
| Max. Karten | 200 | 10.000 |
| PDF-Import | ❌ | ✅ |
| Image Occlusion | ❌ | ✅ |
| Offline-Download | ❌ | ✅ |
| Werbefrei | ❌ | ✅ |
| Community-Decks erstellen | 3 | ∞ |
| Leaderboard-Teilnahme | ✅ | ✅ |

---

## 5. Werbung (Free-Nutzer)

### SDK: Google AdMob (empfohlen für Expo/React Native)

| Platzierung | Typ | Frequenz |
|-------------|-----|----------|
| Home-Screen unten | Banner (320×50) | Permanent |
| Nach jeder 3. Lernsession | Interstitial | Max. 5/Tag |
| Freiwillig im Scan-Screen | Rewarded Video → +1–2 LP | Max. 3/Tag |

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
| Freund registriert sich + 1. Session | +10 LP | +5 LP (statt 10 Basis) |
| Freund wird Pro-Abonnent | +50 LP | — |

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
| **Tinder** | Consumables (Super-Like, Boost) + Abo + Decoy-Pricing | LP-Pakete mit Decoy (Starter/Standard/Power) |
| **Candy Crush** | Rewarded Ads + Consumables + Zeitdruck | Rewarded Ads für LP + Add-on-Pakete |
| **Spotify** | Free + Ads vs. Premium werbefrei | Free mit Ads vs. Pro werbefrei |

### Gefundene Lücken und deren Lösung

| # | Lücke | Risiko | Lösung |
|---|-------|--------|--------|
| 1 | **Kein Onboarding-Hook** — Nutzer muss sich registrieren, bevor er Wert sieht | 80% verlassen App in 3 Tagen | **Erster Scan ohne Registrierung** (5 LP geschenkt beim App-Start). Registrierung erst für Speichern/Sync nötig. |
| 2 | **Keine Push-Re-Engagement** bei inaktiven Nutzern | Hohe Churn nach Tag 7 | **Progressive Push**: Tag 1: "Dein Streak wartet!", Tag 3: "Deine Karten werden vergessen…", Tag 7: "+5 Bonus-LP wenn du heute zurückkommst!" (Win-Back-LP) |
| 3 | **Kein zeitlich begrenztes Angebot** | Keine Kaufdringlichkeit | **Flash Sales**: "Nur heute: 50 LP für 1,49 € statt 2,49 €" (1× pro Woche, zufälliger Tag). Countdown-Timer. |
| 4 | **Kein Pro-Trial-Trigger bei richtigem Moment** | Niedrige Conversion Free→Pro | **Kontextuelle Pro-Trigger**: Wenn Free-User zum 3. Mal LP-Limit erreicht → "7 Tage Pro gratis testen?" (nicht generisch beim Start). |
| 5 | **Keine Klassenraum-/Gruppen-Funktion** | Kein B2B-Umsatz, keine Schulen | **Später (Phase 3)**: Lehrer-Accounts mit Klassen-Management, Schul-Lizenzen. |
| 6 | **Kein Content-Marktplatz** | Beschränkt auf eigene Inhalte | Community-Decks (oben), später: **Premium-Decks** von verifizierten Erstellern (Creator verdient 70%, wir 30%). |
| 7 | **Keine saisonalen Events** | Monotonie nach Wochen | **Lern-Challenges**: "Prüfungswoche: Doppelte LP für 7 Tage" (vor typischen Prüfungsphasen Feb/Jun/Sep). Begrenzter Zeitraum → FOMO + Aktivität. |
| 8 | **Kein Social Proof auf Paywall** | Paywall fühlt sich kalt an | Paywall zeigt: "12.847 Nutzer lernen mit Pro" + Testimonials + Sternebewertung. |

---

## 8. Kostenrechnung

### API-Kosten pro LP

| Aktion | LP | API-Kosten | Kosten/LP |
|--------|-----|-----------|----------|
| KI-Scan | 2 LP | ~0,005 € | 0,0025 € |
| URL-Import | 3 LP | ~0,010 € | 0,0033 € |
| PDF-Import | 5 LP | ~0,020 € | 0,0040 € |

### Szenarien

| Nutzertyp | LP/Monat | API-Kosten | Einnahmen | Marge |
|-----------|----------|------------|-----------|-------|
| Free, passiv (nur Basis) | 10 | ~0,03 € | ~0,30 € (Ads) | +0,27 € |
| Free, fleißig (45 LP) | 45 | ~0,11 € | ~0,80 € (Ads) | +0,69 € |
| Free, kauft Standard-Paket | 60 | ~0,15 € | 2,49 € + Ads | +2,84 € |
| Pro, normal | 200 | ~0,50 € | 4,99 € | +4,49 € (90%) |
| Pro, Power + Bonus | 235 | ~0,59 € | 4,99 € | +4,40 € (88%) |

**Worst Case:** Free-User farmt max. LP (45) + max. Rewarded Ads (90 LP/Monat bei 3/Tag × 30 = 90 LP → gedeckelt auf 3/Tag = ~60 LP) = ~105 LP. API-Kosten: ~0,26 €. Werbeeinnahmen: ~1,00 €. → Immer noch profitabel.

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
