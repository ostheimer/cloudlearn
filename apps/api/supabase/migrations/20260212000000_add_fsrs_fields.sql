-- Add missing FSRS v5 fields to cards table for proper spaced repetition scheduling.
-- Without these fields, every review treats the card as brand new.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS fsrs_reps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_lapses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_elapsed_days real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_scheduled_days real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_learning_steps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_last_review timestamptz;
