import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageToolbar from '../../components/layout/PageToolbar';
import { purchaseOrderAPI, circleAPI, clusterAPI } from '../../utils/api';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { Plus, RefreshCw, AlertTriangle, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { approvePurchaseOrderTask, rejectPurchaseOrderTask } from '../../utils/procurementApproval';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';

const PurchaseOrderManagementPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const { add } = useToastContext() || { add: () => {} };
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [approvableIds, setApprovableIds] = useState(new Set());
  const { open } = useDialog() || { open: () => {} };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [filters, setFilters] = useState({ 
    status: '', 
    search: '', 
    receiving: '',
    circle_id: '',
    cluster_id: ''
  });
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [exporting, setExporting] = useState(false);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.receiving) params.set('receiving', filters.receiving);
      if (filters.circle_id) params.set('circle_id', filters.circle_id);
      if (filters.cluster_id) params.set('cluster_id', filters.cluster_id);
      const res = await purchaseOrderAPI.getPOs(params.toString());
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to fetch purchase orders');
      }
      const data = await res.json();
      const list = data.data || [];
      setItems(list);
      setPagination(p => ({ ...p, ...(data.pagination || {}) }));
      if (hasPermission('procurement.purchase_order.approve')) {
        setApprovableIds(new Set(list.filter((po) => po.status === 'pending_approval').map((po) => po.id)));
      } else {
        setApprovableIds(new Set());
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.receiving) params.set('receiving', filters.receiving);
      if (filters.circle_id) params.set('circle_id', filters.circle_id);
      if (filters.cluster_id) params.set('cluster_id', filters.cluster_id);
      const res = await purchaseOrderAPI.exportPOs(params.toString());
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to export purchase orders');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `purchase-orders-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      add('Export started – CSV downloaded', 'success');
    } catch (e) {
      console.error('PO export error:', e);
      add(e.message || 'Failed to export purchase orders', 'error');
    } finally {
      setExporting(false);
    }
  };

  const fetchCircles = async () => {
    try {
      const response = await circleAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch circles:', e);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await clusterAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setClusters(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch clusters:', e);
    }
  };

  const handleClearFilters = () => {
    setFilters({ 
      status: '', 
      search: '', 
      receiving: '',
      circle_id: '',
      cluster_id: ''
    });
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleAction = async (action, id) => {
    try {
      let res;
      if (action === 'submit') res = await purchaseOrderAPI.submitPO(id);
      else if (action === 'issue') res = await purchaseOrderAPI.issuePO(id);
      else return;
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Action failed');
      }
      if (action === 'issue') {
        add('Purchase Order issued', 'success');
        navigate(`/procurement/po/po-details/${id}`, { state: { showPoPrintPreview: true } });
        return;
      }
      await fetchPOs();
      if (action === 'submit') add('Purchase Order submitted', 'success');
    } catch (e) {
      setError(e.message);
      add(e.message || 'Action failed', 'error');
    }
  };

  useEffect(() => {
    fetchCircles();
    fetchClusters();
  }, []);

  useEffect(() => { fetchPOs(); }, [filters, pagination.page, pagination.limit]);

  return (
    <div className="space-y-6">
      <PageToolbar description="Manage and track purchase orders">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportCsv}
          disabled={exporting}
        >
          <Download size={16} className="mr-2" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
        <Link to="/procurement/po/generate-from-pr" className="btn btn-secondary">
          Generate from PR
        </Link>
        <Link to="/procurement/po/create-po" className="btn btn-primary">
          <Plus size={16} className="mr-2" />
          Create PO
        </Link>
        <button type="button" className="btn btn-secondary" onClick={fetchPOs}>
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </button>
      </PageToolbar>

      {error && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <label className="form-label">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by PO number or title..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, search: e.target.value }));
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="input pr-8"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(f => ({ ...f, search: '' }));
                      setPagination(p => ({ ...p, page: 1 }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="form-label">Status</label>
        <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, status: e.target.value }));
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="input"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="issued">Issued</option>
                  <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              <div>
                <label className="form-label">Receiving</label>
                <select
                  value={filters.receiving}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, receiving: e.target.value }));
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="input"
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="form-label">Circle</label>
                <select
                  value={filters.circle_id}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, circle_id: e.target.value }));
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="input"
                >
                  <option value="">All Circles</option>
                  {circles.map(circle => (
                    <option key={circle.id} value={circle.id}>
                      {circle.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Cluster</label>
                <select
                  value={filters.cluster_id}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, cluster_id: e.target.value }));
                    setPagination(p => ({ ...p, page: 1 }));
                  }}
                  className="input"
                >
                  <option value="">All Clusters</option>
                  {clusters.map(cluster => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button type="button" onClick={handleClearFilters} className="btn btn-secondary w-full">
                  <X size={16} className="mr-2" />
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="animate-pulse h-24 bg-muted rounded" />
          ) : items.length === 0 ? (
            <div className="text-muted">No purchase orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">PO Number</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Created On</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Receiving</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Supplier</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(po => (
                    <tr key={po.id}>
                      <td className="px-4 py-3 font-mono text-sm">{po.po_number}</td>
                      <td className="px-4 py-3">{po.title}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(po.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                          po?.status === 'draft' ? 'bg-gray-100 text-gray-700' : 
                          po?.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' : 
                          po?.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          po?.status === 'issued' ? 'bg-blue-100 text-blue-800' : 
                          po?.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          po?.status === 'withdrawn' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(po?.status || '-').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                            po?.receiving_phase === 'closed' ? 'bg-slate-100 text-slate-700' : 
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {(po?.receiving_phase || 'open').charAt(0).toUpperCase() + (po?.receiving_phase || 'open').slice(1)}
                          </span>
                          {typeof po.received_quantity !== 'undefined' && typeof po.total_quantity !== 'undefined' && (
                            <span className="text-xs text-muted-foreground font-medium">{Number(po.received_quantity)}/{Number(po.total_quantity)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{po.supplier_name || '-'}</td>
                      <td className="px-4 py-3 font-semibold">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {po.status === 'draft' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleAction('submit', po.id)}>Submit</button>
                        )}
                        {(po.status === 'submitted' || po.status === 'pending_approval') && (user?.isSuperuser || Number(user?.roleLevel) <= 1 || hasPermission('procurement.purchase_order.approve')) && approvableIds.has(po.id) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={async () => {
                                try {
                                  await approvePurchaseOrderTask(
                                    { _source: 'direct', entity_id: po.id, _purchaseOrder: po },
                                    'Approved via list'
                                  );
                                  add('PO approved', 'success');
                                  open('Approved', `PO #${po.po_number || po.id} approved successfully.`);
                                  await fetchPOs();
                                } catch {
                                  add('Approve failed', 'error');
                                }
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={async () => {
                                const reason = window.prompt('Rejection reason');
                                if (!reason?.trim()) return;
                                try {
                                  await rejectPurchaseOrderTask(
                                    { _source: 'direct', entity_id: po.id, _purchaseOrder: po },
                                    reason.trim()
                                  );
                                  add('PO rejected', 'error');
                                  open('Rejected', `PO #${po.po_number || po.id} rejected.`);
                                  await fetchPOs();
                                } catch {
                                  add('Reject failed', 'error');
                                }
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {po.status === 'approved' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleAction('issue', po.id)}>Issue</button>
                        )}
                        <Link to={`/procurement/po/po-details/${po.id}`} className="btn btn-secondary btn-sm">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Pagination */}
        {!loading && items.length > 0 && pagination.totalPages > 1 && (
          <div className="card-footer flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total || items.length} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  const pageNum = pagination.page <= 3 
                    ? i + 1 
                    : pagination.page >= pagination.totalPages - 2
                    ? pagination.totalPages - 4 + i
                    : pagination.page - 2 + i;
                  
                  if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                      className={`btn btn-sm ${pagination.page === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrderManagementPage;


