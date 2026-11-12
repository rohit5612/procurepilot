-- Add transfer approval workflow feature to the inventory module
BEGIN;

-- Insert the transfer_approval_workflow feature into the inventory module
INSERT INTO features (module_id, name, display_name, description, is_active)
SELECT 
  m.id,
  'transfer_approval_workflow',
  'Transfer Approval Workflow',
  'Approval workflow for inter-warehouse transfer challans before posting',
  true
FROM modules m
WHERE m.name = 'inventory'
AND NOT EXISTS (
  SELECT 1 FROM features f 
  WHERE f.module_id = m.id AND f.name = 'transfer_approval_workflow'
);

COMMIT;

