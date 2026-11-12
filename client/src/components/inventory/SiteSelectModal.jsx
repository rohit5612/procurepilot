import React, { useEffect, useMemo, useState } from 'react';
import { inventoryAPI, circleAPI, clusterAPI } from '../../utils/api';

const SiteSelectModal = ({ open, onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sites, setSites] = useState([]);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true); setError(null);
        const [sitesRes, circlesRes, clustersRes] = await Promise.all([
          inventoryAPI.getSites(),
          circleAPI.getAll(),
          clusterAPI.getAll()
        ]);
        
        const sitesData = await sitesRes.json();
        const circlesData = await circlesRes.json();
        const clustersData = await clustersRes.json();
        
        if (!sitesRes.ok) throw new Error(sitesData.message || 'Failed to load sites');
        
        setSites(sitesData.data || []);
        setCircles(circlesData.data || []);
        setClusters(clustersData.data || []);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    load();
  }, [open]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    return (sites || []).filter(s => {
      if (statusFilter !== 'all' && (s.status || 'ACTIVE') !== statusFilter) return false;
      if (typeFilter !== 'all' && (s.site_type || 'OFFICE') !== typeFilter) return false;
      if (!q) return true;
      return [s.site_code, s.name, s.city, s.state].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [sites, search, statusFilter, typeFilter]);

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
              <h3 className="text-xl font-semibold text-fg">Select Site</h3>
              <p className="text-sm text-muted">Search sites by code, name, type or status</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
            <input className="input md:col-span-2" placeholder="Search site code, name, city, state" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="OFFICE">OFFICE</option>
              <option value="INDUS">INDUS</option>
              <option value="OTHER">OTHER</option>
            </select>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto card-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted">No sites found</div>
              ) : (
                paginated.map(s => (
                  <div key={s.id} className="card hover-bg-muted cursor-pointer" onClick={() => {
                    const address = [s.address_line1, s.address_line2, s.city, s.state, s.postal_code, s.country]
                      .filter(Boolean)
                      .join(', ');
                    const circle = circles.find(c => c.id === s.circle_id);
                    const cluster = clusters.find(c => c.id === s.cluster_id);
                    onSelect && onSelect({
                      site_id: s.id,
                      site_code: s.site_code,
                      site_name: s.name,
                      circle_id: s.circle_id,
                      circle_name: circle?.name || '',
                      cluster_id: s.cluster_id,
                      cluster_name: cluster?.name || '',
                      destination_address: address
                    });
                    onClose && onClose();
                  }}>
                    <div className="card-body">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-8">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-fg text-base">{s.name}</div>
                            <span className="font-mono text-xs bg-gray-100 rounded px-2 py-0.5">{s.site_code}</span>
                          </div>
                          <div className="text-sm text-muted mt-1">{[s.city, s.state].filter(Boolean).join(', ')}</div>
                          <div className="text-xs text-muted mt-1">{s.circle_name || ''}{s.cluster_name ? ` • ${s.cluster_name}` : ''}</div>
                        </div>
                        <div className="col-span-2 text-sm">
                          <div className="text-muted text-xs">Type: {s.site_type}</div>
                          <div className="text-muted text-xs mt-1">Status: {s.status}</div>
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
                  <span className="font-medium">{totalItems}</span> sites
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
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSelectModal;


