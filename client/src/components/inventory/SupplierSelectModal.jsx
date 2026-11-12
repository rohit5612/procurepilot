import React, { useEffect, useMemo, useState } from 'react';
import { procurementAPI, circleAPI, clusterAPI } from '../../utils/api';

const SupplierSelectModal = ({ open, onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [search, setSearch] = useState('');
  const [circleId, setCircleId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [sRes, cRes, clRes] = await Promise.all([
          procurementAPI.getSuppliers('limit=500'),
          circleAPI.getAll(),
          clusterAPI.getAll()
        ]);
        const sJson = await sRes.json();
        const cJson = await cRes.json();
        const clJson = await clRes.json();
        if (!sRes.ok) throw new Error(sJson.message || 'Failed to load suppliers');
        setSuppliers(sJson.data || sJson.suppliers || []);
        setCircles(cJson.data || []);
        setClusters(clJson.data || []);
      } catch (e) {
        console.error('Failed to load suppliers for modal:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, circleId, clusterId]);

  const filtered = useMemo(() => {
    const term = (search || '').toLowerCase();
    return (suppliers || []).filter((s) => {
      if (circleId && String(s.circle_id || '') !== String(circleId)) return false;
      if (clusterId && String(s.cluster_id || '') !== String(clusterId)) return false;
      if (!term) return true;
      return [s.supplier_code, s.name, s.legal_name, s.phone, s.email]
        .some((v) => (String(v || '')).toLowerCase().includes(term));
    });
  }, [suppliers, search, circleId, clusterId]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginated = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        <div className="card-header flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-fg">Select Supplier</h3>
              <p className="text-sm text-muted">Search suppliers by code, name, circle, or cluster</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <input
              className="input md:col-span-2"
              placeholder="Search by name, code, phone, email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="input" value={circleId} onChange={(e) => setCircleId(e.target.value)}>
              <option value="">All Circles</option>
              {(circles || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
            >
              <option value="">All Clusters</option>
              {(clusters || [])
                .filter((c) => !circleId || String(c.circle_id) === String(circleId))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto card-body">
          {error && <div className="alert alert-danger mb-3">{error}</div>}
          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted">No suppliers found</div>
              ) : (
                paginated.map((s) => (
                  <div
                    key={s.id}
                    className="card hover-bg-muted cursor-pointer"
                    onClick={() => {
                      onSelect &&
                        onSelect({
                          vendor_id: s.id,
                          vendor_code: s.supplier_code,
                          vendor_name: s.name,
                          circle_name: s.circle_name,
                          cluster_name: s.cluster_name,
                          destination_address: [
                            s.address_line1,
                            s.address_line2,
                            s.city,
                            s.state,
                            s.postal_code,
                            s.country
                          ]
                            .filter(Boolean)
                            .join(', ')
                        });
                      onClose && onClose();
                    }}
                  >
                    <div className="card-body">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-7">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-fg text-base">{s.name}</div>
                            <span className="font-mono text-xs bg-gray-100 rounded px-2 py-0.5">
                              {s.supplier_code}
                            </span>
                          </div>
                          <div className="text-sm text-muted mt-1">
                            {[s.address_line1, s.city, s.state].filter(Boolean).join(', ')}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {s.circle_name || ''}
                            {s.cluster_name ? ` • ${s.cluster_name}` : ''}
                          </div>
                        </div>
                        <div className="col-span-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted text-xs">Phone:</span>
                            <span className="text-fg">{s.phone || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-muted text-xs">Email:</span>
                            <span className="text-fg">{s.email || '-'}</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-end">
                          <div className="btn btn-primary btn-sm">Select</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="card-header bg-muted flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {totalItems > 0 && (
                <>
                  Showing <span className="font-medium">{startIndex + 1}</span>–
                  <span className="font-medium">{endIndex}</span> of{' '}
                  <span className="font-medium">{totalItems}</span> suppliers
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs">Rows</span>
                <select
                  className="input input-sm w-20"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 25)}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPageSafe === totalPages}
                >
                  Next
                </button>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierSelectModal;
