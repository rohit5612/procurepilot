import React, { useEffect, useMemo, useState } from 'react';
import { inventoryAPI } from '../../utils/api';
import { Users, Search, Phone, Mail } from 'lucide-react';

const EmployeeSelectModal = ({ open, onClose, onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await inventoryAPI.getEmployees();
        if (!res.ok) {
          const js = await res.json().catch(() => ({}));
          throw new Error(js.message || 'Failed to load employees');
        }
        const js = await res.json();
        setEmployees(Array.isArray(js.data) ? js.data : []);
      } catch (e) {
        console.error('Failed to load employees for modal:', e);
        setError(e.message || 'Failed to load employees');
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = (e.full_name || `${e.first_name || ''} ${e.last_name || ''}`).toLowerCase();
      const code = (e.employee_code || '').toLowerCase();
      const dept = (e.department || e.department_name || '').toLowerCase();
      const loc = (e.location || e.location_name || '').toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        dept.includes(q) ||
        loc.includes(q)
      );
    });
  }, [employees, search]);

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
      <div className="card w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col m-4">
        <div className="card-header flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-fg">Select Employee</h3>
                <p className="text-xs text-muted">Search by code, name, department or location</p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="input pl-9 w-full"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto card-body">
          {error && <div className="alert alert-danger mb-3">{error}</div>}
          {loading ? (
            <div className="text-muted">Loading employees…</div>
          ) : (
            <div className="space-y-1">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted text-sm">
                  No employees found matching current search.
                </div>
              ) : (
                paginated.map((e) => {
                  const name = e.full_name || `${e.first_name || ''} ${e.last_name || ''}`;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="w-full text-left card hover-bg-muted transition-colors"
                      onClick={() => {
                        onSelect &&
                          onSelect({
                            id: e.id,
                            employee_code: e.employee_code,
                            name,
                            phone: e.phone || '',
                            department: e.department || e.department_name || '',
                            location: e.location || e.location_name || ''
                          });
                        onClose && onClose();
                      }}
                    >
                      <div className="card-body py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-fg">{name}</span>
                              {e.employee_code && (
                                <span className="font-mono text-xs text-muted bg-muted px-2 py-0.5 rounded">
                                  {e.employee_code}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted mt-1">
                              {e.designation || e.designation_name || '-'}
                              {(e.department || e.department_name) &&
                                ` • ${e.department || e.department_name}`}
                              {(e.location || e.location_name) &&
                                ` • ${e.location || e.location_name}`}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                            {e.phone && (
                              <span className="inline-flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {e.phone}
                              </span>
                            )}
                            {e.email && (
                              <span className="inline-flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {e.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
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
                  <span className="font-medium">{totalItems}</span> employees
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

export default EmployeeSelectModal;

