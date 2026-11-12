import React from 'react';
import { 
  Users, 
  ShoppingCart, 
  Package, 
  Settings,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react';

const ModuleInfoBar = ({ moduleTitle, moduleDescription, activeTab }) => {
  // Get module icon based on module title
  const getModuleIcon = (title) => {
    switch (title.toLowerCase()) {
      case 'user management':
        return <Users size={24} className="text-primary" />;
      case 'procurement':
        return <ShoppingCart size={24} className="text-primary" />;
      case 'inventory':
        return <Package size={24} className="text-primary" />;
      case 'system':
        return <Settings size={24} className="text-primary" />;
      default:
        return <Settings size={24} className="text-primary" />;
    }
  };

  // Get quick stats based on active tab
  const getQuickStats = (tabId) => {
    switch (tabId) {
      case 'dashboard':
        return [
          { label: 'Total Items', value: '1,234', icon: <TrendingUp size={16} />, color: 'text-green-500' },
          { label: 'Pending', value: '23', icon: <Clock size={16} />, color: 'text-yellow-500' },
          { label: 'Issues', value: '5', icon: <AlertCircle size={16} />, color: 'text-red-500' }
        ];
      case 'user-operations':
        return [
          { label: 'Active Users', value: '156', icon: <Users size={16} />, color: 'text-green-500' },
          { label: 'Pending Approval', value: '8', icon: <Clock size={16} />, color: 'text-yellow-500' },
          { label: 'Archived', value: '12', icon: <AlertCircle size={16} />, color: 'text-gray-500' }
        ];
      case 'supplier':
        return [
          { label: 'Active Suppliers', value: '89', icon: <ShoppingCart size={16} />, color: 'text-green-500' },
          { label: 'Pending Reviews', value: '3', icon: <Clock size={16} />, color: 'text-yellow-500' },
          { label: 'Price Updates', value: '15', icon: <TrendingUp size={16} />, color: 'text-blue-500' }
        ];
      case 'masters':
        return [
          { label: 'Total Items', value: '2,456', icon: <Package size={16} />, color: 'text-green-500' },
          { label: 'Warehouses', value: '8', icon: <Settings size={16} />, color: 'text-blue-500' },
          { label: 'Low Stock', value: '34', icon: <AlertCircle size={16} />, color: 'text-red-500' }
        ];
      default:
        return [
          { label: 'Active', value: '156', icon: <TrendingUp size={16} />, color: 'text-green-500' },
          { label: 'Pending', value: '23', icon: <Clock size={16} />, color: 'text-yellow-500' },
          { label: 'Issues', value: '5', icon: <AlertCircle size={16} />, color: 'text-red-500' }
        ];
    }
  };

  const stats = getQuickStats(activeTab);

  return (
    <div className="bg-gradient-to-r from-muted/40 to-muted/60 border-b border-border/50 px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Module Info */}
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-muted/30 rounded-lg border border-border/40">
            {getModuleIcon(moduleTitle)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{moduleTitle}</h1>
            {moduleDescription && (
              <p className="text-sm text-muted mt-1">{moduleDescription}</p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center space-x-6">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-center space-x-3 bg-muted/20 px-4 py-2 rounded-lg border border-border/30 hover:bg-muted/40 transition-colors duration-200">
              <div className={`${stat.color} p-1 bg-muted/30 rounded-md`}>
                {stat.icon}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-fg">{stat.value}</div>
                <div className="text-xs text-muted">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModuleInfoBar;
