BEGIN;

-- Counter table for per-day SRN sequence
CREATE TABLE IF NOT EXISTS srn_counters (
  date_key CHAR(8) PRIMARY KEY,
  next_number INTEGER NOT NULL
);

-- Replace SRN number generator to use atomic upsert on per-day counter
-- Always start from 1 for each date_key, ignoring legacy malformed suffixes
CREATE OR REPLACE FUNCTION generate_srn_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  dkey CHAR(8);
  seq INTEGER;
BEGIN
  dkey := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Atomic upsert: initialize to 1 if missing; increment on conflict
  INSERT INTO srn_counters(date_key, next_number)
  VALUES (dkey, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET next_number = srn_counters.next_number + 1
  RETURNING next_number INTO seq;

  RETURN 'SRN-' || dkey || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;
