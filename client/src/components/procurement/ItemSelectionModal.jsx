import React, { useState, useEffect } from 'react';
import { X, Search, Package, IndianRupee, ChevronLeft, ChevronRight } from 'lucide-react';

const ItemSelectionModal = ({ 
  showModal, 
  setShowModal, 
  items, 
  itemSearchTerm, 
  setItemSearchTerm, 
  selectItem 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemSearchTerm]);

  if (!showModal) return null;

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Fixed Header */}
        <div className="card-header flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-fg">Select Item from Master</h3>
              <p className="text-sm text-muted">
                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, items.length)} of {items.length} items
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="btn btn-secondary btn-sm"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="relative mt-4">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search items by name, code, company code, manufacturer, HSN, spare type..."
              value={itemSearchTerm}
              onChange={(e) => setItemSearchTerm(e.target.value)}
              className="input pl-10 w-full"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto card-body">
          <div className="space-y-3">
            {currentItems.length === 0 ? (
              <div className="text-center py-12">
                <Package size={48} className="text-muted mx-auto" />
                <p className="text-muted mt-4">No items found matching your search.</p>
              </div>
            ) : (
              currentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className="card hover-bg-muted cursor-pointer transition-all"
                >
                  <div className="card-body">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      {/* Item Info - 7 cols */}
                      <div className="col-span-7">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-fg text-base">{item.name}</div>
                          {item.manufacturer && (
                            <span className="badge badge-info">
                              {item.manufacturer}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2">
                          <span className="font-mono font-medium">{item.item_code}</span>
                          {item.company_code && (
                            <span className="text-xs bg-gray-100 rounded" style={{padding: '0.125rem 0.5rem'}}>{item.company_code}</span>
                          )}
                          {item.hsn_code && (
                            <span className="text-xs">HSN: {item.hsn_code}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {item.spare_type && (
                            <span className="badge" style={{backgroundColor: '#f3e8ff', color: '#7c3aed'}}>
                              {item.spare_type}
                            </span>
                          )}
                          {item.sub_category && (
                            <span className="badge" style={{backgroundColor: '#ffedd5', color: '#c2410c'}}>
                              {item.sub_category}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pricing & UOM - 3 cols */}
                      <div className="col-span-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted text-xs">UOM:</span>
                          <span className="font-medium text-fg">{item.unit_of_measure}</span>
                        </div>
                        {item.gst_rate > 0 && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-muted text-xs">GST:</span>
                            <span className="text-fg">{item.gst_rate}%</span>
                          </div>
                        )}
                        {item.estimated_price > 0 && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-muted text-xs">Price:</span>
                            <span className="font-semibold text-primary flex items-center gap-1">
                              <IndianRupee size={14} />
                              {item.estimated_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {item.standard_cost > 0 && item.estimated_price === 0 && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-muted text-xs">Cost:</span>
                            <span className="text-muted flex items-center gap-1">
                              <IndianRupee size={14} />
                              {item.standard_cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
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
              Page {currentPage} of {totalPages} ({items.length} total items)
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

export default ItemSelectionModal;
