import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryAPI } from '../../utils/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const BinManagementPage = () => {
  const { user } = useAuth();
  const [bins, setBins] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    warehouse_id: '',
    bin_type: '',
    status: ''
  });
  const [expandedWarehouses, setExpandedWarehouses] = useState(new Set());

  const [formData, setFormData] = useState({
    bin_code: '',
    name: '',
    description: '',
    warehouse_id: '',
    parent_bin_id: '',
    bin_type: 'STORAGE',
    status: 'ACTIVE',
    capacity_volume: 0,
    capacity_weight: 0,
    temperature_zone: 'AMBIENT',
    is_default_receiving: false,
    is_default_shipping: false,
    is_restricted: false,
    restriction_reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [binsResponse, warehousesResponse] = await Promise.all([
        inventoryAPI.getBins(),
        inventoryAPI.getWarehouses()
      ]);

      if (!binsResponse.ok) throw new Error('Failed to fetch bins');
      if (!warehousesResponse.ok) throw new Error('Failed to fetch warehouses');

      const binsData = await binsResponse.json();
      const warehousesData = await warehousesResponse.json();

      setBins(binsData.data || []);
      setWarehouses(warehousesData.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (editingBin) {
        response = await inventoryAPI.updateBin(editingBin.id, formData);
      } else {
        response = await inventoryAPI.createBin(formData);
      }

      if (!response.ok) throw new Error('Failed to save bin');

      await fetchData();
      setShowModal(false);
      setEditingBin(null);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (bin) => {
    setEditingBin(bin);
    setFormData({
      bin_code: bin.bin_code,
      name: bin.name,
      description: bin.description || '',
      warehouse_id: bin.warehouse_id,
      parent_bin_id: bin.parent_bin_id || '',
      bin_type: bin.bin_type,
      status: bin.status,
      capacity_volume: bin.capacity_volume || 0,
      capacity_weight: bin.capacity_weight || 0,
      temperature_zone: bin.temperature_zone || 'AMBIENT',
      is_default_receiving: bin.is_default_receiving || false,
      is_default_shipping: bin.is_default_shipping || false,
      is_restricted: bin.is_restricted || false,
      restriction_reason: bin.restriction_reason || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (binId) => {
    if (!window.confirm('Are you sure you want to delete this bin?')) return;

    try {
      const response = await inventoryAPI.deleteBin(binId);

      if (!response.ok) throw new Error('Failed to delete bin');

      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      bin_code: '',
      name: '',
      description: '',
      warehouse_id: '',
      parent_bin_id: '',
      bin_type: 'STORAGE',
      status: 'ACTIVE',
      capacity_volume: 0,
      capacity_weight: 0,
      temperature_zone: 'AMBIENT',
      is_default_receiving: false,
      is_default_shipping: false,
      is_restricted: false,
      restriction_reason: ''
    });
  };

  const toggleWarehouseExpansion = (warehouseId) => {
    const newExpanded = new Set(expandedWarehouses);
    if (newExpanded.has(warehouseId)) {
      newExpanded.delete(warehouseId);
    } else {
      newExpanded.add(warehouseId);
    }
    setExpandedWarehouses(newExpanded);
  };

  const getBinsByWarehouse = (warehouseId) => {
    return bins.filter(bin => bin.warehouse_id === warehouseId);
  };

  const getChildBins = (parentBinId) => {
    return bins.filter(bin => bin.parent_bin_id === parentBinId);
  };

  const renderBinTree = (binList, level = 0) => {
    return binList.map(bin => {
      const childBins = getChildBins(bin.id);
      const hasChildren = childBins.length > 0;

      return (
        <div key={bin.id} style={{ marginLeft: `${level * 20}px` }}>
          <div className="flex items-center justify-between p-3 bg-card border border-default rounded-md mb-2 hover:bg-muted">
            <div className="flex items-center space-x-3">
              {hasChildren && (
                <button
                  onClick={() => toggleWarehouseExpansion(bin.id)}
                  className="text-muted hover:text-fg"
                >
                  {expandedWarehouses.has(bin.id) ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </button>
              )}
              <div>
                <div className="font-medium text-fg">{bin.name}</div>
                <div className="text-sm text-muted">{bin.bin_code}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(bin.bin_type)}`}>
                {bin.bin_type.replace('_', ' ')}
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bin.status)}`}>
                {bin.status}
              </span>
              <button
                onClick={() => handleEdit(bin)}
                className="text-primary hover:text-blue-900"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(bin.id)}
                className="text-destructive hover:text-red-900"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          {hasChildren && expandedWarehouses.has(bin.id) && (
            <div className="ml-4">
              {renderBinTree(childBins, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-accent';
      case 'INACTIVE': return 'bg-muted text-fg';
      case 'MAINTENANCE': return 'badge badge-info';
      case 'RESTRICTED': return 'bg-red-100 text-destructive-foreground';
      default: return 'bg-muted text-fg';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'STORAGE': return 'badge badge-info';
      case 'RECEIVING': return 'bg-green-100 text-accent';
      case 'SHIPPING': return 'badge badge-info';
      case 'PICKING': return 'badge badge-info';
      case 'QUARANTINE': return 'bg-red-100 text-destructive-foreground';
      default: return 'bg-muted text-fg';
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
        <h1 className="text-2xl font-bold text-fg mb-2">Bin Management</h1>
        <p className="text-muted">Manage warehouse bins and their hierarchical structure</p>
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
                placeholder="Search bins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-default rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-muted" />
              <select
                value={filters.warehouse_id}
                onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
                className="border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingBin(null);
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Bin
            </button>
          </div>
        </div>
      </div>

      {/* Bins Tree View */}
      <div className="bg-card rounded-lg shadow-sm border border-default overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Bin Hierarchy</h2>
          
          {warehouses.length === 0 ? (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-muted" />
              <h3 className="mt-2 text-sm font-medium text-fg">No warehouses found</h3>
              <p className="mt-1 text-sm text-muted">Create a warehouse first to add bins.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {warehouses.map(warehouse => {
                const warehouseBins = getBinsByWarehouse(warehouse.id);
                const rootBins = warehouseBins.filter(bin => !bin.parent_bin_id);
                const isExpanded = expandedWarehouses.has(warehouse.id);

                return (
                  <div key={warehouse.id} className="border border-default rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 bg-muted cursor-pointer hover:bg-muted"
                      onClick={() => toggleWarehouseExpansion(warehouse.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {isExpanded ? (
                          <ChevronDownIcon className="h-5 w-5 text-muted" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-muted" />
                        )}
                        <div>
                          <h3 className="font-medium text-fg">{warehouse.name}</h3>
                          <p className="text-sm text-muted">{warehouse.warehouse_code}</p>
                        </div>
                      </div>
                      <div className="text-sm text-muted">
                        {warehouseBins.length} bins
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-4">
                        {rootBins.length === 0 ? (
                          <p className="text-muted text-sm">No bins in this warehouse</p>
                        ) : (
                          renderBinTree(rootBins)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-default">
              <h2 className="text-lg font-semibold text-fg">
                {editingBin ? 'Edit Bin' : 'Add New Bin'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Bin Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.bin_code}
                      onChange={(e) => setFormData({ ...formData, bin_code: e.target.value })}
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
                      Warehouse *
                    </label>
                    <select
                      required
                      value={formData.warehouse_id}
                      onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select a warehouse</option>
                      {warehouses.map(warehouse => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.warehouse_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Parent Bin
                    </label>
                    <select
                      value={formData.parent_bin_id}
                      onChange={(e) => setFormData({ ...formData, parent_bin_id: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">No parent (root bin)</option>
                      {bins
                        .filter(bin => bin.warehouse_id === formData.warehouse_id)
                        .map(bin => (
                          <option key={bin.id} value={bin.id}>
                            {bin.name} ({bin.bin_code})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Bin Type *
                    </label>
                    <select
                      required
                      value={formData.bin_type}
                      onChange={(e) => setFormData({ ...formData, bin_type: e.target.value })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="STORAGE">Storage</option>
                      <option value="RECEIVING">Receiving</option>
                      <option value="SHIPPING">Shipping</option>
                      <option value="PICKING">Picking</option>
                      <option value="QUARANTINE">Quarantine</option>
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
                      <option value="RESTRICTED">Restricted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Capacity Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Capacity Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Capacity Volume (m³)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.capacity_volume}
                      onChange={(e) => setFormData({ ...formData, capacity_volume: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg mb-1">
                      Capacity Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.capacity_weight}
                      onChange={(e) => setFormData({ ...formData, capacity_weight: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature Zone */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Temperature Zone
                </label>
                <select
                  value={formData.temperature_zone}
                  onChange={(e) => setFormData({ ...formData, temperature_zone: e.target.value })}
                  className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="AMBIENT">Ambient</option>
                  <option value="COLD">Cold (2-8°C)</option>
                  <option value="FROZEN">Frozen (-18°C)</option>
                  <option value="CONTROLLED">Controlled Temperature</option>
                </select>
              </div>

              {/* Default Settings */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Default Settings</h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default_receiving}
                      onChange={(e) => setFormData({ ...formData, is_default_receiving: e.target.checked })}
                      className="rounded border-default text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm text-fg">Default Receiving Bin</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default_shipping}
                      onChange={(e) => setFormData({ ...formData, is_default_shipping: e.target.checked })}
                      className="rounded border-default text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm text-fg">Default Shipping Bin</span>
                  </label>
                </div>
              </div>

              {/* Restrictions */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-fg">Restrictions</h3>
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_restricted}
                      onChange={(e) => setFormData({ ...formData, is_restricted: e.target.checked })}
                      className="rounded border-default text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm text-fg">Restricted Access</span>
                  </label>

                  {formData.is_restricted && (
                    <div>
                      <label className="block text-sm font-medium text-fg mb-1">
                        Restriction Reason
                      </label>
                      <textarea
                        value={formData.restriction_reason}
                        onChange={(e) => setFormData({ ...formData, restriction_reason: e.target.value })}
                        rows={3}
                        className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Explain why this bin is restricted..."
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBin(null);
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
                  {editingBin ? 'Update Bin' : 'Create Bin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BinManagementPage;
