import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requisitionAPI } from '../../utils/api';
import { RefreshCw, AlertTriangle, ArrowRight, Calendar, Building, IndianRupee, User } from 'lucide-react';
import { formatDate } from '../../utils/date';

const PurchaseOrderSelectPR = () => {
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ 
    page: 1, 
    limit: 20, 
    search: '',
    status: 'approved'
  });
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchApprovedPRs();
  }, [filters]);

  const fetchApprovedPRs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({ 
        page: filters.page, 
        limit: filters.limit, 
        status: 'approved',
        exclude_with_po: 'true'
      });
      
      if (filters.search) {
        params.set('search', filters.search);
      }
      
      const res = await requisitionAPI.getRequisitions(params.toString());
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to fetch approved requisitions');
      }
      
      const data = await res.json();
      setRequisitions(data.data?.requisitions || data.data || []);
      setPagination(data.data?.pagination || {});
    } catch (e) {
      setError(e.message);
      console.error('Error fetching approved PRs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPR = (pr) => {
    navigate(`/procurement/po/generate-from-pr/${pr.id}`);
  };

  const handleSearchChange = (e) => {
    setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Generate PO from Approved PR</h1>
          <p className="text-muted">Select an approved requisition to generate a purchase order</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchApprovedPRs}
          disabled={loading}
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Display */}
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

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="form-label">Search PRs</label>
              <input
                type="text"
                placeholder="Search by PR number, title, or description..."
                value={filters.search}
                onChange={handleSearchChange}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PR List */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Approved Purchase Requisitions</h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse h-20 bg-muted rounded" />
              <div className="animate-pulse h-20 bg-muted rounded" />
              <div className="animate-pulse h-20 bg-muted rounded" />
            </div>
          ) : requisitions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">No approved requisitions found.</p>
              {filters.search && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, search: '', page: 1 }))}
                  className="btn btn-secondary btn-sm mt-4"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      PR Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Requester
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Approved Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requisitions.map(pr => (
                    <tr 
                      key={pr.id} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectPR(pr)}
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-fg">
                          {pr.requisition_number}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-fg">{pr.title}</div>
                        {pr.description && (
                          <div className="text-sm text-muted mt-1 line-clamp-1">
                            {pr.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <User size={14} className="text-muted" />
                          <span>{pr.requester_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Building size={14} className="text-muted" />
                          <span>{pr.department_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <IndianRupee size={14} className="text-muted" />
                          <span className="font-medium">
                            {formatCurrency(pr.total_amount)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={14} className="text-muted" />
                          <span>{formatDate(pr.approved_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPR(pr);
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          <ArrowRight size={14} className="mr-1" />
                          Generate PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-default">
              <div className="text-sm text-muted">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderSelectPR;

