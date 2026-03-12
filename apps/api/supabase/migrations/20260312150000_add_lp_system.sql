-- LP (Lernpunkte) system: replaces separate ai_scans_used / ai_url_imports_used counters.
-- One universal balance used for KI-Scans, URL-Imports, PDF-Imports.
-- Monthly subscription grant, earned through learning, and purchasable add-ons.

-- 1. Add LP columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lp_balance         INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS lp_earned_today    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lp_ads_today       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lp_period_start    DATE    NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS referral_code      TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by        UUID    REFERENCES profiles(id);

-- Generate unique referral codes for existing users
UPDATE profiles
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- 2. LP transaction log (full audit trail)
CREATE TABLE IF NOT EXISTS lp_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
    'abo_grant',    -- monthly subscription LP top-up
    'earned',       -- earned by learning (streak, session, daily goal)
    'purchased',    -- purchased add-on pack
    'ad_reward',    -- rewarded ad watched
    'referral',     -- referral bonus
    'spent',        -- used for KI feature
    'win_back',     -- re-engagement bonus
    'event_bonus',  -- seasonal event
    'admin'         -- manual adjustment
  )),
  amount      INTEGER     NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lp_transactions_user_created_idx
  ON lp_transactions (user_id, created_at DESC);

-- 3. Rewards claimed (idempotency for one-time milestones)
CREATE TABLE IF NOT EXISTS rewards_claimed (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_key  TEXT        NOT NULL,
  lp_granted  INTEGER     NOT NULL DEFAULT 0,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_key)
);

CREATE INDEX IF NOT EXISTS rewards_claimed_user_idx ON rewards_claimed (user_id);

-- 4. Add LP info to initial lp_transactions for existing users (starting balance)
INSERT INTO lp_transactions (user_id, type, amount, reason)
SELECT id, 'admin', 10, 'initial_balance'
FROM profiles
ON CONFLICT DO NOTHING;
