import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, MapPin, Building2, Globe, Phone, Mail, User, X, CheckCircle, AlertTriangle, Power, PowerOff, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryAPI } from '../../utils/api';
import SiteForm from '../../components/inventory/SiteForm';
import SiteList from '../../components/inventory/SiteList';
import SiteStats from '../../components/inventory/SiteStats';

const SiteManagementPage = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Fetch sites on component mount
  useEffect(() => {
    if (user) {
      fetchSites();
    }
  }, [user]);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await inventoryAPI.getSites();
      
      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }

      const data = await response.json();
      setSites(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (siteData) => {
    try {
      const response = await inventoryAPI.createSite(siteData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create site');
      }

      setSuccessMessage('Site created successfully');
      await fetchSites();
      setShowForm(false);
      setEditingSite(null);
    } catch (err) {
      console.error('Error creating site:', err);
      setError(err.message);
    }
  };

  const handleUpdateSite = async (siteId, siteData) => {
    try {
      const response = await inventoryAPI.updateSite(siteId, siteData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update site');
      }

      setSuccessMessage('Site updated successfully');
      await fetchSites();
      setShowForm(false);
      setEditingSite(null);
    } catch (err) {
      console.error('Error updating site:', err);
      setError(err.message);
    }
  };

  const handleDeleteSite = async () => {
    if (!selectedSite) return;

    // Show confirmation dialog for hard delete
    if (!window.confirm('⚠️ WARNING: This will permanently delete this site from the database. This action cannot be undone. Are you sure you want to proceed?')) return;

    try {
      const response = await inventoryAPI.deleteSite(selectedSite.id, true); // hardDelete = true

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete site');
      }

      setSuccessMessage('Site permanently deleted successfully');
      await fetchSites();
      setShowSettingsModal(false);
      setSelectedSite(null);
    } catch (err) {
      console.error('Error deleting site:', err);
      setError(err.message);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedSite) return;

    const newStatus = selectedSite.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${action} this site?`)) return;
    
    try {
      const response = await inventoryAPI.toggleSiteStatus(selectedSite.id, newStatus);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} site`);
      }

      setSuccessMessage(`Site ${action}d successfully`);
      await fetchSites();
      setShowSettingsModal(false);
      setSelectedSite(null);
    } catch (err) {
      console.error(`Error ${action}ing site:`, err);
      setError(err.message);
    }
  };

  const handleEditSite = (site) => {
    setEditingSite(site);
    setShowForm(true);
  };

  const handleSettings = (site) => {
    setSelectedSite(site);
    setShowSettingsModal(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSite(null);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus]);

  // Filter sites based on search and filters
  const filteredSites = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sites.filter(site => {
      const haystack = [
        site.name,
        site.site_code,
        site.city,
        site.state,
        site.country,
        site.address_line1,
        site.address_line2,
        site.hub_site_status,
        site.aom,
        site.technician_employee_name,
        site.contact_person,
        site.fse_employee_name,
        site.fse_employee_code,
        site.power_type,
        site.dg_make,
        site.dg_rating,
        site.solar_type
      ]
        .filter(Boolean)
        .map(v => String(v).toLowerCase());

      const matchesSearch = term === '' || haystack.some(v => v.includes(term));
      const matchesType = filterType === 'all' || site.site_type === filterType;
      const matchesStatus = filterStatus === 'all' || site.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [sites, searchTerm, filterType, filterStatus]);

  const totalItems = filteredSites.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedSites = useMemo(
    () => filteredSites.slice(startIndex, endIndex),
    [filteredSites, startIndex, endIndex]
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access Site Master.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Site Master</h1>
                <p className="text-muted-foreground">Manage company sites and locations</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Site</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 py-6">
        <SiteStats sites={filteredSites} />
      </div>

      {/* Search and Filters */}
      <div className="container mx-auto px-4 pb-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by site, code, technician, FSE, location, power..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="select"
              >
                <option value="all">All Types</option>
                <option value="OFFICE">Office</option>
                <option value="INDUS">Indus</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="select"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Page size */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 25)}
                className="select"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sites List */}
      <div className="container mx-auto px-4 pb-6">
        <SiteList
          sites={paginatedSites}
          onEdit={handleEditSite}
          onSettings={handleSettings}
          loading={loading}
        />

        {/* Pagination controls */}
        {totalItems > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing <span className="font-medium">{startIndex + 1}</span>–
              <span className="font-medium">{
                endIndex
              }</span> of <span className="font-medium">{totalItems}</span> sites
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPageSafe === 1}
              >
                Previous
              </button>
              <span>
                Page <span className="font-medium">{currentPageSafe}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </span>
              <button
                className="btn btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPageSafe === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 50 }}>
          <div className="card" style={{ borderColor: 'var(--color-chart-2)' }}>
            <div className="card-body" style={{ display: 'flex' }}>
              <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-chart-2)', marginRight: '0.75rem' }} />
              <div>
                <p className="text-fg" style={{ fontSize: '0.875rem' }}>{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="btn"
                style={{ marginLeft: '1rem', padding: '0.25rem' }}
              >
                <X style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Site Form Modal */}
      {showForm && (
        <SiteForm
          site={editingSite}
          onSubmit={editingSite ? handleUpdateSite : handleCreateSite}
          onClose={handleCloseForm}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 lg:w-1/4 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Site Settings
                </h3>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedSite(null);
                  }}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-fg mb-2">Site Details</h4>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-fg font-medium">{selectedSite.name}</div>
                  <div className="text-sm text-muted">{selectedSite.site_code}</div>
                  <div className="text-sm text-muted mt-1">
                    Status: <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      selectedSite.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        selectedSite.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {selectedSite.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleToggleStatus}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSite.status === 'ACTIVE' 
                      ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' 
                      : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                  }`}
                >
                  {selectedSite.status === 'ACTIVE' ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Deactivate Site
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate Site
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleDeleteSite}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Site
                </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-default">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedSite(null);
                  }}
                  className="w-full px-4 py-2 border border-default rounded-md text-fg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteManagementPage;
