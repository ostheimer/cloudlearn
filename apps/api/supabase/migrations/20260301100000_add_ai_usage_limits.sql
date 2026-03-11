-- Adds per-user AI usage counters for monthly quota enforcement.
-- Separate columns for scan (camera/text) and URL import to allow different limits per feature.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_scans_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_url_imports_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_period_start DATE NOT NULL DEFAULT CURRENT_DATE;

-- Index for fast lookups during quota checks
CREATE INDEX IF NOT EXISTS profiles_usage_period_start_idx ON profiles (id, usage_period_start);
