-- Create sites table (simplified version)
BEGIN;

CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    site_type VARCHAR(50) DEFAULT 'OFFICE',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_sites_site_code ON sites(site_code);
CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_sites_site_type ON sites(site_type);
CREATE INDEX idx_sites_country ON sites(country);

-- Insert default site
INSERT INTO sites (site_code, name, description, site_type, status, is_default)
VALUES ('HQ', 'Headquarters', 'Main office location', 'OFFICE', 'ACTIVE', true);

COMMIT;
