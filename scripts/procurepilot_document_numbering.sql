-- Apply on existing DBs to replace VRP-style PR/PO generators.
-- Safe to re-run (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION procurepilot_fy_label()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_fy_start INT;
  v_fy_end INT;
BEGIN
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_fy_start := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  ELSE
    v_fy_start := EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1;
  END IF;
  v_fy_end := v_fy_start + 1;
  RETURN LPAD((v_fy_start % 100)::TEXT, 2, '0') || '-' || LPAD((v_fy_end % 100)::TEXT, 2, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_requisition_number(p_circle_id INTEGER DEFAULT NULL, p_cluster_id INTEGER DEFAULT NULL)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fy TEXT;
  v_prefix TEXT;
  v_next INT;
BEGIN
  v_fy := procurepilot_fy_label();
  v_prefix := 'PR/' || v_fy || '/';
  SELECT COALESCE(MAX(
    CASE
      WHEN requisition_number ~ ('^PR/' || v_fy || '/[0-9]+$')
      THEN substring(requisition_number from length(v_prefix) + 1)::INT
      ELSE 0
    END
  ), 0) + 1
  INTO v_next
  FROM requisitions
  WHERE requisition_number LIKE v_prefix || '%';
  RETURN v_prefix || LPAD(v_next::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_po_number(p_circle_id INTEGER DEFAULT NULL)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fy TEXT;
  v_prefix TEXT;
  v_next INT;
BEGIN
  v_fy := procurepilot_fy_label();
  v_prefix := 'PO/' || v_fy || '/';
  SELECT COALESCE(MAX(
    CASE
      WHEN po_number ~ ('^PO/' || v_fy || '/[0-9]+$')
      THEN substring(po_number from length(v_prefix) + 1)::INT
      ELSE 0
    END
  ), 0) + 1
  INTO v_next
  FROM purchase_orders
  WHERE po_number LIKE v_prefix || '%';
  RETURN v_prefix || LPAD(v_next::TEXT, 6, '0');
END;
$$;

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
