/** Procurement feature areas (sidebar) and single-level tab nav per feature. */

export const PROCUREMENT_FEATURE_ORDER = ['pr', 'po', 'rfq', 'grn', 'invoice', 'returns', 'supplier'];

export const PROCUREMENT_FEATURES = {
  pr: {
    id: 'pr',
    sidebarLabel: 'Purchase requisitions',
    basePath: '/procurement/pr',
    routePrefix: 'pr',
    hideTabsWhen: [/^requisition-details/, /^requisition-edit/],
    tabs: [
      {
        id: 'requisition-list',
        label: 'All requisitions',
        segment: 'requisition-list',
        permission: 'procurement.purchase_requisition.read',
      },
      {
        id: 'create-requisition',
        label: 'New requisition',
        segment: 'create-requisition',
        permission: 'procurement.purchase_requisition.create',
      },
      {
        id: 'approval-tasks',
        label: 'Approvals',
        segment: 'approval-tasks',
        permission: 'procurement.purchase_requisition.approve',
      },
    ],
  },
  po: {
    id: 'po',
    sidebarLabel: 'Purchase orders',
    basePath: '/procurement/po',
    routePrefix: 'po',
    hideTabsWhen: [/^po-details/, /^po-edit/],
    tabs: [
      {
        id: 'po-list',
        label: 'All orders',
        segment: 'po-list',
        permission: 'procurement.purchase_order.read',
      },
      {
        id: 'create-po',
        label: 'Create PO',
        segment: 'create-po',
        permission: 'procurement.purchase_order.create',
      },
      {
        id: 'generate-from-pr',
        label: 'From requisition',
        segment: 'generate-from-pr',
        permission: 'procurement.purchase_order.create',
      },
      {
        id: 'approval-tasks',
        label: 'Approvals',
        segment: 'approval-tasks',
        permission: 'procurement.purchase_order.approve',
      },
    ],
  },
  rfq: {
    id: 'rfq',
    sidebarLabel: 'RFQ & quotes',
    basePath: '/procurement/rfq',
    routePrefix: 'rfq',
    hideTabsWhen: [/^rfq-details/],
    tabs: [
      {
        id: 'rfq-list',
        label: 'All RFQs',
        segment: 'rfq-list',
        permission: 'procurement.request_quotation.read',
      },
    ],
  },
  grn: {
    id: 'grn',
    sidebarLabel: 'Goods receipt (GRN)',
    basePath: '/procurement/grn',
    routePrefix: 'grn',
    hideTabsWhen: [/^grn-details/, /^grn-edit/],
    tabs: [
      {
        id: 'grn-list',
        label: 'All receipts',
        segment: 'grn-list',
        permission: 'procurement.goods_receipt.read',
      },
      {
        id: 'create-grn',
        label: 'New GRN',
        segment: 'create-grn',
        permission: 'procurement.goods_receipt.create',
      },
      {
        id: 'approval-tasks',
        label: 'Approvals',
        segment: 'approval-tasks',
        permission: 'procurement.goods_receipt.approve',
      },
    ],
  },
  invoice: {
    id: 'invoice',
    sidebarLabel: 'Invoices',
    basePath: '/procurement/invoice',
    routePrefix: 'invoice',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'invoice-list',
        label: 'Supplier invoices',
        segment: 'invoice-list',
        permission: 'procurement.supplier_invoice.read',
      },
    ],
  },
  returns: {
    id: 'returns',
    sidebarLabel: 'Returns (SRN)',
    basePath: '/procurement/returns',
    routePrefix: 'returns',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'srn-list',
        label: 'Return notes',
        segment: 'srn-list',
        permission: 'procurement.store_return_note.read',
      },
    ],
  },
  supplier: {
    id: 'supplier',
    sidebarLabel: 'Suppliers',
    basePath: '/procurement/supplier',
    routePrefix: 'supplier',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'supplier-management',
        label: 'Suppliers',
        segment: 'supplier-management',
        permission: 'procurement.supplier_management.read',
      },
      {
        id: 'price-lists',
        label: 'Price lists',
        segment: 'price-lists',
        permission: 'procurement.price_list.read',
      },
    ],
  },
};

export const PROCUREMENT_SIDEBAR_ITEMS = PROCUREMENT_FEATURE_ORDER.map((id) => {
  const f = PROCUREMENT_FEATURES[id];
  return {
    featureId: id,
    label: f.sidebarLabel,
    path: f.basePath,
    matchPrefix: f.basePath,
  };
});

export function getProcurementFeatureFromPath(pathname) {
  if (pathname.startsWith('/procurement/pr')) return PROCUREMENT_FEATURES.pr;
  if (pathname.startsWith('/procurement/po')) return PROCUREMENT_FEATURES.po;
  if (pathname.startsWith('/procurement/rfq')) return PROCUREMENT_FEATURES.rfq;
  if (pathname.startsWith('/procurement/grn')) return PROCUREMENT_FEATURES.grn;
  if (pathname.startsWith('/procurement/invoice')) return PROCUREMENT_FEATURES.invoice;
  if (pathname.startsWith('/procurement/returns')) return PROCUREMENT_FEATURES.returns;
  if (pathname.startsWith('/procurement/supplier')) return PROCUREMENT_FEATURES.supplier;
  return null;
}

export function getVisibleTabs(feature, hasPermission) {
  if (!feature) return [];
  return feature.tabs.filter((tab) => hasPermission(tab.permission));
}

export function procurementFeatureIsAccessible(featureId, hasPermission) {
  const feature = PROCUREMENT_FEATURES[featureId];
  if (!feature) return false;
  return getVisibleTabs(feature, hasPermission).length > 0;
}

export function getProcurementTabHref(feature, tab) {
  return `${feature.basePath}/${tab.segment}`;
}

export function getDefaultProcurementFeatureHref(hasPermission) {
  for (const id of PROCUREMENT_FEATURE_ORDER) {
    const feature = PROCUREMENT_FEATURES[id];
    const tabs = getVisibleTabs(feature, hasPermission);
    if (tabs.length > 0) return getProcurementTabHref(feature, tabs[0]);
  }
  return null;
}

export function shouldShowProcurementFeatureTabs(pathname) {
  const feature = getProcurementFeatureFromPath(pathname);
  if (!feature) return false;
  const rest = pathname.slice(feature.basePath.length).replace(/^\//, '');
  if (!rest) return false;
  return !feature.hideTabsWhen.some((re) => re.test(rest));
}

export function isProcurementTabPathActive(pathname, feature, tab) {
  const href = getProcurementTabHref(feature, tab);
  if (tab.segment === 'requisition-list' || tab.segment === 'po-list' || tab.segment === 'grn-list') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
