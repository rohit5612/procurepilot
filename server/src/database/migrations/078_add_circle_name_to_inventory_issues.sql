-- Add circle_name column to inventory_issues to store circle information
ALTER TABLE inventory_issues
ADD COLUMN IF NOT EXISTS circle_name VARCHAR(100);

-- Comment
COMMENT ON COLUMN inventory_issues.circle_name IS 'Name of the circle (geographical division) for the site';

