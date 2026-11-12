-- Migration: Create units of measure table
-- Description: Units of measure table for item measurement standards
-- Date: 2025-08-16

BEGIN;

CREATE TABLE IF NOT EXISTS units_of_measure (
    id SERIAL PRIMARY KEY,
    uom_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    uom_type VARCHAR(50) DEFAULT 'UNIT',
    base_uom_id INTEGER REFERENCES units_of_measure(id),
    conversion_factor DECIMAL(10,6) DEFAULT 1.0,
    is_base_unit BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_units_of_measure_uom_code ON units_of_measure(uom_code);
CREATE INDEX idx_units_of_measure_uom_type ON units_of_measure(uom_type);
CREATE INDEX idx_units_of_measure_base_uom_id ON units_of_measure(base_uom_id);
CREATE INDEX idx_units_of_measure_is_active ON units_of_measure(is_active);
CREATE INDEX idx_units_of_measure_sort_order ON units_of_measure(sort_order);

-- Add audit trigger
CREATE TRIGGER units_of_measure_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON units_of_measure
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Insert default units of measure
INSERT INTO units_of_measure (uom_code, name, description, uom_type, is_base_unit, is_active, sort_order) VALUES
-- Weight units
('KG', 'Kilogram', 'Base weight unit', 'WEIGHT', true, true, 1),
('G', 'Gram', 'Gram unit', 'WEIGHT', false, true, 2),
('LB', 'Pound', 'Pound unit', 'WEIGHT', false, true, 3),
('OZ', 'Ounce', 'Ounce unit', 'WEIGHT', false, true, 4),

-- Volume units
('L', 'Liter', 'Base volume unit', 'VOLUME', true, true, 5),
('ML', 'Milliliter', 'Milliliter unit', 'VOLUME', false, true, 6),
('GAL', 'Gallon', 'Gallon unit', 'VOLUME', false, true, 7),

-- Length units
('M', 'Meter', 'Base length unit', 'LENGTH', true, true, 8),
('CM', 'Centimeter', 'Centimeter unit', 'LENGTH', false, true, 9),
('MM', 'Millimeter', 'Millimeter unit', 'LENGTH', false, true, 10),
('FT', 'Foot', 'Foot unit', 'LENGTH', false, true, 11),
('IN', 'Inch', 'Inch unit', 'LENGTH', false, true, 12),

-- Area units
('M2', 'Square Meter', 'Base area unit', 'AREA', true, true, 13),
('FT2', 'Square Foot', 'Square foot unit', 'AREA', false, true, 14),

-- Count units
('PCS', 'Pieces', 'Base count unit', 'COUNT', true, true, 15),
('BOX', 'Box', 'Box unit', 'COUNT', false, true, 16),
('PACK', 'Pack', 'Pack unit', 'COUNT', false, true, 17),
('SET', 'Set', 'Set unit', 'COUNT', false, true, 18),
('PAIR', 'Pair', 'Pair unit', 'COUNT', false, true, 19),

-- Time units
('HOUR', 'Hour', 'Hour unit', 'TIME', true, true, 20),
('DAY', 'Day', 'Day unit', 'TIME', false, true, 21),
('WEEK', 'Week', 'Week unit', 'TIME', false, true, 22),
('MONTH', 'Month', 'Month unit', 'TIME', false, true, 23);

-- Update conversion factors for weight units
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'KG'), conversion_factor = 0.001 WHERE uom_code = 'G';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'KG'), conversion_factor = 0.453592 WHERE uom_code = 'LB';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'KG'), conversion_factor = 0.0283495 WHERE uom_code = 'OZ';

-- Update conversion factors for volume units
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'L'), conversion_factor = 0.001 WHERE uom_code = 'ML';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'L'), conversion_factor = 3.78541 WHERE uom_code = 'GAL';

-- Update conversion factors for length units
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'M'), conversion_factor = 0.01 WHERE uom_code = 'CM';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'M'), conversion_factor = 0.001 WHERE uom_code = 'MM';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'M'), conversion_factor = 0.3048 WHERE uom_code = 'FT';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'M'), conversion_factor = 0.0254 WHERE uom_code = 'IN';

-- Update conversion factors for area units
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'M2'), conversion_factor = 0.092903 WHERE uom_code = 'FT2';

-- Update conversion factors for time units
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'HOUR'), conversion_factor = 24 WHERE uom_code = 'DAY';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'HOUR'), conversion_factor = 168 WHERE uom_code = 'WEEK';
UPDATE units_of_measure SET base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'HOUR'), conversion_factor = 730.484 WHERE uom_code = 'MONTH';

COMMIT;
