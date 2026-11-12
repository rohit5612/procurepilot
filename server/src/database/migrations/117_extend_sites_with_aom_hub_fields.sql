-- Extend sites table with AOM and hub site status fields
-- Non-breaking: only adds nullable columns.

BEGIN;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS hub_site_status TEXT, -- e.g. 'VIL More than 5 Sites...'
  ADD COLUMN IF NOT EXISTS aom TEXT;            -- e.g. '102597-Rohit Shreshty'

COMMIT;

