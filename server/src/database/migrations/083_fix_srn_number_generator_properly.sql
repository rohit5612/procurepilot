-- Fix SRN number generator - the original had a bug where it was reading the date part instead of sequence
BEGIN;

-- The bug was: split_part(srn_number, '-', 2) returns YYYYMMDD, not the sequence!
-- Correct version should use split_part(srn_number, '-', 3) for the sequence

-- First, ensure the counter table exists
CREATE TABLE IF NOT EXISTS srn_counters (
  date_key CHAR(8) PRIMARY KEY,
  next_number INTEGER NOT NULL
);

-- Initialize counter for today based on existing SRNs (if any exist for today)
DO $$
DECLARE
  dkey CHAR(8);
  max_seq INTEGER;
BEGIN
  dkey := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Find the max sequence number for today from existing SRNs
  SELECT COALESCE(MAX(CAST(split_part(srn_number, '-', 3) AS INTEGER)), 0)
  INTO max_seq
  FROM store_return_notes
  WHERE srn_number LIKE 'SRN-' || dkey || '-%';
  
  -- Insert or update the counter for today
  INSERT INTO srn_counters(date_key, next_number)
  VALUES (dkey, max_seq)
  ON CONFLICT (date_key)
  DO UPDATE SET next_number = GREATEST(srn_counters.next_number, EXCLUDED.next_number);
END $$;

-- Replace the function with the correct implementation
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

