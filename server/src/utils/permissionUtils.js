/**
 * Helper function to check user permissions
 */
export function checkPermission(user, module, feature, action) {
  // Superuser has all permissions
  if (user.isSuperuser) {
    return true;
  }

  const { permissions } = user;
  
  if (!permissions || !permissions.features) {
    return false;
  }

  // Check module access
  if (!permissions.modules.includes(module)) {
    return false;
  }

  // Check feature permission
  const featureKey = `${module}.${feature}`;
  const featurePermissions = permissions.features[featureKey];
  
  return featurePermissions && featurePermissions.includes(action);
}
