import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart,
  Package,
  Settings,
  FileText,
  ClipboardList,
  Truck,
  Receipt,
  Warehouse,
  BarChart3,
  TrendingUp,
  Shield,
  Activity,
  Workflow
} from 'lucide-react';

const MainTabs = ({ tabs, activeTab, onTabChange }) => {
  // Icon mapping for different tab types
  const getIcon = (tabId) => {
    const iconMap = {
      // Dashboard icons
      'dashboard': LayoutDashboard,
      
      // User Management icons
      'user-operations': Users,
      'approval-workflows': FileText,
      'organization': Shield,
      
      // Procurement icons
      'pr': ClipboardList,
      'rfq': FileText,
      'po': ShoppingCart,
      'supplier': Users,
      'grn': Truck,
      'receipts': Receipt,
      
      // Inventory icons
      'masters': Warehouse,
      'transactions': BarChart3,
      'stock-control': Activity,
      'planning': TrendingUp,
      
      // System icons
      'module-registry': Settings,
      'audit-logs': Activity,
      'workflow-engine': Workflow
    };
    
    return iconMap[tabId] || LayoutDashboard;
  };

  return (
    <div className="bg-surface border-b border-border p-6">
      <div className="flex flex-wrap gap-4">
        {tabs.map(tab => {
          const Icon = getIcon(tab.id);
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center
                w-24 h-24 rounded-xl transition-all duration-200
                border-2 hover:shadow-md hover:scale-105
                ${isActive 
                  ? 'bg-primary border-primary text-primary-foreground shadow-lg' 
                  : 'bg-surface border-border text-muted hover:border-primary/50 hover:text-fg hover:bg-surface/80'
                }
              `}
            >
              <Icon size={24} className="mb-2" />
              <span className="text-xs font-medium text-center leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MainTabs;
