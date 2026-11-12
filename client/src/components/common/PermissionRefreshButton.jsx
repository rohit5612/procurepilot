import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { usePermissionRefresh } from '../../utils/permissionRefresh';

const PermissionRefreshButton = ({ 
  onSuccess = null, 
  onError = null, 
  className = '',
  children = 'Refresh Permissions'
}) => {
  const { manualRefresh } = usePermissionRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setStatus(null);
      
      const success = await manualRefresh();
      
      if (success) {
        setStatus('success');
        if (onSuccess) onSuccess();
        
        // Clear success status after 3 seconds
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        if (onError) onError();
        
        // Clear error status after 5 seconds
        setTimeout(() => setStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      setStatus('error');
      if (onError) onError(error);
      
      // Clear error status after 5 seconds
      setTimeout(() => setStatus(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getButtonContent = () => {
    if (isRefreshing) {
      return (
        <>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Refreshing...
        </>
      );
    }
    
    if (status === 'success') {
      return (
        <>
          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
          Permissions Updated!
        </>
      );
    }
    
    if (status === 'error') {
      return (
        <>
          <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
          Refresh Failed
        </>
      );
    }
    
    return (
      <>
        <RefreshCw className="h-4 w-4 mr-2" />
        {children}
      </>
    );
  };

  const getButtonClasses = () => {
    let baseClasses = 'inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors';
    
    if (isRefreshing) {
      return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`;
    }
    
    if (status === 'success') {
      return `${baseClasses} bg-green-600 text-white hover:bg-green-700`;
    }
    
    if (status === 'error') {
      return `${baseClasses} bg-red-600 text-white hover:bg-red-700`;
    }
    
    return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 ${className}`;
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={getButtonClasses()}
    >
      {getButtonContent()}
    </button>
  );
};

export default PermissionRefreshButton;
