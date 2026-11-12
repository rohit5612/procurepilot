/**
 * ProcurePilot RBAC catalog — single source of truth for modules/features
 * shown in the permission matrix and resolved at login.
 * Policy engine will attach rules to role_level (1–5) and roles.
 */

export const PROCUREPILOT_MODULE_ORDER = [
  'user_management',
  'procurement',
  'inventory',
  'procurepilot'
];

/** @type {Record<string, string[]>} */
export const PROCUREPILOT_FEATURES = {
  user_management: [
    'user_directory',
    'department_management',
    'role_management',
    'user_assignment',
    'user_approval',
    'archived_users',
    'appeals'
  ],
  procurement: [
    'purchase_requisition',
    'purchase_order',
    'goods_receipt',
    'request_quotation',
    'supplier_invoice',
    'store_return_note',
    'supplier_management',
    'price_list'
  ],
  inventory: [
    'item_master',
    'site_master',
    'warehouse_management',
    'bin_management',
    'transaction_categories'
  ],
  procurepilot: [
    'ai_buy',
    'policy_admin'
  ]
};

/** ERP modules/features removed from the product — deactivated in DB cleanup script */
export const DEPRECATED_MODULE_NAMES = ['system', 'hr', 'reports'];

export const ROLE_LEVELS = [
  {
    level: 1,
    label: 'L1 — Org admin',
    shortLabel: 'Admin',
    policyHint: 'Full org config, user/role admin, policy overrides',
    canApproveByDefault: true,
    dataScopeDefault: 'all'
  },
  {
    level: 2,
    label: 'L2 — Department head',
    shortLabel: 'Dept head',
    policyHint: 'Department approvals, budgets, user onboarding',
    canApproveByDefault: true,
    dataScopeDefault: 'department'
  },
  {
    level: 3,
    label: 'L3 — Manager',
    shortLabel: 'Manager',
    policyHint: 'Create/submit requests; no procurement approval',
    canApproveByDefault: false,
    dataScopeDefault: 'department'
  },
  {
    level: 4,
    label: 'L4 — Requester',
    shortLabel: 'Senior user',
    policyHint: 'Own/team PRs; policy caps apply strictly',
    canApproveByDefault: false,
    dataScopeDefault: 'own'
  },
  {
    level: 5,
    label: 'L5 — Basic',
    shortLabel: 'Basic user',
    policyHint: 'Read + limited create; lowest spend authority',
    canApproveByDefault: false,
    dataScopeDefault: 'own'
  }
];

export function isProcurePilotFeature(moduleName, featureName) {
  const list = PROCUREPILOT_FEATURES[moduleName];
  return Array.isArray(list) && list.includes(featureName);
}

export function getProcurePilotFeaturePairs() {
  const moduleNames = [];
  const featureNames = [];
  for (const moduleName of PROCUREPILOT_MODULE_ORDER) {
    const features = PROCUREPILOT_FEATURES[moduleName] || [];
    for (const featureName of features) {
      moduleNames.push(moduleName);
      featureNames.push(featureName);
    }
  }
  return { moduleNames, featureNames };
}

/**
 * SQL fragment: (m.name, f.name) must match catalog pairs.
 * @param {string} mAlias
 * @param {string} fAlias
 */
export function procurePilotFeaturePairSql(mAlias = 'm', fAlias = 'f') {
  const { moduleNames, featureNames } = getProcurePilotFeaturePairs();
  const parts = moduleNames.map(
    (_, i) => `(${mAlias}.name = '${moduleNames[i]}' AND ${fAlias}.name = '${featureNames[i]}')`
  );
  return `(${parts.join(' OR ')})`;
}

export function sortModulesForDisplay(modulesObject) {
  const sorted = {};
  for (const name of PROCUREPILOT_MODULE_ORDER) {
    if (modulesObject[name]) sorted[name] = modulesObject[name];
  }
  for (const name of Object.keys(modulesObject)) {
    if (!sorted[name]) sorted[name] = modulesObject[name];
  }
  return sorted;
}
