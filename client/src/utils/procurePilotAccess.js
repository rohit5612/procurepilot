/** Client mirror of server ProcurePilot RBAC catalog (display only). */

export const PROCUREPILOT_MODULE_ORDER = [
  'user_management',
  'procurement',
  'inventory',
  'procurepilot'
];

export const MODULE_DISPLAY_LABELS = {
  user_management: 'User management',
  procurement: 'Procurement',
  inventory: 'Inventory masters',
  procurepilot: 'ProcurePilot'
};

export const ROLE_LEVELS = [
  { level: 1, label: 'L1 — Org admin', hint: 'Policy overrides, roles, org-wide data' },
  { level: 2, label: 'L2 — Department head', hint: 'Approvals and department policy' },
  { level: 3, label: 'L3 — Manager', hint: 'Submit requests; no PO/PR approval' },
  { level: 4, label: 'L4 — Requester', hint: 'Own-scope purchasing' },
  { level: 5, label: 'L5 — Basic', hint: 'Minimal create/read' }
];

export function sortPermissionModules(modules) {
  if (!modules || typeof modules !== 'object') return {};
  const sorted = {};
  for (const name of PROCUREPILOT_MODULE_ORDER) {
    if (modules[name]) sorted[name] = modules[name];
  }
  for (const key of Object.keys(modules)) {
    if (!sorted[key]) sorted[key] = modules[key];
  }
  return sorted;
}
