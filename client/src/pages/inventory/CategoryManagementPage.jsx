import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  MoreVertical,
  FolderOpen,
  Folder,
  ChevronDown,
  ChevronRight,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  Copy,
  Eye,
  Grid3X3,
  List,
  Download,
  Upload,
  Tag,
  Layers,
  Star,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { formatDate } from '../../utils/date';
import { inventoryAPI } from '../../utils/api.js';

const CategoryManagementPage = () => {
  const [categories, setCategories] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    category_code: '',
    name: '',
    description: '',
    parent_category_id: null,
    category_type: 'PRODUCT',
    status: 'ACTIVE',
    sort_order: 0,
    is_default: false
  });
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withChildren: 0,
    default: 0
  });

  useEffect(() => {
    fetchCategories();
    fetchHierarchy();
  }, [currentPage, searchTerm, statusFilter, typeFilter]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { category_type: typeFilter })
      });

      const response = await inventoryAPI.getCategories(`?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      
      // Update stats
      const total = data.pagination?.total || 0;
      const active = data.data?.filter(c => c.status === 'ACTIVE').length || 0;
      const inactive = data.data?.filter(c => c.status === 'INACTIVE').length || 0;
      const withChildren = data.data?.filter(c => c.children_count > 0).length || 0;
      const defaultCount = data.data?.filter(c => c.is_default).length || 0;
      
      setStats({ total, active, inactive, withChildren, default: defaultCount });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHierarchy = async () => {
    try {
      const response = await inventoryAPI.getCategoryHierarchy();
      if (response.ok) {
        const data = await response.json();
        setHierarchy(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch hierarchy:', error);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await inventoryAPI.createCategory(formData);
      if (response.ok) {
        setSuccessMessage('Category created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchCategories();
        fetchHierarchy();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create category');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await inventoryAPI.updateCategory(selectedCategory.id, formData);
      if (response.ok) {
        setSuccessMessage('Category updated successfully');
        setShowEditModal(false);
        resetForm();
        fetchCategories();
        fetchHierarchy();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update category');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDeleteCategory = async () => {
    try {
      const response = await inventoryAPI.deleteCategory(selectedCategory.id);
      if (response.ok) {
        setSuccessMessage('Category deleted successfully');
        setShowDeleteModal(false);
        fetchCategories();
        fetchHierarchy();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete category');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      category_code: '',
      name: '',
      description: '',
      parent_category_id: null,
      category_type: 'PRODUCT',
      status: 'ACTIVE',
      sort_order: 0,
      is_default: false
    });
  };

  const openEditModal = (category) => {
    setSelectedCategory(category);
    setFormData({
      category_code: category.category_code,
      name: category.name,
      description: category.description || '',
      parent_category_id: category.parent_category_id,
      category_type: category.category_type,
      status: category.status,
      sort_order: category.sort_order,
      is_default: category.is_default
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  const openViewModal = (category) => {
    setSelectedCategory(category);
    setShowViewModal(true);
  };

  const renderCategoryTree = (nodes, level = 0) => {
    return nodes.map((node) => (
      <div key={node.id} style={{ marginBottom: '0.5rem' }}>
        <div 
          className={`card ${node.status === 'ACTIVE' ? 'bg-card' : 'bg-muted'}`}
          style={{ marginLeft: level > 0 ? '1.5rem' : '0' }}
        >
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Folder style={{ width: '1rem', height: '1rem', color: 'var(--color-primary)' }} />
              <div>
                <div className="text-fg" style={{ fontWeight: '500' }}>{node.name}</div>
                <div className="text-muted" style={{ fontSize: '0.875rem' }}>{node.category_code}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`badge ${node.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                {node.status}
              </span>
              <span className="badge badge-info">
                {node.category_type}
              </span>
              {node.is_default && (
                <Star style={{ width: '1rem', height: '1rem', color: 'var(--color-chart-1)' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => openViewModal(node)}
                  className="btn"
                  style={{ padding: '0.25rem' }}
                >
                  <Eye style={{ width: '1rem', height: '1rem' }} />
                </button>
                <button
                  onClick={() => openEditModal(node)}
                  className="btn"
                  style={{ padding: '0.25rem' }}
                >
                  <Edit style={{ width: '1rem', height: '1rem' }} />
                </button>
                <button
                  onClick={() => openDeleteModal(node)}
                  className="btn"
                  style={{ padding: '0.25rem' }}
                >
                  <Trash2 style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div style={{ marginLeft: '1rem' }}>
            {renderCategoryTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const renderCategoryList = () => {
    return (
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead className="bg-muted">
              <tr>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Category
                </th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Type
                </th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Status
                </th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Parent
                </th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Sort Order
                </th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase', color: 'var(--color-muted-foreground)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {categories.map((category) => (
                <tr key={category.id} className="hover-bg-muted" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Folder style={{ width: '1rem', height: '1rem', color: 'var(--color-primary)', marginRight: '0.5rem' }} />
                      <div>
                        <div className="text-fg" style={{ fontSize: '0.875rem', fontWeight: '500' }}>{category.name}</div>
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>{category.category_code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                    <span className="badge badge-info">
                      {category.category_type}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                    <span className={`badge ${category.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {category.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-muted">
                    {category.parent_category_name || '-'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-muted">
                    {category.sort_order}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {category.is_default && (
                        <Star style={{ width: '1rem', height: '1rem', color: 'var(--color-chart-1)' }} />
                      )}
                      <button
                        onClick={() => openViewModal(category)}
                        className="btn"
                        style={{ padding: '0.25rem' }}
                      >
                        <Eye style={{ width: '1rem', height: '1rem' }} />
                      </button>
                      <button
                        onClick={() => openEditModal(category)}
                        className="btn"
                        style={{ padding: '0.25rem' }}
                      >
                        <Edit style={{ width: '1rem', height: '1rem' }} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(category)}
                        className="btn"
                        style={{ padding: '0.25rem' }}
                      >
                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-fg" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Category Management</h1>
          <p className="text-muted">Manage inventory item categories and hierarchy</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus style={{ width: '1rem', height: '1rem' }} />
          <span>Add Category</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center' }}>
            <Tag style={{ width: '2rem', height: '2rem', color: 'var(--color-primary)' }} />
            <div style={{ marginLeft: '0.75rem' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Categories</p>
              <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircle style={{ width: '2rem', height: '2rem', color: 'var(--color-chart-2)' }} />
            <div style={{ marginLeft: '0.75rem' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Active</p>
              <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center' }}>
            <AlertTriangle style={{ width: '2rem', height: '2rem', color: 'var(--color-destructive)' }} />
            <div style={{ marginLeft: '0.75rem' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Inactive</p>
              <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.inactive}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center' }}>
            <Layers style={{ width: '2rem', height: '2rem', color: 'var(--color-accent-foreground)' }} />
            <div style={{ marginLeft: '0.75rem' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>With Children</p>
              <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.withChildren}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center' }}>
            <Star style={{ width: '2rem', height: '2rem', color: 'var(--color-chart-1)' }} />
            <div style={{ marginLeft: '0.75rem' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Default</p>
              <p className="text-fg" style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.default}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ flex: '1' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted-foreground)', width: '1rem', height: '1rem' }} />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
                style={{ width: 'auto' }}
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input"
                style={{ width: 'auto' }}
              >
                <option value="all">All Types</option>
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
              </select>
              <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}>
                <button
                  onClick={() => setViewMode('list')}
                  className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '0.375rem 0 0 0.375rem' }}
                >
                  <List style={{ width: '1rem', height: '1rem' }} />
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  className={`btn ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '0 0.375rem 0.375rem 0' }}
                >
                  <Grid3X3 style={{ width: '1rem', height: '1rem' }} />
                </button>
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setCurrentPage(1);
                }}
                className="btn btn-secondary"
              >
                <RefreshCw style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto' }}></div>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>Loading categories...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--color-destructive)' }}>
          <div className="card-body" style={{ display: 'flex' }}>
            <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-destructive)', marginRight: '0.75rem' }} />
            <div>
              <h3 className="text-danger" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Error</h3>
              <p className="text-danger" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'list' ? renderCategoryList() : (
            <div className="card">
              <div className="card-body">
                <h3 className="text-fg" style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '1rem' }}>Category Hierarchy</h3>
                {renderCategoryTree(hierarchy)}
              </div>
            </div>
          )}

          {/* Pagination */}
          {viewMode === 'list' && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Success Message */}
      {successMessage && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 50 }}>
          <div className="card" style={{ borderColor: 'var(--color-chart-2)' }}>
            <div className="card-body" style={{ display: 'flex' }}>
              <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-chart-2)', marginRight: '0.75rem' }} />
              <div>
                <p className="text-fg" style={{ fontSize: '0.875rem' }}>{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="btn"
                style={{ marginLeft: '1rem', padding: '0.25rem' }}
              >
                <X style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-fg" style={{ fontSize: '1.125rem', fontWeight: '500' }}>Create Category</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn"
                style={{ padding: '0.25rem' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Code</label>
                <input
                  type="text"
                  required
                  value={formData.category_code}
                  onChange={(e) => setFormData({...formData, category_code: e.target.value})}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category Type</label>
                <select
                  value={formData.category_type}
                  onChange={(e) => setFormData({...formData, category_type: e.target.value})}
                  className="input"
                >
                  <option value="PRODUCT">Product</option>
                  <option value="SERVICE">Service</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="input"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sort Order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                  className="input"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                />
                <label htmlFor="is_default" className="text-fg" style={{ fontSize: '0.875rem' }}>
                  Set as default category
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCategory && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-fg" style={{ fontSize: '1.125rem', fontWeight: '500' }}>Edit Category</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="btn"
                style={{ padding: '0.25rem' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Code</label>
                <input
                  type="text"
                  required
                  value={formData.category_code}
                  onChange={(e) => setFormData({...formData, category_code: e.target.value})}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category Type</label>
                <select
                  value={formData.category_type}
                  onChange={(e) => setFormData({...formData, category_type: e.target.value})}
                  className="input"
                >
                  <option value="PRODUCT">Product</option>
                  <option value="SERVICE">Service</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="input"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sort Order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                  className="input"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="edit_is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                />
                <label htmlFor="edit_is_default" className="text-fg" style={{ fontSize: '0.875rem' }}>
                  Set as default category
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedCategory && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-destructive)', marginRight: '0.75rem' }} />
                <h2 className="text-fg" style={{ fontSize: '1.125rem', fontWeight: '500' }}>Delete Category</h2>
              </div>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>
                Are you sure you want to delete the category "{selectedCategory.name}"? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCategory}
                  className="btn btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedCategory && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '28rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-fg" style={{ fontSize: '1.125rem', fontWeight: '500' }}>Category Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="btn"
                style={{ padding: '0.25rem' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Code</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.category_code}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.name}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.description || 'No description'}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Category Type</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.category_type}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.status}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Parent Category</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.parent_category_name || 'None'}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Sort Order</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.sort_order}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Default Category</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCategory.is_default ? 'Yes' : 'No'}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Created At</label>
                <p className="text-fg" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {formatDate(selectedCategory.created_at)}
                </p>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowViewModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagementPage;
    