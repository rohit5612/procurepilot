-- HR Phase 2: Attendance & Shifts (CSV-first)
BEGIN;

-- Staging table for raw biometric/CSV imports
CREATE TABLE IF NOT EXISTS hr_attendance_staging (
  id SERIAL PRIMARY KEY,
  device_id TEXT,
  employee_code TEXT,
  employee_id INTEGER REFERENCES hr_employee(id) ON DELETE SET NULL,
  ts_raw TEXT,
  punch_time TIMESTAMPTZ,
  punch_type TEXT CHECK (punch_type IN ('IN','OUT')),
  source TEXT DEFAULT 'csv',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | normalized | rejected
  error TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  normalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_staging_status ON hr_attendance_staging(status);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_staging_employee_time ON hr_attendance_staging(employee_id, punch_time);

-- Normalized attendance log
CREATE TABLE IF NOT EXISTS hr_attendance_log (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  punch_time TIMESTAMPTZ NOT NULL,
  punch_type TEXT CHECK (punch_type IN ('IN','OUT')) NOT NULL,
  device_id TEXT,
  source TEXT DEFAULT 'csv',
  staging_id INTEGER REFERENCES hr_attendance_staging(id) ON DELETE SET NULL,
  is_exception BOOLEAN DEFAULT FALSE,
  exception_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_log_employee_time ON hr_attendance_log(employee_id, punch_time);

-- Shift templates
CREATE TABLE IF NOT EXISTS hr_shift_template (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_in_minutes INTEGER DEFAULT 0,
  grace_out_minutes INTEGER DEFAULT 0,
  ot_after_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roster (assignment of shifts to employees)
CREATE TABLE IF NOT EXISTS hr_shift_roster (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  shift_template_id INTEGER NOT NULL REFERENCES hr_shift_template(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

-- Attendance period for monthly close/approvals
CREATE TABLE IF NOT EXISTS hr_attendance_period (
  id SERIAL PRIMARY KEY,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | submitted | supervisor_approved | hr_finalized | closed
  opened_by INTEGER,
  submitted_by INTEGER,
  approved_by INTEGER,
  finalized_by INTEGER,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  UNIQUE (period_month, period_year)
);

-- Attendance period summary per employee
CREATE TABLE IF NOT EXISTS hr_attendance_period_summary (
  id SERIAL PRIMARY KEY,
  attendance_period_id INTEGER NOT NULL REFERENCES hr_attendance_period(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  ot_minutes INTEGER DEFAULT 0,
  exceptions INTEGER DEFAULT 0,
  UNIQUE (attendance_period_id, employee_id)
);

COMMIT;

