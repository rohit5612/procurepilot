import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Download } from 'lucide-react';
import { goodsReceiptAPI, inventoryAPI } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToastContext } from '../../contexts/ToastContext.jsx';

const GoodsReceiptListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [items, setItems] = useState([]);
  const { add } = useToastContext() || { add: () => {} };
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const defaultFilters = useMemo(() => ({ search: '', status: '', warehouse_id: '', date_from: '', date_to: '' }), []);
  const [filters, setFilters] = useState(() => ({ ...defaultFilters }));
  const [warehouses, setWarehouses] = useState([]);
  const statusOptions = useMemo(() => ([
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'posted', label: 'Posted' }
  ]), []);
  const [exporting, setExporting] = useState(false);

  const fetchOptions = async () => {
    try {
      const whRes = await inventoryAPI.getWarehouses();
      const whData = await whRes.json();
      if (whRes.ok && whData.success) setWarehouses(whData.data || []);
    } catch (err) {
      console.error('Failed to preload options', err);
    }
  };

  const fetchData = async (page = 1, appliedFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page,
        limit: pagination.limit,
        ...(appliedFilters.search ? { search: appliedFilters.search } : {}),
        ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
        ...(appliedFilters.warehouse_id ? { warehouse_id: appliedFilters.warehouse_id } : {}),
        ...(appliedFilters.date_from ? { created_from: appliedFilters.date_from } : {}),
        ...(appliedFilters.date_to ? { created_to: appliedFilters.date_to } : {})
      });
      const res = await goodsReceiptAPI.getGRNs(params.toString());
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch GRNs');
      setItems(data.data || []);
      setPagination(data.pagination || { page: Number(page), limit: pagination.limit, total: 0, totalPages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOptions(); }, []);

  useEffect(() => {
    fetchData(1, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    // When page size changes, reload first page with current filters
    fetchData(1, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.limit]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters({ ...defaultFilters });
  };

  const handlePost = async (id) => {
    try {
      const res = await goodsReceiptAPI.postGRN(id);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to post GRN');
      add('GRN posted', 'success');
      fetchData(pagination.page, filters);
    } catch (e) {
      add(e.message || 'Failed to post GRN', 'error');
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg">Goods Receipt Notes</h1>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exporting}
            onClick={async () => {
              try {
                setExporting(true);
                const params = new URLSearchParams({
                  ...(filters.search ? { search: filters.search } : {}),
                  ...(filters.status ? { status: filters.status } : {}),
                  ...(filters.warehouse_id ? { warehouse_id: filters.warehouse_id } : {}),
                  ...(filters.date_from ? { created_from: filters.date_from } : {}),
                  ...(filters.date_to ? { created_to: filters.date_to } : {})
                });
                const res = await goodsReceiptAPI.exportGRNs(params.toString());
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || 'Failed to export GRNs');
                }
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                const ts = new Date().toISOString().slice(0, 10);
                a.href = url;
                a.download = `goods-receipts-${ts}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                add('Export started – CSV downloaded', 'success');
              } catch (e) {
                console.error('Export GRN error:', e);
                add(e.message || 'Failed to export GRNs', 'error');
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={16} className="mr-2" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => navigate('/procurement/grn/create-grn')} className="btn btn-primary">
            Create GRN
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="space-y-4">
            <div>
              <label className="form-label">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input pr-8"
                  placeholder="Search GRN number, PO number/title, supplier..."
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('search', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="col-span-1">
              <label className="form-label">Status</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              </div>
              <div className="col-span-1">
              <label className="form-label">Warehouse</label>
              <select
                className="input"
                value={filters.warehouse_id}
                onChange={(e) => handleFilterChange('warehouse_id', e.target.value)}
              >
                <option value="">All warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
              </div>
              <div className="col-span-1">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="input"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
              </div>
              <div className="col-span-1">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="input"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
              />
              </div>
              <div className="col-span-1">
              <label className="form-label">Items per page</label>
              <select
                className="input"
                value={pagination.limit}
                onChange={(e) => setPagination((p) => ({ ...p, page: 1, limit: Number(e.target.value) }))}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              </div>
              <div className="flex items-end">
                <button type="button" className="btn btn-secondary w-full" onClick={resetFilters}>
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
          ) : error ? (
            <div className="text-danger">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-muted text-center py-8">No GRNs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">GRN</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Purchase Order</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Warehouse</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(grn => (
                    <tr key={grn.id}>
                      <td className="px-4 py-3 font-medium text-fg">{grn.grn_number}</td>
                      <td className="px-4 py-3">
                        {grn.po_number ? (
                          <div className="space-y-1">
                            <div className="font-medium text-fg">{grn.po_number}</div>
                            {grn.po_title && <div className="text-sm text-muted-foreground truncate max-w-xs">{grn.po_title}</div>}
                            {grn.purchase_order_id && (
                              <div>
                                <Link to={`/procurement/po/po-details/${grn.purchase_order_id}`} className="btn btn-secondary btn-sm">View PO</Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{grn.warehouse_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${grn.status === 'posted' ? 'badge-success' : 'badge-info'}`}>{grn.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-sm">
                          <span>{new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(grn.created_at))}</span>
                          <span className="text-muted-foreground text-xs">{new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(grn.created_at))}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {grn.status === 'draft' && hasPermission('procurement.goods_receipt.submit') && (
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/procurement/grn/grn-details/${grn.id}`)}>Submit</button>
                        )}
                        {grn.status === 'approved' && hasPermission('procurement.goods_receipt.approve') && (
                          <button className="btn btn-primary btn-sm" onClick={() => handlePost(grn.id)}>Post</button>
                        )}
                        <Link to={`/procurement/grn/grn-details/${grn.id}`} className="btn btn-secondary btn-sm">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-default flex items-center justify-between">
          <div className="text-muted text-sm">
            Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} total
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchData(pagination.page - 1, filters)}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchData(pagination.page + 1, filters)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptListPage;


