import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryAPI, circleAPI, clusterAPI } from '../../utils/api.js';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MapPinIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { Settings, Power, PowerOff, Radio } from 'lucide-react';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';

const WarehouseManagementPage = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    country: ''
  });

  const [formData, setFormData] = useState({
    warehouse_code: '',
    name: '',
    description: '',
    warehouse_type: 'STORAGE',
    status: 'ACTIVE',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    contact_person: '',
    email: '',
    phone: '',
    capacity_sqm: 0,
    temperature_range: { min: 0, max: 25 },
    operating_hours: { open: '08:00', close: '18:00' },
    is_automated: false,
    notes: '',
    circle_id: null,
    cluster_id: null
  });

  useEffect(() => {
    fetchWarehouses();
    fetchCircles();
    fetchClusters();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const response = await inventoryAPI.getWarehouses();
      
      if (!response.ok) throw new Error('Failed to fetch warehouses');
      
      const data = await response.json();
      setWarehouses(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCircles = async () => {
    try {
      const response = await circleAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch circles:', err);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await clusterAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setClusters(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
    }
  };

  const getCircleName = (circleId) => {
    const circle = circles.find(c => c.id === circleId);
    return circle ? circle.name : '-';
  };

  const getClusterName = (clusterId) => {
    const cluster = clusters.find(c => c.id === clusterId);
    return cluster ? cluster.name : '-';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (editingWarehouse) {
        response = await inventoryAPI.updateWarehouse(editingWarehouse.id, formData);
      } else {
        response = await inventoryAPI.createWarehouse(formData);
      }

      if (!response.ok) throw new Error('Failed to save warehouse');

      await fetchWarehouses();
      setShowModal(false);
      setEditingWarehouse(null);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      warehouse_code: warehouse.warehouse_code,
      name: warehouse.name,
      description: warehouse.description || '',
      warehouse_type: warehouse.warehouse_type,
      status: warehouse.status,
      address_line1: warehouse.address_line1 || '',
      address_line2: warehouse.address_line2 || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      postal_code: warehouse.postal_code || '',
      country: warehouse.country || '',
      contact_person: warehouse.contact_person || '',
      email: warehouse.email || '',
      phone: warehouse.phone || '',
      capacity_sqm: warehouse.capacity_sqm || 0,
      temperature_range: warehouse.temperature_range || { min: 0, max: 25 },
      operating_hours: warehouse.operating_hours || { open: '08:00', close: '18:00' },
      is_automated: warehouse.is_automated || false,
      notes: warehouse.notes || '',
      circle_id: warehouse.circle_id || null,
      cluster_id: warehouse.cluster_id || null
    });
    setShowModal(true);
  };

  const handleSettings = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowSettingsModal(true);
  };

  const handleToggleStatus = async (warehouseId, currentStatus) => {
    // Determine the next status in the cycle: ACTIVE -> INACTIVE -> MAINTENANCE -> ACTIVE
    const statusCycle = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const newStatus = statusCycle[nextIndex];
    
    const action = newStatus === 'ACTIVE' ? 'activate' : 
                   newStatus === 'INACTIVE' ? 'deactivate' :
                   'put in maintenance';
    
    if (!window.confirm(`Are you sure you want to ${action} this warehouse?`)) return;
    
    try {
      const response = await inventoryAPI.toggleWarehouseStatus(warehouseId, newStatus);

      if (!response.ok) throw new Error(`Failed to ${action} warehouse`);

      await fetchWarehouses();
      setShowSettingsModal(false);
      setSelectedWarehouse(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (warehouseId) => {
    try {
      // First check if warehouse has bins
      const binsResponse = await inventoryAPI.getWarehouseBins(warehouseId);
      
      if (binsResponse.ok) {
        const binsData = await binsResponse.json();
        if (binsData.data && binsData.data.length > 0) {
          setError(`Cannot delete warehouse. It has ${binsData.data.length} bin(s). Please delete all bins first.`);
          setShowSettingsModal(false);
          setSelectedWarehouse(null);
          return;
        }
      }
      
      if (!window.confirm('⚠️ WARNING: This will permanently delete this warehouse from the database. This action cannot be undone. Are you sure you want to proceed?')) return;
      
      const response = await inventoryAPI.deleteWarehouse(warehouseId);

      if (!response.ok) throw new Error('Failed to delete warehouse');

      await fetchWarehouses();
      setShowSettingsModal(false);
      setSelectedWarehouse(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      warehouse_code: '',
      name: '',
      description: '',
      warehouse_type: 'STORAGE',
      status: 'ACTIVE',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      contact_person: '',
      email: '',
      phone: '',
      capacity_sqm: 0,
      temperature_range: { min: 0, max: 25 },
      operating_hours: { open: '08:00', close: '18:00' },
      is_automated: false,
      notes: '',
      circle_id: null,
      cluster_id: null
    });
  };

  const filteredWarehouses = warehouses.filter(warehouse => {
    const matchesSearch = warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         warehouse.warehouse_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         warehouse.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filters.status || warehouse.status === filters.status;
    const matchesType = !filters.type || warehouse.warehouse_type === filters.type;
    const matchesCountry = !filters.country || warehouse.country === filters.country;
    
    return matchesSearch && matchesStatus && matchesType && matchesCountry;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'badge badge-success';
      case 'INACTIVE': return 'badge badge-danger';
      case 'MAINTENANCE': return 'badge badge-info';
      default: return 'badge';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'STORAGE': return 'badge badge-info';
      case 'PRODUCTION': return 'badge badge-success';
      case 'TRANSIT': return 'badge badge-warning';
      case 'COLD_STORAGE': return 'badge badge-info';
      case 'HAZARDOUS': return 'badge badge-danger';
      default: return 'badge';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg mb-2">Warehouse Management</h1>
        <p className="text-muted">Manage warehouses and their configurations</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-danger border border-destructive rounded-md">
          <p className="text-destructive-foreground">{error}</p>
        </div>
      )}

      {/* Header with Search and Filters */}
      <div className="bg-card rounded-lg shadow-sm border border-default p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-default rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-fg"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-muted" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-muted" />
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="STORAGE">Storage</option>
                <option value="PRODUCTION">Production</option>
                <option value="TRANSIT">Transit</option>
                <option value="COLD_STORAGE">Cold Storage</option>
                <option value="HAZARDOUS">Hazardous</option>
              </select>
            </div>
            
            <button
              onClick={() => {
                setEditingWarehouse(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Warehouse
            </button>
          </div>
        </div>
      </div>

      {/* Warehouses List */}
      <div className="bg-card rounded-lg shadow-sm border border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Circle/Cluster
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Features
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {filteredWarehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-fg">{warehouse.name}</div>
                      <div className="text-sm text-muted">{warehouse.warehouse_code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getTypeColor(warehouse.warehouse_type)}>
                      {warehouse.warehouse_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg">{warehouse.city}, {warehouse.country}</div>
                    <div className="text-sm text-muted">{warehouse.address_line1}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {warehouse.circle_id ? (
                        <div className="flex items-center gap-1 text-xs text-fg">
                          <Radio size={12} className="text-muted" />
                          <span>{getCircleName(warehouse.circle_id)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No Circle</span>
                      )}
                      {warehouse.cluster_id ? (
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Radio size={10} className="text-muted" />
                          <span>{getClusterName(warehouse.cluster_id)}</span>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusColor(warehouse.status)}>
                      {warehouse.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {warehouse.capacity_sqm} m²
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {warehouse.is_automated && (
                        <span className="badge badge-success">
                          Automated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(warehouse)}
                        className="text-primary hover:text-blue-900"
                        title="Edit Warehouse"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSettings(warehouse)}
                        className="text-primary hover:text-blue-900"
                        title="Warehouse Settings"
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
        
        {filteredWarehouses.length === 0 && (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="mx-auto h-12 w-12 text-muted" />
            <h3 className="mt-2 text-sm font-medium text-fg">No warehouses found</h3>
            <p className="mt-1 text-sm text-muted">
              {searchTerm || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by creating a new warehouse.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-default">
              <h2 className="text-lg font-semibold text-fg">
                {editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Warehouse Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.warehouse_code}
                      onChange={(e) => setFormData({ ...formData, warehouse_code: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                
                {/* Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Warehouse Type *
                    </label>
                    <select
                      required
                      value={formData.warehouse_type}
                      onChange={(e) => setFormData({ ...formData, warehouse_type: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="STORAGE">Storage</option>
                      <option value="PRODUCTION">Production</option>
                      <option value="TRANSIT">Transit</option>
                      <option value="COLD_STORAGE">Cold Storage</option>
                      <option value="HAZARDOUS">Hazardous</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Status *
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Capacity (m²)
                    </label>
                    <input
                      type="number"
                      value={formData.capacity_sqm}
                      onChange={(e) => setFormData({ ...formData, capacity_sqm: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Telecom Circle
                    </label>
                    <CircleSelector
                      value={formData.circle_id}
                      onChange={(value) => {
                        setFormData({ ...formData, circle_id: value, cluster_id: null });
                      }}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Cluster
                    </label>
                    <ClusterSelector
                      value={formData.cluster_id}
                      onChange={(value) => setFormData({ ...formData, cluster_id: value })}
                      circleId={formData.circle_id}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              {/* Additional Settings */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Additional Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_automated}
                        onChange={(e) => setFormData({ ...formData, is_automated: e.target.checked })}
                        className="rounded border-default text-primary focus:ring-primary"
                      />
                      <span className="ml-2 text-sm text-fg">Automated Warehouse</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingWarehouse(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-default rounded-md text-fg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary transition-colors"
                >
                  {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 lg:w-1/4 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Warehouse Settings
                </h3>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedWarehouse(null);
                  }}
                  className="text-muted hover:text-primary"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-fg mb-2">Warehouse Details</h4>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-fg font-medium">{selectedWarehouse.name}</div>
                  <div className="text-sm text-muted">{selectedWarehouse.warehouse_code}</div>
                  <div className="text-sm text-muted mt-1">
                    Status: <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      selectedWarehouse.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : selectedWarehouse.status === 'MAINTENANCE'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        selectedWarehouse.status === 'ACTIVE' ? 'bg-green-500' : 
                        selectedWarehouse.status === 'MAINTENANCE' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></span>
                      {selectedWarehouse.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleToggleStatus(selectedWarehouse.id, selectedWarehouse.status)}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedWarehouse.status === 'ACTIVE' 
                      ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' 
                      : selectedWarehouse.status === 'INACTIVE'
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                  }`}
                >
                  {selectedWarehouse.status === 'ACTIVE' ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Deactivate Warehouse
                    </>
                  ) : selectedWarehouse.status === 'INACTIVE' ? (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate Warehouse
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate Warehouse
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDelete(selectedWarehouse.id)}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Warehouse
                </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-default">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedWarehouse(null);
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

export default WarehouseManagementPage;
