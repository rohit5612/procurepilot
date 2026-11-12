import React from 'react';
import { MapPin, Building2, Globe, Users, CheckCircle, XCircle, RadioTower } from 'lucide-react';

const SiteStats = ({ sites }) => {
  const stats = {
    total: sites.length,
    active: sites.filter(site => site.status === 'ACTIVE').length,
    inactive: sites.filter(site => site.status === 'INACTIVE').length,
    types: {
      office: sites.filter(site => site.site_type === 'OFFICE').length,
      warehouse: sites.filter(site => site.site_type === 'WAREHOUSE').length,
      factory: sites.filter(site => site.site_type === 'FACTORY').length,
      retail: sites.filter(site => site.site_type === 'RETAIL').length,
      distribution: sites.filter(site => site.site_type === 'DISTRIBUTION').length,
      indus: sites.filter(site => site.site_type === 'INDUS').length,
      other: sites.filter(site => !['OFFICE', 'WAREHOUSE', 'FACTORY', 'RETAIL', 'DISTRIBUTION', 'INDUS'].includes(site.site_type)).length
    },
    default: sites.filter(site => site.is_default).length,
    withContact: sites.filter(site => site.contact_person || site.email || site.phone).length
  };

  const statCards = [
    {
      title: 'Total Sites',
      value: stats.total,
      icon: MapPin,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'All company locations'
    },
    {
      title: 'Active Sites',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Currently operational'
    },
    {
      title: 'Default Site',
      value: stats.default,
      icon: Building2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Primary location'
    },
    {
      title: 'With Contact',
      value: stats.withContact,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'Have contact info'
    }
  ];

  const typeBreakdown = [
    { type: 'Office', count: stats.types.office, color: 'bg-blue-500' },
    { type: 'Warehouse', count: stats.types.warehouse, color: 'bg-green-500' },
    { type: 'Factory', count: stats.types.factory, color: 'bg-orange-500' },
    { type: 'Retail', count: stats.types.retail, color: 'bg-purple-500' },
    { type: 'Distribution', count: stats.types.distribution, color: 'bg-indigo-500' },
    { type: 'Indus', count: stats.types.indus, color: 'bg-emerald-500', icon: RadioTower },
    { type: 'Other', count: stats.types.other, color: 'bg-gray-500' }
  ].filter(item => item.count > 0);

  return (
    <div className="space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Site Type Breakdown */}
      {typeBreakdown.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Site Type Breakdown</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/90 rounded-lg">
                <div className="flex items-center space-x-3">
                  {item.icon ? (
                    <div className={`p-1.5 rounded-full bg-muted`}>
                      <item.icon className={`h-4 w-4 text-emerald-500`} />
                    </div>
                  ) : (
                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  )}
                  <span className="font-medium text-foreground">{item.type}</span>
                </div>
                <span className="text-lg font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active vs Inactive */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Site Status</span>
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Sites</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-green-600">{stats.active}</span>
                <span className="text-xs text-muted-foreground">
                  ({stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Inactive Sites</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-red-600">{stats.inactive}</span>
                <span className="text-xs text-muted-foreground">
                  ({stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Contact Coverage</span>
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">With Contact Info</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-blue-600">{stats.withContact}</span>
                <span className="text-xs text-muted-foreground">
                  ({stats.total > 0 ? Math.round((stats.withContact / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Without Contact Info</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-orange-600">{stats.total - stats.withContact}</span>
                <span className="text-xs text-muted-foreground">
                  ({stats.total > 0 ? Math.round(((stats.total - stats.withContact) / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteStats;

