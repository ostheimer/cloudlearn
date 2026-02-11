-- Add streak tracking columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_review_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_goal int NOT NULL DEFAULT 10;

-- Materialized view for per-user daily review counts (last 90 days)
-- We rely on review_logs table for historical data
CREATE INDEX IF NOT EXISTS review_logs_user_date_idx
  ON review_logs (user_id, reviewed_at DESC);
