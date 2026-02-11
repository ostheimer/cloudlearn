-- Add flashcard metadata columns missing from initial migration
ALTER TABLE cards ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
