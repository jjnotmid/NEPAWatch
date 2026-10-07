-- NEPAWatch API billing hotfix
-- Run once in the Supabase SQL Editor for an existing installation.

BEGIN;

ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_tier_check;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('free','starter','pro','scale','business'));

COMMIT;
