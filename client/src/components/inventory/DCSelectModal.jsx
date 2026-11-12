import React, { useState, useEffect } from 'react';
import { X, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { inventoryOpsAPI } from '../../utils/api';

const DCSelectModal = (props) => {
  const {
    isOpen,
    onClose,
    onSelect,
    // Backwards-compat props
    showModal,
    setShowModal
  } = props || {};
  const open = typeof isOpen !== 'undefined' ? isOpen : !!showModal;
  const handleClose = onClose || (() => { if (typeof setShowModal === 'function') setShowModal(false); });
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    if (open) {
      loadChallans();
    }
  }, [open]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const loadChallans = async () => {
    setLoading(true);
    try {
      const res = await inventoryOpsAPI.getIssues('status=posted');
      const json = await res.json();
      
      let items = [];
      if (json.success && Array.isArray(json.data)) {
        items = json.data;
      } else if (Array.isArray(json.items)) {
        items = json.items;
      } else if (Array.isArray(json)) {
        items = json;
      }

      // Filter out fully returned DCs
      const available = items.filter(dc => 
        dc.return_status !== 'fully_returned' && dc.status === 'posted'
      );
      
      setChallans(available);
    } catch (err) {
      console.error('Failed to load challans:', err);
      setChallans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (challan) => {
    onSelect && onSelect(challan);
    handleClose && handleClose();
  };

  if (!open) return null;

  // Filter by search
  const term = search.toLowerCase();
  const filteredChallans = challans.filter(dc =>
    (dc.challan_number || '').toLowerCase().includes(term) ||
    (dc.issue_number || '').toLowerCase().includes(term) ||
    (dc.site_name || '').toLowerCase().includes(term) ||
    (dc.vendor_name || '').toLowerCase().includes(term) ||
    (dc.vendor_code || '').toLowerCase().includes(term) ||
    (dc.circle_name || '').toLowerCase().includes(term) ||
    (dc.cluster_name || '').toLowerCase().includes(term)
  );

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredChallans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredChallans.length / itemsPerPage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Fixed Header */}
        <div className="card-header flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-fg">Select Delivery Challan</h3>
              <p className="text-sm text-muted">
                {loading 
                  ? 'Loading...'
                  : `Showing ${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, filteredChallans.length)} of ${filteredChallans.length} available DCs`
                }
              </p>
            </div>
            <button
              onClick={handleClose}
              className="btn btn-secondary btn-sm"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="relative mt-4">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by challan number, site, circle, cluster, supplier code/name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Challans List */}
        <div className="flex-1 overflow-y-auto card-body">
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted mt-4">Loading delivery challans...</p>
              </div>
            ) : currentItems.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="text-muted mx-auto" />
                <p className="text-muted mt-4">
                  {search ? 'No challans found matching your search.' : 'No posted delivery challans available for return.'}
                </p>
              </div>
            ) : (
              currentItems.map((challan) => (
                <div
                  key={challan.id}
                  onClick={() => handleSelect(challan)}
                  className="card hover-bg-muted cursor-pointer transition-all"
                >
                  <div className="card-body">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      {/* Challan Info - 7 cols */}
                      <div className="col-span-7">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-fg text-base">
                            {challan.challan_number || challan.issue_number}
                          </div>
                          <span className="badge badge-success">
                            Posted
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2">
                          <span className="font-medium">{challan.destination_type === 'VENDOR' ? (challan.vendor_name || challan.vendor_code || 'Vendor') : (challan.site_name || 'N/A')}</span>
                          {challan.circle_name && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded px-2 py-0.5">
                              {challan.circle_name}
                            </span>
                          )}
                          {challan.cluster_name && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded px-2 py-0.5">
                              {challan.cluster_name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
                          {challan.eway_bill_number && (
                            <span>eWay: {challan.eway_bill_number}</span>
                          )}
                          {challan.issue_date && (
                            <span>Date: {new Date(challan.issue_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Return Status - 3 cols */}
                      <div className="col-span-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted text-xs">Total Qty:</span>
                          <span className="font-medium text-fg">{challan.total_issued_qty || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-muted text-xs">Returned:</span>
                          <span className="font-medium text-fg">{challan.total_returned_qty || 0}</span>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-muted text-xs">Status:</span>
                          <span className={`badge badge-sm ${
                            challan.return_status === 'not_returned' 
                              ? 'badge-secondary' 
                              : 'badge-warning'
                          }`}>
                            {challan.return_status === 'not_returned' 
                              ? 'Not Returned' 
                              : 'Partially Returned'}
                          </span>
                        </div>
                      </div>

                      {/* Select Button - 2 cols */}
                      <div className="col-span-2 flex items-center justify-end">
                        <div className="btn btn-primary btn-sm">
                          Select
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fixed Footer with Pagination */}
        <div className="card-header bg-muted flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">
              Page {currentPage} of {totalPages || 1} ({filteredChallans.length} total DCs)
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = idx + 1;
                    } else if (currentPage <= 3) {
                      pageNum = idx + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + idx;
                    } else {
                      pageNum = currentPage - 2 + idx;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`btn btn-sm ${
                          currentPage === pageNum
                            ? 'btn-primary'
                            : 'btn-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DCSelectModal;
