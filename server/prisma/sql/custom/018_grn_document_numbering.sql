-- ProcurePilot GRN numbers: GRN/{FY}/{SEQ6} — replaces GRN/VRP/... format.

CREATE OR REPLACE FUNCTION generate_grn_number(p_circle_id INTEGER DEFAULT NULL, p_cluster_id INTEGER DEFAULT NULL)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fy TEXT;
  v_prefix TEXT;
  v_next INT;
BEGIN
  v_fy := procurepilot_fy_label();
  v_prefix := 'GRN/' || v_fy || '/';

  SELECT COALESCE(MAX(
    CASE
      WHEN grn_number ~ ('^GRN/' || v_fy || '/[0-9]+$')
      THEN substring(grn_number from length(v_prefix) + 1)::INT
      ELSE 0
    END
  ), 0) + 1
  INTO v_next
  FROM goods_receipts
  WHERE grn_number LIKE v_prefix || '%';

  RETURN v_prefix || LPAD(v_next::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION generate_grn_number(INTEGER, INTEGER) IS
  'ProcurePilot GRN numbers: GRN/FY25-26/000001 (no VRP segment).';
