-- Social features: friend connections, leaderboard, push tokens for notifications

-- 1. Friend connections (bidirectional: each pair has two rows)
CREATE TABLE IF NOT EXISTS friend_connections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS friend_connections_user_idx ON friend_connections (user_id);
CREATE INDEX IF NOT EXISTS friend_connections_friend_idx ON friend_connections (friend_id);

-- 2. Push tokens for Expo push notifications
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  platform   TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);

-- 3. Leaderboard snapshot view (updated on-demand; not materialized for simplicity)
--    Exposes only non-sensitive profile fields for the leaderboard.
CREATE OR REPLACE VIEW leaderboard_public AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Lernender') AS display_name,
  p.avatar_url,
  p.lp_balance,
  p.subscription_tier,
  COALESCE(streak.current_streak, 0) AS current_streak
FROM profiles p
LEFT JOIN (
  SELECT id, current_streak FROM profiles
) streak ON streak.id = p.id
WHERE p.lp_balance > 0
ORDER BY p.lp_balance DESC;

-- 4. RLS for friend_connections
ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_connections" ON friend_connections
  FOR ALL USING (auth.uid() = user_id);

-- 5. RLS for push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_push_tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 6. Add current_streak + longest_streak to profiles if not present yet
--    (May already exist from previous migration; IF NOT EXISTS guards this)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review_date DATE;
