import { usePermissions } from '../../hooks/usePermissions';
import { AlertCircle, Lock, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const PermissionGuard = ({
  permission = null,
  alternativePermissions = [],
  module = null,
  minLevel = null,
  children,
  fallback = null
}) => {
  const { hasPermission, hasModuleAccess, isAtLeastLevel, isFullyAssigned, isSuperuser } = usePermissions();
  const { user, updateUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkAssignmentStatus = async () => {
    try {
      setIsRefreshing(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5000/api/users/assignment-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('🔄 Permission refresh - New permissions:', data.user.permissions);
          updateUser(data.user);
        }
      }
    } catch (error) {
      console.error('Error checking assignment status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check various permission conditions
  let hasAccess = true;
  let errorType = null;
  let errorMessage = '';

  // If user is not fully assigned (except superuser)
  if (!isFullyAssigned && !isSuperuser) {
    hasAccess = false;
    errorType = 'not-assigned';
    errorMessage = 'Please wait for an administrator to assign you a department and role.';
  }
  // Check specific permission (with alternatives)
  else if (permission && !hasPermission(permission)) {
    // Check if user has any of the alternative permissions
    const hasAnyAlternative = alternativePermissions.some(altPerm => hasPermission(altPerm));

    if (!hasAnyAlternative) {
      hasAccess = false;
      errorType = 'no-permission';
      errorMessage = `You don't have permission to access this feature. Required permission: ${permission}${alternativePermissions.length > 0 ? ` or ${alternativePermissions.join(' or ')}` : ''}`;
    }
  }
  // Check module access
  else if (module && !hasModuleAccess(module)) {
    hasAccess = false;
    errorType = 'no-module';
    errorMessage = `You don't have access to the ${module} module.`;
  }
  // Check minimum role level
  else if (minLevel !== null && !isAtLeastLevel(minLevel)) {
    hasAccess = false;
    errorType = 'insufficient-level';
    errorMessage = `This feature requires a higher access level.`;
  }

  // If access is granted, render children
  if (hasAccess) {
    return children;
  }

  // If fallback is provided, use it
  if (fallback) {
    return fallback;
  }

  // Default error UI based on error type
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {errorType === 'not-assigned' ? (
          <>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Setup Pending</h3>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-2">Current Status:</p>
                <div className="space-y-1">
                  <p>✅ Account Approved</p>
                  <p>⏳ Department Assignment</p>
                  <p>⏳ Role Assignment</p>
                </div>
              </div>
            </div>
            <button
              onClick={checkAssignmentStatus}
              disabled={isRefreshing}
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Checking...' : 'Check Status'}
            </button>
          </>
        ) : errorType === 'no-permission' ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Current Role: {user?.roleName || 'Not assigned'}</p>
                  <p>Department: {user?.departmentName || 'Not assigned'}</p>
                  {user?.roleLevel && <p>Access Level: {user.roleLevel}</p>}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={checkAssignmentStatus}
                disabled={isRefreshing}
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Permissions'}
              </button>
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <p className="font-medium mb-1">Debug Info:</p>
                <p>Role: {user?.roleName || 'Unknown'}</p>
                <p>Dept: {user?.departmentName || 'Unknown'}</p>
                <p>Level: {user?.roleLevel || 'Unknown'}</p>
                <p>Superuser: {user?.isSuperuser ? 'Yes' : 'No'}</p>
                <p>Features: {Object.keys(user?.permissions?.features || {}).length} modules</p>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Contact your administrator if you believe you should have access to this feature.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Current Role: {user?.roleName || 'Not assigned'}</p>
                  <p>Department: {user?.departmentName || 'Not assigned'}</p>
                  {user?.roleLevel && <p>Access Level: {user.roleLevel}</p>}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Contact your administrator if you believe you should have access to this feature.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PermissionGuard;
