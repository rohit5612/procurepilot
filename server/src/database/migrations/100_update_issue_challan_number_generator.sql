-- Update Delivery Challan number generator to: DC/VRP/{CIRCLE_CODE}-{CLUSTER_CODE}/{YY-YY}/{NNN}
-- Example: DC/VRP/RJ-UDP/25-26/001

BEGIN;

CREATE OR REPLACE FUNCTION generate_challan_number(p_circle_id INTEGER, p_cluster_id INTEGER)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_circle_code TEXT;
  v_cluster_code TEXT;
  v_fy_start INT;
  v_fy_end INT;
  v_fy TEXT;
  v_prefix TEXT;
  v_next INT;
  v_num VARCHAR(50);
BEGIN
  SELECT COALESCE(tc.code, 'NA') INTO v_circle_code FROM telecom_circles tc WHERE tc.id = p_circle_id;
  IF v_circle_code IS NULL THEN v_circle_code := 'NA'; END IF;

  SELECT COALESCE(c.code, 'NA') INTO v_cluster_code FROM clusters c WHERE c.id = p_cluster_id;
  IF v_cluster_code IS NULL THEN v_cluster_code := 'NA'; END IF;

  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_fy_start := EXTRACT(YEAR FROM CURRENT_DATE);
  ELSE
    v_fy_start := EXTRACT(YEAR FROM CURRENT_DATE) - 1;
  END IF;
  v_fy_end := v_fy_start + 1;
  v_fy := LPAD((v_fy_start % 100)::TEXT, 2, '0') || '-' || LPAD((v_fy_end % 100)::TEXT, 2, '0');

  v_prefix := 'DC/VRP/' || v_circle_code || '-' || v_cluster_code || '/' || v_fy || '/';

  SELECT COALESCE(MAX(NULLIF(split_part(challan_number, '/', 5), '')::INT), 0) + 1
  INTO v_next
  FROM inventory_issues
  WHERE challan_number LIKE v_prefix || '%';

  v_num := v_prefix || LPAD(v_next::TEXT, 3, '0');
  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

COMMIT;


