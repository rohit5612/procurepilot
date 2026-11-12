import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithPermissionRefresh } from '../../utils/permissionRefresh';
import { 
  Plus, 
  Search, 
  Filter,
  Edit, 
  Trash2, 
  Eye,
  Settings,
  MoreVertical,
  Power,
  PowerOff
} from 'lucide-react';
import PageToolbar from '../../components/layout/PageToolbar';

const ItemManagementPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    itemType: '',
    isActive: 'all'
  });
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importStats, setImportStats] = useState(null);
  const fileInputRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [formData, setFormData] = useState({
    item_code: '',
    name: '',
    description: '',
    company_code: '',
    category_id: '',
    unit_of_measure: 'PCS',
    item_type: 'STOCK',
    is_returnable: true,
    manufacturer: '',
    hsn_code: '',
    sac_code: '',
    spare_type: '',
    sub_category: '',
    rating: '',
    gst_rate: 0,
    basic_rate: 0,
    discount_percentage: 0,
    min_stock_level: 0,
    max_stock_level: 0,
    reorder_point: 0,
    standard_cost: 0,
    estimated_price: 0,
    price_currency: 'INR',
    brand: '',
    model: '',
    supplier_id: '',
    lead_time_days: 0,
    weight_kg: 0,
    dimensions_cm: { length: 0, width: 0, height: 0 }
  });

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchSuppliers();
    fetchUnitsOfMeasure();
  }, []);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);



  const fetchItems = async () => {
    try {
      setLoading(true);
      // Fetch all items by setting a high limit
      const response = await fetchWithPermissionRefresh('/api/inventory/items?limit=10000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch items');
      
      const data = await response.json();
      setItems(data.data || []); // Backend returns data.items in data.data
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetchWithPermissionRefresh('/api/inventory/item-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetchWithPermissionRefresh('/api/procurement/suppliers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const fetchUnitsOfMeasure = async () => {
    try {
      const response = await fetchWithPermissionRefresh('/api/inventory/units-of-measure', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnitsOfMeasure(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch units of measure:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingItem 
        ? `/api/inventory/items/${editingItem.id}`
        : '/api/inventory/items';
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetchWithPermissionRefresh(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save item');

      await fetchItems();
      setShowModal(false);
      setEditingItem(null);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_code: item.item_code,
      name: item.name,
      description: item.description || '',
      company_code: item.company_code || '',
      category_id: item.category_id || '',
      unit_of_measure: item.unit_of_measure,
      item_type: item.item_type,
      is_returnable: item.is_returnable !== false,
      manufacturer: item.manufacturer || '',
      hsn_code: item.hsn_code || '',
      sac_code: item.sac_code || '',
      spare_type: item.spare_type || '',
      sub_category: item.sub_category || '',
      rating: item.rating || '',
      gst_rate: item.gst_rate || 0,
      basic_rate: item.basic_rate || 0,
      discount_percentage: item.discount_percentage || 0,
      min_stock_level: item.min_stock_level || 0,
      max_stock_level: item.max_stock_level || 0,
      reorder_point: item.reorder_point || 0,
      standard_cost: item.standard_cost || 0,
      estimated_price: item.estimated_price || 0,
      price_currency: item.price_currency || 'INR',
      brand: item.brand || '',
      model: item.model || '',
      supplier_id: item.supplier_id || '',
      lead_time_days: item.lead_time_days || 0,
      weight_kg: item.weight_kg || 0,
      dimensions_cm: item.dimensions_cm || { length: 0, width: 0, height: 0 }
    });
    setShowModal(true);
  };

  const handleSettings = (item) => {
    setSelectedItem(item);
    setShowSettingsModal(true);
  };



  const handleDelete = async (itemId) => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete this item from the database. This action cannot be undone. Are you sure you want to proceed?')) return;
    
    try {
      const response = await fetchWithPermissionRefresh(`/api/inventory/items/${itemId}?hardDelete=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete item');

      await fetchItems();
      setShowSettingsModal(false);
      setSelectedItem(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (itemId, currentStatus) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${action} this item?`)) return;
    
    try {
      const response = await fetchWithPermissionRefresh(`/api/inventory/items/${itemId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: newStatus })
      });

      if (!response.ok) throw new Error(`Failed to ${action} item`);

      await fetchItems();
      setShowSettingsModal(false);
      setSelectedItem(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      item_code: '',
      name: '',
      description: '',
      company_code: '',
      category_id: '',
      unit_of_measure: 'PCS',
      item_type: 'STOCK',
      is_returnable: true,
      manufacturer: '',
      hsn_code: '',
      sac_code: '',
      spare_type: '',
      sub_category: '',
      rating: '',
      gst_rate: 0,
      basic_rate: 0,
      discount_percentage: 0,
      min_stock_level: 0,
      max_stock_level: 0,
      reorder_point: 0,
      standard_cost: 0,
      estimated_price: 0,
      price_currency: 'INR',
      brand: '',
      model: '',
      supplier_id: '',
      lead_time_days: 0,
      weight_kg: 0,
      dimensions_cm: { length: 0, width: 0, height: 0 }
    });
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.company_code && item.company_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !filters.category || item.category_id === parseInt(filters.category);
    const matchesType = !filters.itemType || item.item_type === filters.itemType;
    const matchesActive = filters.isActive === 'all' || 
                         (filters.isActive === 'active' && item.is_active) ||
                         (filters.isActive === 'inactive' && !item.is_active);
    
    return matchesSearch && matchesCategory && matchesType && matchesActive;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar description="Manage your inventory items and their specifications">
        <span className="text-sm text-muted hidden sm:inline">
          {items.length} items ({items.filter((item) => item.is_active).length} active)
        </span>
        <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setError(null);
                    const response = await fetchWithPermissionRefresh('/api/inventory/items/export-csv', {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                      }
                    });
                    if (!response.ok) throw new Error('Failed to export item master CSV');
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `item-master-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 border border-default text-xs font-medium rounded-md text-fg bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={importing}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!importing && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 border border-default text-xs font-medium rounded-md text-fg bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={importing}
              >
                {importing && <span className="spinner w-3 h-3 mr-2 inline-block" />}
                {importing ? 'Importing...' : 'Import CSV'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  try {
                    setShowImportModal(true);
                    setImporting(true);
                    setImportStatus('Uploading file...');
                    setImportStats(null);
                    setError(null);

                    const formData = new FormData();
                    formData.append('file', file);

                    setImportStatus('Processing records, please wait...');
                    const response = await fetchWithPermissionRefresh('/api/inventory/items/import-csv', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                      },
                      body: formData
                    });
                    if (!response.ok) {
                      const errBody = await response.json().catch(() => ({}));
                      throw new Error(errBody.error || 'Failed to import item master CSV');
                    }
                    const data = await response.json();
                    const stats = data.data || {};
                    setImportStats(stats);
                    setImportStatus('Import completed successfully.');
                    await fetchItems();
                  } catch (err) {
                    setImportStatus(`Import failed: ${err.message}`);
                  } finally {
                    setImporting(false);
                    // Reset input so same file can be selected again if needed
                    if (e.target) e.target.value = '';
                  }
                }}
              />
        </div>
      </PageToolbar>

      {error && (
        <div className="p-4 bg-danger border border-destructive rounded-md">
          <p className="text-destructive-foreground">{error}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 bg-card p-4 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search items by name, code, brand, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-default rounded-md focus:ring-primary focus:border-primary"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-fg transition-colors"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className="px-3 py-2 border border-default rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            
            <select
              value={filters.itemType}
              onChange={(e) => setFilters({...filters, itemType: e.target.value})}
              className="px-3 py-2 border border-default rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="">All Types</option>
              <option value="STOCK">Stock</option>
              <option value="NON_STOCK">Non-Stock</option>
              <option value="SERVICE">Service</option>
            </select>
            
            <select
              value={filters.isActive}
              onChange={(e) => setFilters({...filters, isActive: e.target.value})}
              className="px-3 py-2 border border-default rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-default flex justify-between items-center">
          <h2 className="text-lg font-semibold text-fg">Items ({filteredItems.length})</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Item Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Manufacturer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">HSN Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Spare Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">GST %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-fg">{item.item_code}</div>
                      {item.company_code && <div className="text-xs text-muted">{item.company_code}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-fg max-w-xs truncate" title={item.name}>{item.name}</div>
                    {item.sub_category && <div className="text-xs text-muted">{item.sub_category}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {getCategoryName(item.category_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {item.manufacturer || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {item.hsn_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {item.spare_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {item.gst_rate ? `${item.gst_rate}%` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.is_active 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        item.is_active ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-primary hover-text-primary"
                        title="Edit Item"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSettings(item)}
                        className="text-primary hover-text-primary"
                        title="Item Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-default flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-default text-sm font-medium rounded-md text-fg bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-default text-sm font-medium rounded-md text-fg bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-muted">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(indexOfLastItem, filteredItems.length)}</span> of{' '}
                  <span className="font-medium">{filteredItems.length}</span> results
                </p>
                <div className="flex items-center space-x-2">
                  <label htmlFor="itemsPerPage" className="text-sm text-muted">Items per page:</label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-default rounded-md px-2 py-1 text-sm bg-card text-fg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-default bg-card text-sm font-medium text-muted hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    // Show first, last, current, and pages around current
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNumber
                              ? 'z-10 bg-primary border-primary text-primary-foreground'
                              : 'bg-card border-default text-muted hover:bg-muted'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                      return <span key={pageNumber} className="relative inline-flex items-center px-4 py-2 border border-default bg-card text-sm font-medium text-muted">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-default bg-card text-sm font-medium text-muted hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-fg mb-4">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Item Code</label>
                    <input
                      type="text"
                      required
                      value={formData.item_code}
                      onChange={(e) => setFormData({...formData, item_code: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-fg">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Category</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Unit of Measure</label>
                    <select
                      value={formData.unit_of_measure}
                      onChange={(e) => setFormData({...formData, unit_of_measure: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select Unit of Measure</option>
                      {unitsOfMeasure.map(uom => (
                        <option key={uom.id} value={uom.uom_code}>
                          {uom.name} ({uom.uom_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Item Type</label>
                    <select
                      value={formData.item_type}
                      onChange={(e) => setFormData({...formData, item_type: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="STOCK">Stock</option>
                      <option value="NON_STOCK">Non-Stock</option>
                      <option value="SERVICE">Service</option>
                    </select>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-fg">Returnable</label>
                  <select
                    value={formData.is_returnable ? 'Yes' : 'No'}
                    onChange={(e) => setFormData({ ...formData, is_returnable: e.target.value === 'Yes' })}
                    className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Supplier</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Min Stock Level</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({...formData, min_stock_level: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Max Stock Level</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_stock_level}
                      onChange={(e) => setFormData({...formData, max_stock_level: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Reorder Point</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorder_point}
                      onChange={(e) => setFormData({...formData, reorder_point: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Standard Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.standard_cost}
                      onChange={(e) => setFormData({...formData, standard_cost: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Estimated Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.estimated_price}
                      onChange={(e) => setFormData({...formData, estimated_price: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Price Currency</label>
                    <select
                      value={formData.price_currency}
                      onChange={(e) => setFormData({...formData, price_currency: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Company Code</label>
                    <input
                      type="text"
                      value={formData.company_code}
                      onChange={(e) => setFormData({...formData, company_code: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., VRPEPLM00001"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Manufacturer</label>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., KOEL, ACME"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({...formData, hsn_code: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="HSN Code for GST"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">SAC Code</label>
                    <input
                      type="text"
                      value={formData.sac_code}
                      onChange={(e) => setFormData({...formData, sac_code: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="SAC Code"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Spare Type</label>
                    <input
                      type="text"
                      value={formData.spare_type}
                      onChange={(e) => setFormData({...formData, spare_type: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., Valve, Gasket"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Sub Category</label>
                    <input
                      type="text"
                      value={formData.sub_category}
                      onChange={(e) => setFormData({...formData, sub_category: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., Safety"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Rating</label>
                    <input
                      type="text"
                      value={formData.rating}
                      onChange={(e) => setFormData({...formData, rating: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., COMMON, CRITICAL"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">GST Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({...formData, gst_rate: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., 18.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Basic Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.basic_rate}
                      onChange={(e) => setFormData({...formData, basic_rate: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Before tax"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Discount (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({...formData, discount_percentage: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Discount %"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Brand</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Enter brand name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Model</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Enter model name"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingItem(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-default rounded-md text-fg hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary"
                  >
                    {editingItem ? 'Update' : 'Create'} Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-11/12 max-w-xl p-6">
            <h2 className="text-xl font-semibold text-fg mb-2">Importing Item Master CSV</h2>
            <p className="text-sm text-muted mb-4">
              {importStatus || 'Preparing import...'}<br />
              Please do not refresh or close this tab until the import completes.
            </p>
            {importing && (
              <div className="flex items-center gap-3 mb-4">
                <div className="spinner w-6 h-6"></div>
                <span className="text-sm text-muted">Processing items on the server...</span>
              </div>
            )}
            {importStats && (
              <div className="mb-4 text-sm text-fg space-y-3">
                {/* Progress bar */}
                {(() => {
                  const total = importStats.totalRows || 0;
                  const done = importStats.processedRows || 0;
                  const percent = total > 0 ? Math.round((done / total) * 100) : 100;
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted">Progress</span>
                        <span className="text-xs font-medium text-fg">{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-primary transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs sm:text-sm">
                  <div>
                    <span className="font-semibold">Rows processed:</span>{' '}
                    {importStats.processedRows || 0} / {importStats.totalRows || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Created:</span>{' '}
                    {importStats.created || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Updated:</span>{' '}
                    {importStats.updated || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Skipped:</span>{' '}
                    {importStats.skipped || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Errors:</span>{' '}
                    {importStats.errors || 0}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end mt-4">
              {!importing && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportStatus('');
                    setImportStats(null);
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 lg:w-1/4 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Item Settings
                </h3>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedItem(null);
                  }}
                  className="text-muted hover-text-primary"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-fg mb-2">Item Details</h4>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-fg font-medium">{selectedItem.name}</div>
                  <div className="text-sm text-muted">{selectedItem.item_code}</div>
                  <div className="text-sm text-muted mt-1">
                    Status: <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      selectedItem.is_active 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        selectedItem.is_active ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {selectedItem.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleToggleStatus(selectedItem.id, selectedItem.is_active)}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedItem.is_active 
                      ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' 
                      : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                  }`}
                >
                  {selectedItem.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Deactivate Item
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate Item
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDelete(selectedItem.id)}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-default">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedItem(null);
                  }}
                  className="w-full px-4 py-2 border border-default rounded-md text-fg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemManagementPage;
