/** Masters (inventory reference data) — single sidebar area + tab row. */

export const MASTERS_FEATURE = {
  id: 'masters',
  sidebarLabel: 'Masters',
  basePath: '/inventory/masters',
  hideTabsWhen: [],
  tabs: [
    {
      id: 'items',
      label: 'Items',
      segment: 'items',
      permission: 'inventory.item_master.read',
    },
    {
      id: 'categories',
      label: 'Categories',
      segment: 'categories',
      permission: 'inventory.item_master.read',
    },
    {
      id: 'sites',
      label: 'Sites',
      segment: 'sites',
      permission: 'inventory.site_master.read',
    },
    {
      id: 'warehouses',
      label: 'Warehouses',
      segment: 'warehouses',
      permission: 'inventory.warehouse_management.read',
    },
    {
      id: 'bins',
      label: 'Bins',
      segment: 'bins',
      permission: 'inventory.bin_management.read',
    },
    {
      id: 'transaction-categories',
      label: 'Transaction categories',
      segment: 'transaction-categories',
      permission: 'inventory.transaction_categories.read',
    },
  ],
};

export function getVisibleMastersTabs(feature = MASTERS_FEATURE, hasPermission) {
  if (!feature) return [];
  return feature.tabs.filter((tab) => hasPermission(tab.permission));
}

export function mastersModuleIsAccessible(hasPermission) {
  return getVisibleMastersTabs(MASTERS_FEATURE, hasPermission).length > 0;
}

export function getMastersTabHref(feature, tab) {
  return `${feature.basePath}/${tab.segment}`;
}

export function getDefaultMastersHref(hasPermission) {
  const tabs = getVisibleMastersTabs(MASTERS_FEATURE, hasPermission);
  if (tabs.length === 0) return null;
  return getMastersTabHref(MASTERS_FEATURE, tabs[0]);
}

export function getMastersFeatureFromPath(pathname) {
  if (pathname.startsWith(MASTERS_FEATURE.basePath)) return MASTERS_FEATURE;
  return null;
}

export function shouldShowMastersTabs(pathname) {
  const feature = getMastersFeatureFromPath(pathname);
  if (!feature) return false;
  const rest = pathname.slice(feature.basePath.length).replace(/^\//, '');
  if (!rest) return false;
  return !feature.hideTabsWhen.some((re) => re.test(rest));
}

export function isMastersTabPathActive(pathname, feature, tab) {
  const href = getMastersTabHref(feature, tab);
  return pathname === href || pathname.startsWith(`${href}/`);
}
