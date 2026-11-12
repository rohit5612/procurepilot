-- ProcurePilot: drop ERP tables not used by the trimmed app.
-- Target DB: procurepilot
--
-- BEFORE RUNNING (strongly recommended):
--   pg_dump -h localhost -U postgres -d procurepilot -F c -f procurepilot_pre_prune.dump
--
-- After running: restart API server; flush Redis (redis-cli FLUSHDB) in dev if needed.

BEGIN;

-- ---------- HR (module disabled) ----------
DROP TABLE IF EXISTS
  hr_attendance_log,
  hr_attendance_period_summary,
  hr_attendance_staging,
  hr_attendance_period,
  hr_overtime_entry,
  hr_shift_roster,
  hr_shift_template,
  hr_leave_ledger,
  hr_leave_encashment,
  hr_leave_comp_off_credit,
  hr_leave_balance,
  hr_leave_request,
  hr_leave_policy,
  hr_leave_category,
  hr_holiday,
  hr_holiday_calendar,
  hr_payroll_run_item,
  hr_payroll_payslip,
  hr_payroll_input,
  hr_payroll_employee_period,
  hr_payroll_employee_structure_line,
  hr_payroll_employee_structure,
  hr_payroll_employee_assignment,
  hr_payroll_run,
  hr_payroll_structure_line,
  hr_payroll_structure,
  hr_payroll_component,
  hr_payroll_statutory_settings,
  hr_employee_document,
  hr_employee_education,
  hr_employee_experience,
  hr_employee_dependent,
  hr_employee_nominee,
  hr_employee_bank_account,
  hr_employee_transfer,
  hr_employee_user_link,
  hr_employee,
  hr_supervisor_map,
  hr_position,
  hr_designation,
  hr_grade,
  hr_cost_center,
  hr_location,
  hr_department,
  hr_company_profile
CASCADE;

-- ---------- GRN ----------
DROP TABLE IF EXISTS grn_lines, goods_receipts CASCADE;

-- ---------- Inventory transactions (masters kept) ----------
DROP TABLE IF EXISTS
  stock_count_lines,
  stock_counts,
  store_return_items,
  store_return_notes,
  srn_counters,
  inventory_adjustment_lines,
  inventory_adjustments,
  inventory_issue_lines,
  inventory_issues,
  inventory_transfer_lines,
  inventory_transfers,
  inventory_transactions,
  inventory_layers,
  inventory_employee_master
CASCADE;

-- ---------- Reporting / system admin UI (unmounted) ----------
DROP TABLE IF EXISTS report_presets CASCADE;
DROP TABLE IF EXISTS module_registration_logs, propagation_runs CASCADE;

-- ---------- Logging / audit (writers are no-op in app) ----------
DROP TABLE IF EXISTS activity_logs, error_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
-- Partition children (if parent drop did not remove them)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'audit_logs_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', r.tablename);
  END LOOP;
END $$;

-- ---------- Domain outbox (publishEvent stubbed in app) ----------
DROP FUNCTION IF EXISTS insert_domain_event(character varying, character varying, character varying, jsonb, jsonb, integer) CASCADE;
DROP TABLE IF EXISTS domain_outbox CASCADE;

-- ---------- Junk ----------
DROP TABLE IF EXISTS test_table CASCADE;

COMMIT;

-- Remaining core (expected): users/RBAC, procurement, inventory masters, workflows, geo, price lists
