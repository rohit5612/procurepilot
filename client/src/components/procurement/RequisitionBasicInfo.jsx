import React, { useMemo, useState } from 'react';
import { Building, MapPin, FolderOpen, Calendar, FileText, Radio, Search } from 'lucide-react';
import CircleSelector from '../common/CircleSelector';
import ClusterSelector from '../common/ClusterSelector';
import { useAuth } from '../../contexts/AuthContext';
import SiteSelectModal from '../inventory/SiteSelectModal';

const RequisitionBasicInfo = ({ formData, departments, sites, handleInputChange }) => {
  const { user } = useAuth();
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  
  // Check if user can change department (only superadmin and admin)
  const canChangeDepartment = user?.isSuperuser || user?.roleLevel <= 1;
  const handleCircleChange = (value) => {
    handleInputChange({ target: { name: 'circle_id', value } });
    // Reset cluster when circle changes
    if (formData.cluster_id) {
      handleInputChange({ target: { name: 'cluster_id', value: null } });
    }
  };

  const handleClusterChange = (value) => {
    handleInputChange({ target: { name: 'cluster_id', value } });
  };

  const selectedSite = useMemo(() => {
    if (!formData.site_id) return null;
    const allSites = Array.isArray(sites) ? sites : [];
    return allSites.find(s => String(s.id) === String(formData.site_id)) || null;
  }, [sites, formData.site_id]);

  const selectedSiteLabel = selectedSite
    ? `${selectedSite.name} (${selectedSite.site_code})`
    : '';
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <FileText size={20} />
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="input"
              placeholder="Enter requisition title"
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Department *
            </label>
            <div className="relative">
              <Building size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleInputChange}
                required
                disabled={!canChangeDepartment}
                className={`input pl-10 ${!canChangeDepartment ? 'bg-secondary/10 cursor-not-allowed' : ''}`}
                title={!canChangeDepartment ? 'Department is auto-selected based on your profile' : ''}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.display_name || dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Site
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  name="site_display"
                  value={selectedSiteLabel}
                  readOnly
                  className="input pl-10"
                  placeholder="Search and select site"
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm whitespace-nowrap"
                onClick={() => setSiteModalOpen(true)}
              >
                <Search size={14} className="mr-1" />
                Search
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Project Number
            </label>
            <div className="relative">
              <FolderOpen size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
              <input
                type="text"
                name="project_id"
                value={formData.project_id}
                onChange={handleInputChange}
                className="input pl-10"
                placeholder="Enter project number (optional)"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Needed By Date
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
              <input
                type="date"
                name="needed_by_date"
                value={formData.needed_by_date}
                onChange={handleInputChange}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              <Radio size={16} className="inline mr-2" />
              Telecom Circle *
            </label>
            <CircleSelector
              value={formData.circle_id}
              onChange={handleCircleChange}
              className="w-full"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Radio size={16} className="inline mr-2" />
              Cluster *
            </label>
            <ClusterSelector
              value={formData.cluster_id}
              onChange={handleClusterChange}
              circleId={formData.circle_id}
              className="w-full"
              required
            />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="input"
              placeholder="Enter description (optional)"
            />
          </div>
        </div>
      </div>
      <SiteSelectModal
        open={siteModalOpen}
        onClose={() => setSiteModalOpen(false)}
        onSelect={(s) => {
          // Update site id, and optionally circle/cluster based on selected site
          handleInputChange({
            target: {
              name: 'site_id',
              value: s?.site_id ? String(s.site_id) : ''
            }
          });

          if (s?.circle_id) {
            handleCircleChange(String(s.circle_id));
          }

          if (s?.cluster_id) {
            handleClusterChange(String(s.cluster_id));
          }
        }}
      />
    </div>
  );
};

export default RequisitionBasicInfo;
