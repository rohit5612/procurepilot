import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileText,
  Calendar,
  IndianRupee,
  User,
  Building,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { requisitionAPI } from '../../utils/api';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import RequisitionList from '../../components/procurement/RequisitionList';
import RequisitionStats from '../../components/procurement/RequisitionStats';
import RequisitionFilters from '../../components/procurement/RequisitionFilters';
import PageToolbar from '../../components/layout/PageToolbar';

const RequisitionManagementPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { add } = useToastContext() || { add: () => {} };
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    search: '',
    department_id: '',
    circle_id: '',
    cluster_id: ''
  });
  const [pagination, setPagination] = useState({});
  const [approvableIds, setApprovableIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  // Fetch requisitions
  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: filters.page,
        limit: filters.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.department_id && { department_id: filters.department_id }),
        ...(filters.circle_id && { circle_id: filters.circle_id }),
        ...(filters.cluster_id && { cluster_id: filters.cluster_id })
      });

      const response = await requisitionAPI.getRequisitions(params.toString());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch requisitions');
      }

      const data = await response.json();
      const list = data.data.requisitions || [];
      setRequisitions(list);
      setPagination(data.data.pagination || {});
      if (hasPermission('procurement.purchase_requisition.approve')) {
        setApprovableIds(new Set(list.filter((r) => r.status === 'pending_approval').map((r) => r.id)));
      } else {
        setApprovableIds(new Set());
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await requisitionAPI.getRequisitionStats();

      if (response.ok) {
        const data = await response.json();
        setStats(data.data || {});
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Handle requisition actions
  const handleRequisitionAction = async (action, requisitionId, data = {}) => {
    try {
      let response;

      switch (action) {
        case 'submit':
          response = await requisitionAPI.submitRequisition(requisitionId);
          break;
        case 'approve':
          response = await requisitionAPI.approveRequisition(requisitionId, data);
          break;
        case 'reject':
          response = await requisitionAPI.rejectRequisition(requisitionId, data);
          break;
        case 'withdraw':
          response = await requisitionAPI.withdrawRequisition(requisitionId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Action failed');
      }

      // Refresh the list
      await fetchRequisitions();
      await fetchStats();
      if (action === 'submit') add('Requisition submitted', 'success');
      if (action === 'approve') add('Requisition approved', 'success');
      if (action === 'reject') add('Requisition rejected', 'error');
      if (action === 'withdraw') add('Requisition withdrawn', 'success');
    } catch (err) {
      setError(err.message);
      add(err.message || 'Action failed', 'error');
      console.error(`Error performing ${action}:`, err);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    await Promise.all([fetchRequisitions(), fetchStats()]);
  };

  // Export CSV using current filters (ignores pagination, exports all matching rows up to server limit)
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.department_id && { department_id: filters.department_id }),
        ...(filters.circle_id && { circle_id: filters.circle_id }),
        ...(filters.cluster_id && { cluster_id: filters.cluster_id })
      });

      const response = await requisitionAPI.exportRequisitions(params.toString());
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to export requisitions');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `purchase-requisitions-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      add('Export started – CSV downloaded', 'success');
    } catch (e) {
      console.error('Export CSV error:', e);
      add(e.message || 'Failed to export requisitions', 'error');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
    fetchStats();
  }, [filters]);

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2 text-danger mb-4">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold">Error Loading Requisitions</h2>
          </div>
          <p className="text-muted mb-4">{error}</p>
          <button 
            onClick={handleRefresh}
            className="btn btn-primary"
          >
            <RefreshCw size={16} className="mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar description="Manage and track purchase requisitions">
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="btn btn-secondary"
        >
          <Download size={16} className="mr-2" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
        <Link to="/procurement/pr/create-requisition" className="btn btn-primary">
          <Plus size={16} className="mr-2" />
          Create Requisition
        </Link>
      </PageToolbar>

      {/* Statistics Cards */}
      <RequisitionStats stats={stats} />

      {/* Filters */}
      <RequisitionFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
      />

      {/* Requisitions List */}
      <RequisitionList
        requisitions={requisitions}
        loading={loading}
        onAction={handleRequisitionAction}
        pagination={pagination}
        onPageChange={handlePageChange}
        approvableIds={approvableIds}
        canApproveAtAll={user?.isSuperuser || Number(user?.roleLevel) <= 1 || hasPermission('procurement.purchase_requisition.approve')}
      />
    </div>
  );
};

export default RequisitionManagementPage;
