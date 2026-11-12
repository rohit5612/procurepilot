import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api.js';

/**
 * Hook to automatically refresh user permissions when they change
 * @param {Object} options - Configuration options
 * @param {number} options.intervalMs - Check interval in milliseconds (default: 30000)
 * @param {Function} options.onPermissionUpdate - Callback when permissions update
 * @returns {Object} - { manualRefresh: function }
 */
export const usePermissionRefresh = (options = {}) => {
  const { 
    intervalMs = 30000, 
    onPermissionUpdate 
  } = options;
  
  const { user, updateUser } = useAuth();
  const lastPermissionsRef = useRef(null);
  const intervalRef = useRef(null);

  const checkForPermissionUpdates = async () => {
    if (!user?.id) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await api.get('/api/users/assignment-status');

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.user) {
          const currentPermissions = JSON.stringify(data.user.permissions);
          const lastPermissions = lastPermissionsRef.current;

          if (lastPermissions && lastPermissions !== currentPermissions) {
            console.log('🔄 Permissions updated automatically - refreshing user data');
            updateUser(data.user);
            
            // Dispatch a custom event for components that need to react
            window.dispatchEvent(new CustomEvent('permissions-updated', { 
              detail: { newUser: data.user, oldUser: user } 
            }));

            if (onPermissionUpdate) {
              onPermissionUpdate(data.user, user);
            }
          }

          lastPermissionsRef.current = currentPermissions;
        }
      }
    } catch (error) {
      // Silently fail - don't spam console with network errors
      // console.warn('Permission refresh check failed:', error);
    }
  };

  const manualRefresh = async () => {
    await checkForPermissionUpdates();
  };

  useEffect(() => {
    if (!user?.id) return;

    // Initialize with current permissions
    if (user.permissions) {
      lastPermissionsRef.current = JSON.stringify(user.permissions);
    }

    // Set up interval
    intervalRef.current = setInterval(checkForPermissionUpdates, intervalMs);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user?.id, intervalMs]);

  return { manualRefresh };
};

