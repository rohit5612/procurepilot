/**
 * Permission Refresh Utility
 * Automatically refreshes user permissions when 403 errors occur
 */

import { useAuth } from '../contexts/AuthContext';
import { api } from './api.js';

/**
 * Refresh user permissions by calling the assignment-status endpoint
 */
export const refreshUserPermissions = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('No access token found for permission refresh');
      return false;
    }

    // Prefer dedicated self-refresh endpoint
    const response = await fetch('/api/permissions/refresh/self', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        // Store new token if provided
        if (data.data.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken);
        }

        // Merge updated permissions into existing user
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        currentUser.permissions = data.data.permissions || currentUser.permissions;
        currentUser.id = currentUser.id || data.data.userId;
        localStorage.setItem('user', JSON.stringify(currentUser));

        console.log('🔄 Permissions refreshed successfully:', currentUser.permissions);
        return currentUser;
      }
    } else {
      console.error('Failed to refresh permissions:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error refreshing permissions:', error);
  }
  
  return false;
};

/**
 * Enhanced fetch function that automatically refreshes permissions on 403 errors
 */
export const fetchWithPermissionRefresh = async (url, options = {}) => {
  try {
    const token = localStorage.getItem('accessToken');
    const baseOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const response = await fetch(url, baseOptions);
    
    // If we get a 403 error, try to refresh permissions and retry once
    if (response.status === 403) {
      console.log('🔄 403 error detected, attempting permission refresh...');
      
      const refreshedUser = await refreshUserPermissions();
      if (refreshedUser) {
        // Update the Authorization header with the same token (it should still be valid)
        const newToken = localStorage.getItem('accessToken');
        const newOptions = {
          ...options,
          headers: {
            ...(options.headers || {}),
            ...(newToken ? { 'Authorization': `Bearer ${newToken}` } : {})
          }
        };
        console.log('🔄 Retrying request with refreshed permissions...');
        return await fetch(url, newOptions);
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error in fetchWithPermissionRefresh:', error);
    throw error;
  }
};

/**
 * Hook to get permission refresh functions
 */
export const usePermissionRefresh = () => {
  const { updateUser } = useAuth();

  const manualRefresh = async () => {
    const refreshedUser = await refreshUserPermissions();
    if (refreshedUser) {
      updateUser(refreshedUser);
      return true;
    }
    return false;
  };

  return {
    refreshUserPermissions,
    fetchWithPermissionRefresh,
    manualRefresh
  };
};
