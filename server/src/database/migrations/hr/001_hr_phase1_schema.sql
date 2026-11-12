-- HR Phase 1 Schema (module/hr only)
-- Creates HR-specific master and employee tables to avoid collision with ERP user management

BEGIN;

-- Departments
CREATE TABLE IF NOT EXISTS hr_department (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Designations
CREATE TABLE IF NOT EXISTS hr_designation (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Grades
CREATE TABLE IF NOT EXISTS hr_grade (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Positions (roles)
CREATE TABLE IF NOT EXISTS hr_position (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  grade_id INTEGER REFERENCES hr_grade(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS hr_location (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cost Centers
CREATE TABLE IF NOT EXISTS hr_cost_center (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Employee
CREATE TABLE IF NOT EXISTS hr_employee (
  id SERIAL PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  join_date DATE,
  department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  designation_id INTEGER REFERENCES hr_designation(id) ON DELETE SET NULL,
  position_id INTEGER REFERENCES hr_position(id) ON DELETE SET NULL,
  grade_id INTEGER REFERENCES hr_grade(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,
  supervisor_employee_id INTEGER REFERENCES hr_employee(id) ON DELETE SET NULL,
  work_status TEXT NOT NULL DEFAULT 'active', -- active | resigned | notice
  status_changed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_department ON hr_employee(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_supervisor ON hr_employee(supervisor_employee_id);

-- Supervisor map (explicit mapping; optional if using hr_employee.supervisor_employee_id)
CREATE TABLE IF NOT EXISTS hr_supervisor_map (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  supervisor_employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_supervisor_active ON hr_supervisor_map(employee_id, effective_from) WHERE effective_to IS NULL;

-- Link HR employee to ERP user (optional linkage)
CREATE TABLE IF NOT EXISTS hr_employee_user_link (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, -- references users(id) in ERP schema
  linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id),
  UNIQUE (user_id)
);

-- Employee documents metadata (binary stored via storage adapter)
CREATE TABLE IF NOT EXISTS hr_employee_document (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- Aadhaar, PAN, certificate, appointment_letter, etc
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL, -- path or S3 key
  content_type TEXT,
  file_size BIGINT,
  uploaded_by_user_id INTEGER,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_doc_employee ON hr_employee_document(employee_id);

COMMIT;
