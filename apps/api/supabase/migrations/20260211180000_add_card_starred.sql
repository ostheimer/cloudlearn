-- Add starred (favorite) boolean column to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

-- Index for filtering starred cards per user
CREATE INDEX IF NOT EXISTS cards_starred_idx
  ON cards (user_id, starred) WHERE deleted_at IS NULL AND starred = true;
