import React, { useEffect, useState } from 'react';
import { Users, Search, Phone, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryAPI } from '../../utils/api';

const EmployeeManagementPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyTechnicians, setOnlyTechnicians] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user, onlyTechnicians]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (onlyTechnicians) params.append('only_technicians', 'true');
      const res = await inventoryAPI.getEmployees(params.toString());
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || 'Failed to fetch employees');
      }
      const js = await res.json();
      setEmployees(js.data || []);
      setError(null);
    } catch (e) {
      console.error('Failed to load employees:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = employees.filter((e) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    const name = (e.full_name || `${e.first_name || ''} ${e.last_name || ''}`).toLowerCase();
    const dept = (e.department_name || '').toLowerCase();
    const loc = (e.location_name || '').toLowerCase();
    const code = (e.employee_code || '').toLowerCase();
    return code.includes(t) || name.includes(t) || dept.includes(t) || loc.includes(t);
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-fg mb-2">Authentication Required</h2>
          <p className="text-muted">Please log in to access Employee Master.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Employee Master</h1>
                <p className="text-muted-foreground">
                  Central directory of employees (read-only, powered by HR schema)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-card rounded-lg border border-border p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-1/2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code, name, department or location..."
              className="input pl-9 w-full"
            />
          </div>
          <label className="inline-flex items-center space-x-2 text-sm text-muted">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={onlyTechnicians}
              onChange={(e) => setOnlyTechnicians(e.target.checked)}
            />
            <span>Show only technicians</span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Code
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Designation
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Department
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Location
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Contact
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      No employees found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {e.employee_code}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-fg">
                          {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted">
                          {e.designation || e.designation_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted">{e.department_name || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted">{e.location_name || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {e.phone && (
                            <span className="inline-flex items-center text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 mr-1" />
                              {e.phone}
                            </span>
                          )}
                          {e.email && (
                            <span className="inline-flex items-center text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 mr-1" />
                              {e.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.work_status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : e.work_status === 'notice'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {String(e.work_status || '').toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeManagementPage;

