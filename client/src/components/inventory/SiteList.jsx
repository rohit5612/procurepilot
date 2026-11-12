import React from 'react';
import { Edit, Settings, MapPin, Building2, Globe, Phone, Mail, User, BadgeCheck } from 'lucide-react';

const SiteList = ({ sites, onEdit, onSettings, loading }) => {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-muted rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-8 w-20 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No sites found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first company site.
          </p>
        </div>
      </div>
    );
  }

  const getSiteTypeColor = (type) => {
    const colors = {
      'OFFICE': 'bg-blue-100 text-blue-800',
      'WAREHOUSE': 'bg-green-100 text-green-800',
      'FACTORY': 'bg-orange-100 text-orange-800',
      'RETAIL': 'bg-purple-100 text-purple-800',
      'DISTRIBUTION': 'bg-indigo-100 text-indigo-800',
      'INDUS': 'bg-emerald-100 text-emerald-800',
      'OTHER': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors['OTHER'];
  };

  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left p-4 font-medium text-foreground">Site</th>
              <th className="text-left p-4 font-medium text-foreground">Type</th>
              <th className="text-left p-4 font-medium text-foreground">Location</th>
              <th className="text-left p-4 font-medium text-foreground">Hub Status</th>
              <th className="text-left p-4 font-medium text-foreground">AOM</th>
              <th className="text-left p-4 font-medium text-foreground">Technician / FSE</th>
              <th className="text-left p-4 font-medium text-foreground">Power</th>
              <th className="text-left p-4 font-medium text-foreground">Status</th>
              <th className="text-left p-4 font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sites.map((site) => (
              <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                {/* Site Info */}
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-foreground">{site.name}</h4>
                        {site.is_default && (
                          <BadgeCheck className="h-4 w-4 text-primary" title="Default Site" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {site.site_code}
                      </p>
                      {site.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {site.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Site Type */}
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSiteTypeColor(site.site_type)}`}>
                    {site.site_type}
                  </span>
                </td>

                {/* Location */}
                <td className="p-4">
                  <div className="space-y-1">
                    {site.address_line1 && (
                      <p className="text-sm text-foreground">{site.address_line1}</p>
                    )}
                    {site.address_line2 && (
                      <p className="text-sm text-muted-foreground">{site.address_line2}</p>
                    )}
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      {site.city && <span>{site.city}</span>}
                      {site.state && <span>, {site.state}</span>}
                      {site.postal_code && <span>{site.postal_code}</span>}
                    </div>
                    {site.country && (
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span>{site.country}</span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Hub status */}
                <td className="p-4">
                  {site.hub_site_status ? (
                    <span className="text-xs text-muted-foreground">
                      {site.hub_site_status}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>

                {/* AOM */}
                <td className="p-4">
                  {site.aom ? (
                    <span className="text-xs text-muted-foreground">
                      {site.aom}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>

                {/* Technician / FSE & contact */}
                <td className="p-4">
                  <div className="space-y-1">
                    {(site.technician_employee_name || site.contact_person) && (
                      <div className="flex items-center space-x-1 text-sm text-foreground">
                        <User className="h-3 w-3" />
                        <span>{site.technician_employee_name || site.contact_person}</span>
                      </div>
                    )}
                    {site.phone && (
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{site.phone}</span>
                      </div>
                    )}
                    {(site.fse_employee_name || site.fse_employee_code) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <div className="font-semibold">FSE</div>
                        {site.fse_employee_name && <div>{site.fse_employee_name}</div>}
                        {site.fse_employee_code && (
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3" />
                            <span>{site.fse_employee_code}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {site.email && (
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{site.email}</span>
                      </div>
                    )}
                  </div>
                </td>

                {/* Power configuration */}
                <td className="p-4">
                  {site.power_type || site.dg_make || site.dg_rating || site.solar_type ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {site.power_type && (
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold">Type:</span>
                          <span>{site.power_type}</span>
                        </div>
                      )}
                      {(site.dg_make || site.dg_rating) && (
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold">DG:</span>
                          <span>{[site.dg_make, site.dg_rating].filter(Boolean).join(' • ')}</span>
                        </div>
                      )}
                      {site.solar_type && (
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold">Solar/HPSC:</span>
                          <span>{site.solar_type}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not configured</span>
                  )}
                </td>

                {/* Status */}
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(site.status)}`}>
                    {site.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onEdit(site)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit site"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSettings(site)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Site settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SiteList;

