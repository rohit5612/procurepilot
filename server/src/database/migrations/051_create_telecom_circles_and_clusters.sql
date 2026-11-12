-- Create telecom circles and clusters master tables
BEGIN;

CREATE TABLE IF NOT EXISTS telecom_circles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clusters (
  id SERIAL PRIMARY KEY,
  circle_id INTEGER NOT NULL REFERENCES telecom_circles(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(circle_id, code),
  UNIQUE(circle_id, name)
);

-- updated_at triggers
CREATE TRIGGER update_telecom_circles_updated_at
  BEFORE UPDATE ON telecom_circles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clusters_updated_at
  BEFORE UPDATE ON clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed 22 telecom circles (codes indicative)
INSERT INTO telecom_circles(code, name) VALUES
  ('AP', 'Andhra Pradesh'),
  ('ASM', 'Assam'),
  ('BIH', 'Bihar'),
  ('CHN', 'Chennai'),
  ('DL', 'Delhi'),
  ('GUJ', 'Gujarat'),
  ('HAR', 'Haryana'),
  ('HP', 'Himachal Pradesh'),
  ('JK', 'Jammu & Kashmir'),
  ('KAR', 'Karnataka'),
  ('KER', 'Kerala'),
  ('KOL', 'Kolkata'),
  ('MP', 'Madhya Pradesh'),
  ('MH', 'Maharashtra'),
  ('MU', 'Mumbai'),
  ('NE', 'North East'),
  ('OR', 'Odisha'),
  ('PB', 'Punjab'),
  ('RJ', 'Rajasthan'),
  ('TN', 'Tamil Nadu'),
  ('UPW', 'Uttar Pradesh (West)'),
  ('UP E', 'Uttar Pradesh (East)')
ON CONFLICT (code) DO NOTHING;

COMMIT;


