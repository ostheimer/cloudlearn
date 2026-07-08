-- Allow 'refund' as an LP (Lernpunkte) transaction type.
--
-- Imports and scans are charged up front via spend_lp. When the processing then
-- fails (e.g. a paid PDF import whose text extraction throws, or an image scan
-- the AI can't turn into cards), the API credits the LP back via add_lp so the
-- user is never billed for cards that never got created.
--
-- That reversal needs its own ledger type so the audit trail in lp_transactions
-- reads honestly as a refund instead of being disguised as an 'admin' manual
-- adjustment. This migration only WIDENS the set of allowed types, so every
-- existing row stays valid and swapping the CHECK constraint is a fast, safe op.

alter table lp_transactions drop constraint if exists lp_transactions_type_check;

alter table lp_transactions add constraint lp_transactions_type_check
  check (type in (
    'abo_grant',    -- monthly subscription LP top-up
    'earned',       -- earned by learning (streak, session, daily goal)
    'purchased',    -- purchased add-on pack
    'ad_reward',    -- rewarded ad watched
    'referral',     -- referral bonus
    'spent',        -- used for KI feature
    'win_back',     -- re-engagement bonus
    'event_bonus',  -- seasonal event
    'admin',        -- manual adjustment
    'refund'        -- reversal of a spend whose processing failed
  ));
