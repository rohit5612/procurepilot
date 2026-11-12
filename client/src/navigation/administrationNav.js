/** Administration (user management) — sidebar areas + tab nav per area. */

export const ADMINISTRATION_FEATURE_ORDER = ['user-operations', 'approval-workflows', 'organization'];

export const ADMINISTRATION_FEATURES = {
  'user-operations': {
    id: 'user-operations',
    sidebarLabel: 'Users',
    basePath: '/user-management/user-operations',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'user-directory',
        label: 'User directory',
        segment: 'user-directory',
        permission: 'user_management.user_directory.read',
      },
      {
        id: 'user-assignment',
        label: 'User assignment',
        segment: 'user-assignment',
        permission: 'user_management.user_assignment.read',
      },
    ],
  },
  'approval-workflows': {
    id: 'approval-workflows',
    sidebarLabel: 'Approvals',
    basePath: '/user-management/approval-workflows',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'user-approval',
        label: 'User approval',
        segment: 'user-approval',
        permission: 'user_management.user_approval.read',
      },
      {
        id: 'archived-users',
        label: 'Archived users',
        segment: 'archived-users',
        permission: 'user_management.archived_users.read',
      },
      {
        id: 'appeals',
        label: 'Appeals',
        segment: 'appeals',
        permission: 'user_management.appeals.read',
      },
    ],
  },
  organization: {
    id: 'organization',
    sidebarLabel: 'Organization',
    basePath: '/user-management/organization',
    hideTabsWhen: [],
    tabs: [
      {
        id: 'role-management',
        label: 'Roles',
        segment: 'role-management',
        permission: 'user_management.role_management.read',
      },
      {
        id: 'department-management',
        label: 'Departments',
        segment: 'department-management',
        permission: 'user_management.department_management.read',
      },
    ],
  },
};

export const ADMINISTRATION_SIDEBAR_ITEMS = ADMINISTRATION_FEATURE_ORDER.map((id) => {
  const f = ADMINISTRATION_FEATURES[id];
  return {
    featureId: id,
    label: f.sidebarLabel,
    path: f.basePath,
    matchPrefix: f.basePath,
  };
});

export function getAdministrationFeatureFromPath(pathname) {
  if (pathname.startsWith('/user-management/user-operations')) return ADMINISTRATION_FEATURES['user-operations'];
  if (pathname.startsWith('/user-management/approval-workflows')) return ADMINISTRATION_FEATURES['approval-workflows'];
  if (pathname.startsWith('/user-management/organization')) return ADMINISTRATION_FEATURES.organization;
  return null;
}

export function getVisibleAdminTabs(feature, hasPermission) {
  if (!feature) return [];
  return feature.tabs.filter((tab) => hasPermission(tab.permission));
}

export function administrationFeatureIsAccessible(featureId, hasPermission) {
  const feature = ADMINISTRATION_FEATURES[featureId];
  if (!feature) return false;
  return getVisibleAdminTabs(feature, hasPermission).length > 0;
}

export function getAdministrationTabHref(feature, tab) {
  return `${feature.basePath}/${tab.segment}`;
}

export function getDefaultAdministrationFeatureHref(hasPermission) {
  for (const id of ADMINISTRATION_FEATURE_ORDER) {
    const feature = ADMINISTRATION_FEATURES[id];
    const tabs = getVisibleAdminTabs(feature, hasPermission);
    if (tabs.length > 0) return getAdministrationTabHref(feature, tabs[0]);
  }
  return null;
}

export function shouldShowAdministrationFeatureTabs(pathname) {
  const feature = getAdministrationFeatureFromPath(pathname);
  if (!feature) return false;
  const rest = pathname.slice(feature.basePath.length).replace(/^\//, '');
  if (!rest) return false;
  return !feature.hideTabsWhen.some((re) => re.test(rest));
}

export function isAdministrationTabPathActive(pathname, feature, tab) {
  const href = getAdministrationTabHref(feature, tab);
  return pathname === href || pathname.startsWith(`${href}/`);
}
