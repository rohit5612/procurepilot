-- HR Org: Holiday Calendar (for Leave + Payroll)
BEGIN;

CREATE TABLE IF NOT EXISTS hr_holiday_calendar (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  applicable_location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_holiday_calendar_active ON hr_holiday_calendar(is_active);
CREATE INDEX IF NOT EXISTS idx_hr_holiday_calendar_location ON hr_holiday_calendar(applicable_location_id);

CREATE TABLE IF NOT EXISTS hr_holiday (
  id SERIAL PRIMARY KEY,
  calendar_id INTEGER NOT NULL REFERENCES hr_holiday_calendar(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday','optional','restricted')),
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_holiday_calendar_date ON hr_holiday(calendar_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_hr_holiday_date ON hr_holiday(holiday_date);

COMMIT;

