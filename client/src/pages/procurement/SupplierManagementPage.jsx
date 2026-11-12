import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { procurementAPI, inventoryAPI, circleAPI, clusterAPI } from '../../utils/api';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal.jsx';
import { Settings, Power, PowerOff } from 'lucide-react';
import PageToolbar from '../../components/layout/PageToolbar';

const SupplierManagementPage = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [filters, setFilters] = useState({
    supplierType: '',
    status: '',
    circle_id: '',
    cluster_id: ''
  });
  const [selectedSupplierForItems, setSelectedSupplierForItems] = useState(null);
  const [supplierItems, setSupplierItems] = useState([]);
  const [items, setItems] = useState([]);
  const [showSupplierItemModal, setShowSupplierItemModal] = useState(false);
  const [editingSupplierItem, setEditingSupplierItem] = useState(null);

  // Pricing management state
  const [supplierPriceLists, setSupplierPriceLists] = useState([]);
  const [selectedSupplierPriceListId, setSelectedSupplierPriceListId] = useState('');
  const [appliedPriceListId, setAppliedPriceListId] = useState('');
  const [priceItems, setPriceItems] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceForm, setPriceForm] = useState({
    item_id: '',
    supplier_item_code: '',
    supplier_item_name: '',
    unit_price: 0,
    gst_rate: 0,
    min_quantity: 1,
    lead_time_days: 0,
    mrp: 0,
    valid_from: new Date().toISOString().split('T')[0],
    currency: 'INR'
  });

  const [formData, setFormData] = useState({
    supplier_code: '',
    name: '',
    legal_name: '',
    gst_number: '',
    vat_number: '',
    service_tax_number: '',
    pan_number: '',
    registration_number: '',
    supplier_type: 'VENDOR',
    status: 'ACTIVE',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    payment_terms: 30,
    credit_limit: 0,
    currency: 'INR',
    rating: 3,
    qualification_status: 'qualified',
    qualified_until: '',
    qualification_notes: '',
    circle_id: '',
    cluster_id: ''
  });

  const [supplierItemFormData, setSupplierItemFormData] = useState({
    item_id: '',
    supplier_item_code: '',
    supplier_item_name: '',
    is_preferred: false,
    lead_time_days: 0,
    minimum_order_qty: 1,
    unit_price: 0,
    currency: 'INR',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
    fetchItems();
    fetchRegions();
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [filters]);

  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);

  const fetchRegions = async () => {
    try {
      const [resCircles, resClusters] = await Promise.all([
        circleAPI.getAll(),
        clusterAPI.getAll()
      ]);
      const [dataCircles, dataClusters] = await Promise.all([
        resCircles.json(),
        resClusters.json()
      ]);
      setCircles(dataCircles.data || dataCircles || []);
      setClusters(dataClusters.data || dataClusters || []);
    } catch (e) {
      // non-blocking
    }
  };

  useEffect(() => {
    if (selectedSupplierForItems) {
      fetchSupplierItems(selectedSupplierForItems.id);
    }
  }, [selectedSupplierForItems]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.supplierType) params.set('supplier_type', filters.supplierType);
      if (filters.status) params.set('status', filters.status);
      if (filters.circle_id) params.set('circle_id', filters.circle_id);
      if (filters.cluster_id) params.set('cluster_id', filters.cluster_id);
      // Request a high limit so we can handle pagination on the client side
      if (!params.has('limit')) params.set('limit', '500');
      const response = await procurementAPI.getSuppliers(params.toString());
      
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      
      const data = await response.json();
      setSuppliers(data.data || []);
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
      
      if (editingSupplier) {
        response = await procurementAPI.updateSupplier(editingSupplier.id, formData);
      } else {
        response = await procurementAPI.createSupplier(formData);
      }

      if (!response.ok) throw new Error('Failed to save supplier');

      await fetchSuppliers();
      setShowModal(false);
      setEditingSupplier(null);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await inventoryAPI.getItems();
      
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  // Pricing helpers
  const fetchSupplierPriceLists = async (supplierId) => {
    try {
      const res = await procurementAPI.getPriceLists(`supplier_id=${supplierId}&limit=1000`);
      if (!res.ok) return;
      const data = await res.json();
      const lists = data.data || [];
      setSupplierPriceLists(lists);
      if (lists.length > 0) {
        const recent = lists[0];
        setSelectedSupplierPriceListId(String(recent.id));
        fetchPriceItems(recent.id);
      } else {
        setSelectedSupplierPriceListId('');
        setPriceItems([]);
      }
    } catch (e) {
      console.error('Failed to load supplier price lists', e);
    }
  };

  const fetchPriceItems = async (priceListId) => {
    if (!priceListId) { setPriceItems([]); return; }
    try {
      setLoadingPrices(true);
      const res = await procurementAPI.getItemPrices(priceListId);
      if (!res.ok) { setLoadingPrices(false); return; }
      const data = await res.json();
      setPriceItems((data.data || data.item_prices || []));
    } catch (e) {
      console.error('Failed to load price items', e);
    } finally {
      setLoadingPrices(false);
    }
  };

  const fetchAppliedPriceList = async (supplierId) => {
    try {
      const res = await procurementAPI.getAppliedPriceList(supplierId);
      if (!res.ok) return;
      const data = await res.json();
      const pl = data.data;
      setAppliedPriceListId(pl?.id ? String(pl.id) : '');
    } catch (e) {
      // non-blocking
    }
  };

  const resetPriceForm = () => setPriceForm({
    item_id: '', supplier_item_code: '', supplier_item_name: '', unit_price: 0,
    gst_rate: 0, min_quantity: 1, lead_time_days: 0, mrp: 0,
    valid_from: new Date().toISOString().split('T')[0], currency: 'INR'
  });

  const openAddPrice = () => {
    setEditingPrice(null);
    resetPriceForm();
    setShowPriceModal(true);
  };

  const openEditPrice = (row) => {
    setEditingPrice(row);
    setPriceForm({
      item_id: row.item_id,
      supplier_item_code: row.supplier_item_code || '',
      supplier_item_name: row.supplier_item_name || '',
      unit_price: row.unit_price || 0,
      gst_rate: row.gst_rate || 0,
      min_quantity: row.min_quantity || 1,
      lead_time_days: row.lead_time_days || 0,
      mrp: row.mrp || 0,
      valid_from: (row.valid_from || '').slice(0,10) || new Date().toISOString().split('T')[0],
      currency: row.currency || 'INR'
    });
    setShowPriceModal(true);
  };

  const submitPrice = async (e) => {
    e.preventDefault();
    if (!selectedSupplierForItems) return;
    try {
      let priceListId = selectedSupplierPriceListId;
      if (!priceListId) {
        const body = {
          name: `Custom – ${selectedSupplierForItems.name} – ${new Date().toISOString().slice(0,10)}`,
          description: 'Manual prices',
          currency: priceForm.currency,
          supplier_id: selectedSupplierForItems.id,
          is_active: true
        };
        const res = await procurementAPI.createPriceList(body);
        if (res.ok) {
          const data = await res.json();
          priceListId = String(data.price_list?.id || data.data?.id);
          await fetchSupplierPriceLists(selectedSupplierForItems.id);
          setSelectedSupplierPriceListId(priceListId);
        }
      }

      if (!priceListId) return;

      const payload = {
        price_list_id: Number(priceListId),
        item_id: Number(priceForm.item_id),
        supplier_id: selectedSupplierForItems.id,
        price_type: 'PURCHASE',
        unit_price: Number(priceForm.unit_price) || 0,
        currency: priceForm.currency || 'INR',
        min_quantity: Number(priceForm.min_quantity) || 1,
        gst_rate: Number(priceForm.gst_rate) || 0,
        lead_time_days: Number(priceForm.lead_time_days) || 0,
        supplier_item_code: priceForm.supplier_item_code || null,
        supplier_item_name: priceForm.supplier_item_name || null,
        mrp: Number(priceForm.mrp) || 0,
        valid_from: priceForm.valid_from
      };

      let res;
      if (editingPrice) {
        res = await procurementAPI.updateItemPrice(editingPrice.id, payload);
      } else {
        res = await procurementAPI.createItemPrice(payload);
      }
      if (res.ok) {
        setShowPriceModal(false);
        setEditingPrice(null);
        resetPriceForm();
        await fetchPriceItems(priceListId);
      }
    } catch (err) {
      console.error('Failed saving price', err);
    }
  };

  // Item picker integration for prices
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const filteredItemsForPicker = items.filter((it) => {
    if (!itemSearchTerm) return true;
    const q = itemSearchTerm.toLowerCase();
    return (
      (it.name || '').toLowerCase().includes(q) ||
      (it.item_code || '').toLowerCase().includes(q) ||
      (it.manufacturer || '').toLowerCase().includes(q) ||
      (it.hsn_code || '').toLowerCase().includes(q)
    );
  });

  // Pagination for suppliers grid
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierPageSize, setSupplierPageSize] = useState(18);

  // Pagination and search for price list / supplier items table
  const [priceSearchTerm, setPriceSearchTerm] = useState('');
  const [pricePage, setPricePage] = useState(1);
  const [pricePageSize, setPricePageSize] = useState(25);

  const selectItemForPrice = (item) => {
    setPriceForm((prev) => ({ ...prev, item_id: item.id }));
    setShowItemPicker(false);
  };

  const fetchSupplierItems = async (supplierId) => {
    try {
      const response = await procurementAPI.getSupplierItems(supplierId);
      
      if (response.ok) {
        const data = await response.json();
        setSupplierItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch supplier items:', err);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    console.log('Editing supplier with coverage:', { circle_id: supplier.circle_id, cluster_id: supplier.cluster_id });
    setFormData({
      supplier_code: supplier.supplier_code,
      name: supplier.name,
      legal_name: supplier.legal_name || '',
      gst_number: supplier.gst_number || '',
      vat_number: supplier.vat_number || '',
      service_tax_number: supplier.service_tax_number || '',
      pan_number: supplier.pan_number || '',
      registration_number: supplier.registration_number || '',
      supplier_type: supplier.supplier_type,
      status: supplier.status,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
      address_line1: supplier.address_line1 || '',
      address_line2: supplier.address_line2 || '',
      city: supplier.city || '',
      state: supplier.state || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || '',
      payment_terms: supplier.payment_terms || 30,
      credit_limit: supplier.credit_limit || 0,
      currency: supplier.currency || 'INR',
      rating: supplier.rating || 3,
      qualification_status: supplier.qualification_status || 'qualified',
      qualified_until: supplier.qualified_until ? String(supplier.qualified_until).slice(0, 10) : '',
      qualification_notes: supplier.qualification_notes || '',
      circle_id: supplier.circle_id ? String(supplier.circle_id) : '',
      cluster_id: supplier.cluster_id ? String(supplier.cluster_id) : ''
    });
    setShowModal(true);
  };

  const handleSettings = (supplier) => {
    setSelectedSupplier(supplier);
    setShowSettingsModal(true);
  };

  const handleSupplierClick = (supplier) => {
    setSelectedSupplierForItems(supplier);
    fetchSupplierPriceLists(supplier.id);
    fetchAppliedPriceList(supplier.id);
  };

  const handleBackToSuppliers = () => {
    setSelectedSupplierForItems(null);
    setSupplierItems([]);
    setSupplierPriceLists([]);
    setSelectedSupplierPriceListId('');
    setAppliedPriceListId('');
    setPriceItems([]);
  };

  const handleToggleStatus = async (supplierId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${action} this supplier?`)) return;
    
    try {
      const response = await procurementAPI.toggleSupplierStatus(supplierId, newStatus);

      if (!response.ok) throw new Error(`Failed to ${action} supplier`);

      await fetchSuppliers();
      setShowSettingsModal(false);
      setSelectedSupplier(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (supplierId) => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete this supplier from the database. This action cannot be undone. Are you sure you want to proceed?')) return;
    
    try {
      const response = await procurementAPI.deleteSupplier(supplierId);

      if (!response.ok) throw new Error('Failed to delete supplier');

      await fetchSuppliers();
      setShowSettingsModal(false);
      setSelectedSupplier(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSupplierItemSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      
      if (editingSupplierItem) {
        response = await procurementAPI.updateSupplierItem(editingSupplierItem.id, supplierItemFormData);
      } else {
        response = await procurementAPI.createSupplierItem(supplierItemFormData);
      }

      if (!response.ok) throw new Error('Failed to save supplier item');

      await fetchSupplierItems(selectedSupplierForItems.id);
      setShowSupplierItemModal(false);
      setEditingSupplierItem(null);
      resetSupplierItemForm();
    } catch (err) {
      setError(err.message);
    }
  };



  const handleSupplierItemDelete = async (supplierItemId) => {
    if (!window.confirm('Are you sure you want to delete this supplier item?')) return;
    
    try {
      const response = await procurementAPI.deleteSupplierItem(supplierItemId);

      if (!response.ok) throw new Error('Failed to delete supplier item');

      await fetchSupplierItems(selectedSupplierForItems.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetSupplierItemForm = () => {
    setSupplierItemFormData({
      supplier_id: selectedSupplierForItems?.id || '',
      item_id: '',
      supplier_item_code: '',
      supplier_item_name: '',
      is_preferred: false,
      lead_time_days: 0,
      minimum_order_qty: 1,
      unit_price: 0,
      currency: 'INR',
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: '',
      notes: ''
    });
  };

  const handleEditSupplierItem = (supplierItem) => {
    setEditingSupplierItem(supplierItem);
    
    // Convert ISO date strings to yyyy-MM-dd format for HTML date inputs
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toISOString().split('T')[0];
      } catch (error) {
        return '';
      }
    };
    
    setSupplierItemFormData({
      supplier_id: selectedSupplierForItems?.id || '',
      item_id: supplierItem.item_id,
      supplier_item_code: supplierItem.supplier_item_code,
      supplier_item_name: supplierItem.supplier_item_name,
      is_preferred: supplierItem.is_preferred,
      lead_time_days: supplierItem.lead_time_days,
      minimum_order_qty: supplierItem.minimum_order_qty,
      unit_price: supplierItem.unit_price,
      currency: supplierItem.currency || 'INR',
      valid_from: formatDateForInput(supplierItem.valid_from),
      valid_to: formatDateForInput(supplierItem.valid_to),
      notes: supplierItem.notes
    });
    setShowSupplierItemModal(true);
  };

  const handleDeleteSupplierItem = async (supplierItemId) => {
    if (!window.confirm('Are you sure you want to delete this supplier item?')) return;
    
    try {
      const response = await procurementAPI.deleteSupplierItem(supplierItemId);

      if (!response.ok) throw new Error('Failed to delete supplier item');

      await fetchSupplierItems(selectedSupplierForItems.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_code: '',
      name: '',
      legal_name: '',
      gst_number: '',
      vat_number: '',
      service_tax_number: '',
      pan_number: '',
      registration_number: '',
      supplier_type: 'VENDOR',
      status: 'ACTIVE',
      contact_person: '',
      email: '',
      phone: '',
      website: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      payment_terms: 30,
      credit_limit: 0,
      currency: 'INR',
      rating: 3,
      qualification_status: 'qualified',
      qualified_until: '',
      qualification_notes: '',
      circle_id: '',
      cluster_id: ''
    });
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filters.supplierType || supplier.supplier_type === filters.supplierType;
    const matchesStatus = !filters.status || supplier.status === filters.status;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalSuppliers = filteredSuppliers.length;
  const totalSupplierPages = Math.max(1, Math.ceil(totalSuppliers / supplierPageSize));
  const safeSupplierPage = Math.min(supplierPage, totalSupplierPages);
  const supplierStartIndex = (safeSupplierPage - 1) * supplierPageSize;
  const supplierEndIndex = Math.min(supplierStartIndex + supplierPageSize, totalSuppliers);
  const paginatedSuppliers = filteredSuppliers.slice(supplierStartIndex, supplierEndIndex);

  // Reset supplier page when filters/search change
  React.useEffect(() => {
    setSupplierPage(1);
  }, [searchTerm, filters.supplierType, filters.status, filters.circle_id, filters.cluster_id]);

  // Compute filtered + paginated rows for price list / supplier items table
  const tableRows = priceItems.length > 0 ? priceItems : supplierItems;
  const filteredPriceRows = tableRows.filter((row) => {
    if (!priceSearchTerm) return true;
    const q = priceSearchTerm.toLowerCase();
    return (
      (row.item_name || '').toLowerCase().includes(q) ||
      (row.item_code || '').toLowerCase().includes(q) ||
      (row.supplier_item_name || '').toLowerCase().includes(q) ||
      (row.supplier_item_code || '').toLowerCase().includes(q)
    );
  });

  const totalPriceRows = filteredPriceRows.length;
  const totalPricePages = Math.max(1, Math.ceil(totalPriceRows / pricePageSize));
  const safePricePage = Math.min(pricePage, totalPricePages);
  const priceStartIndex = (safePricePage - 1) * pricePageSize;
  const priceEndIndex = Math.min(priceStartIndex + pricePageSize, totalPriceRows);
  const paginatedPriceRows = filteredPriceRows.slice(priceStartIndex, priceEndIndex);

  // Reset price pagination when context changes
  React.useEffect(() => {
    setPricePage(1);
  }, [selectedSupplierForItems, selectedSupplierPriceListId, priceSearchTerm]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'badge badge-success';
      case 'INACTIVE': return 'badge bg-muted text-fg';
      case 'BLACKLISTED': return 'badge badge-danger';
      case 'PENDING_APPROVAL': return 'badge badge-info';
      default: return 'badge bg-muted text-fg';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'VENDOR': return 'badge badge-info';
      case 'MANUFACTURER': return 'badge badge-info';
      case 'DISTRIBUTOR': return 'badge badge-info';
      case 'SERVICE_PROVIDER': return 'badge badge-info';
      default: return 'badge bg-muted text-fg';
    }
  };

  const getRatingStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
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
      <PageToolbar description="Manage your suppliers and their information" />

      {error && (
        <div className="mb-4 p-4 bg-danger text-destructive-foreground border border-destructive rounded-md">
          <p className="text-destructive-foreground">{error}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type="text"
                placeholder="Search suppliers by name, code, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-10 pr-10 py-2"
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
          
          <div className="flex gap-2">
            <select
              value={filters.supplierType}
              onChange={(e) => setFilters({...filters, supplierType: e.target.value})}
              className="input px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="VENDOR">Vendor</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="SERVICE_PROVIDER">Service Provider</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="input px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLACKLISTED">Blacklisted</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
            </select>
            
            <select
              value={filters.circle_id}
              onChange={(e) => setFilters({...filters, circle_id: e.target.value, cluster_id: ''})}
              className="input px-3 py-2"
            >
              <option value="">All Circles</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>

            <select
              value={filters.cluster_id}
              onChange={(e) => setFilters({...filters, cluster_id: e.target.value})}
              className="input px-3 py-2"
            >
              <option value="">All Clusters</option>
              {clusters.filter(cl => !filters.circle_id || cl.circle_id === parseInt(filters.circle_id)).map(cl => (
                <option key={cl.id} value={cl.id}>{cl.code} - {cl.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Supplier Items View */}
      {selectedSupplierForItems && (
        <div className="card overflow-hidden">
          <div className="card-header flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToSuppliers}
                className="text-primary hover:text-blue-900 flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Suppliers
              </button>
              <div>
                <h2 className="text-lg font-semibold text-fg">{selectedSupplierForItems.name} - Items</h2>
                <p className="text-sm text-muted">{selectedSupplierForItems.supplier_code}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingSupplierItem(null);
                resetSupplierItemForm();
                setShowSupplierItemModal(true);
              }}
              className="btn btn-primary inline-flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            {/* Pricing header controls */}
            <div className="p-4 flex flex-col gap-3 border-b border-default">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">Price List</label>
                  <select
                    value={selectedSupplierPriceListId}
                    onChange={(e) => { setSelectedSupplierPriceListId(e.target.value); fetchPriceItems(e.target.value); }}
                    className="input h-9"
                  >
                    <option value="">All (manual add will create custom)</option>
                    {supplierPriceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Applied Price List</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={appliedPriceListId}
                      onChange={(e) => setAppliedPriceListId(e.target.value)}
                      className="input h-9 flex-1"
                    >
                      <option value="">None</option>
                      {supplierPriceLists.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-secondary"
                      onClick={async () => {
                        try {
                          const r = await procurementAPI.setAppliedPriceList(selectedSupplierForItems.id, appliedPriceListId ? Number(appliedPriceListId) : null);
                          if (r.ok) {
                            await fetchAppliedPriceList(selectedSupplierForItems.id);
                          }
                        } catch (_) {}
                      }}
                    >Apply</button>
                  </div>
                  <p className="text-xs text-muted mt-1">Only one price list can be active for this supplier at a time.</p>
                </div>
                <div className="flex items-end">
                  <button className="btn btn-secondary mr-2" onClick={() => fetchSupplierPriceLists(selectedSupplierForItems.id)}>Refresh</button>
                  <button className="btn btn-primary" onClick={openAddPrice}>Add Price</button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex-1 max-w-xs">
                <label className="form-label text-xs mb-1">Search Items in Price List</label>
                <input
                  type="text"
                  value={priceSearchTerm}
                  onChange={(e) => setPriceSearchTerm(e.target.value)}
                  placeholder="Search by item name, code, vendor code..."
                  className="input h-9 w-full"
                />
              </div>
              <div className="flex items-end gap-3 text-xs text-muted">
                <div>
                  Rows per page:{' '}
                  <select
                    value={pricePageSize}
                    onChange={(e) => {
                      setPricePageSize(Number(e.target.value) || 25);
                      setPricePage(1);
                    }}
                    className="input input-sm w-20 inline-block ml-1"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div>
                  Showing {totalPriceRows === 0 ? 0 : priceStartIndex + 1}–{priceEndIndex} of {totalPriceRows}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={safePricePage <= 1}
                    onClick={() => setPricePage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span>
                    Page {safePricePage} / {totalPricePages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={safePricePage >= totalPricePages}
                    onClick={() => setPricePage((p) => Math.min(totalPricePages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <table className="min-w-full divide-y divide-default mt-2">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">Vendor Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">GST %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">MOQ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">Lead Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">MRP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg uppercase">Price List</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-fg uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-default">
                {paginatedPriceRows.map((row) => (
                  <tr key={row.id || `${row.item_id}-${row.price_list_id || 'na'}`} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm">{row.item_name || row.item_code}</td>
                    <td className="px-4 py-3 text-sm">{row.supplier_item_code || '-'}</td>
                    <td className="px-4 py-3 text-sm">{(row.currency || 'INR')} {(row.unit_price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{row.gst_rate || 0}</td>
                    <td className="px-4 py-3 text-sm">{row.min_quantity || 1}</td>
                    <td className="px-4 py-3 text-sm">{row.lead_time_days || 0} d</td>
                    <td className="px-4 py-3 text-sm">{row.mrp || 0}</td>
                    <td className="px-4 py-3 text-sm">{row.price_list_name || supplierPriceLists.find(pl => pl.id === row.price_list_id)?.name || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditPrice(row)}>Edit</button>
                        {row.id && (
                          <button
                            className="btn btn-sm btn-destructive"
                            onClick={async () => { try { const r = await procurementAPI.deleteItemPrice(row.id); if (r.ok) { fetchPriceItems(selectedSupplierPriceListId); } } catch(_){} }}
                          >Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {supplierItems.length === 0 && (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-muted" />
                <h3 className="mt-2 text-sm font-medium text-fg">No items found for this supplier</h3>
                <p className="mt-1 text-sm text-muted">
                  Get started by adding items to this supplier's catalog.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Grid */}
      {!selectedSupplierForItems && (
        <div className="card overflow-hidden">
        <div className="card-header flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-fg">Suppliers ({totalSuppliers})</h2>
            <p className="text-xs text-muted">
              Showing {totalSuppliers === 0 ? 0 : supplierStartIndex + 1}–{supplierEndIndex} of {totalSuppliers}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted">
              Rows per page:{' '}
              <select
                value={supplierPageSize}
                onChange={(e) => {
                  setSupplierPageSize(Number(e.target.value) || 18);
                  setSupplierPage(1);
                }}
                className="input input-xs w-20 inline-block ml-1"
              >
                <option value={9}>9</option>
                <option value={18}>18</option>
                <option value={36}>36</option>
              </select>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                disabled={safeSupplierPage <= 1}
                onClick={() => setSupplierPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>
                Page {safeSupplierPage} / {totalSupplierPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                disabled={safeSupplierPage >= totalSupplierPages}
                onClick={() => setSupplierPage((p) => Math.min(totalSupplierPages, p + 1))}
              >
                Next
              </button>
            </div>
            <button
              onClick={() => {
                setEditingSupplier(null);
                resetForm();
                setShowModal(true);
              }}
              className="btn btn-primary inline-flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Supplier
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {paginatedSuppliers.map((supplier) => (
            <div 
              key={supplier.id} 
              className="bg-card border border-default rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleSupplierClick(supplier)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-fg">{supplier.name}</h3>
                  <p className="text-sm text-muted">{supplier.supplier_code}</p>
                </div>
                <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="text-primary hover:text-blue-900"
                    title="Edit Supplier"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleSettings(supplier)}
                    className="text-primary hover:text-blue-900"
                    title="Supplier Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(supplier.status)}`}>
                    {supplier.status}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(supplier.supplier_type)}`}>
                    {supplier.supplier_type}
                  </span>
                </div>

                {supplier.contact_person && (
                  <div className="flex items-center text-sm text-muted">
                    <span className="font-medium mr-2">Contact:</span>
                    {supplier.contact_person}
                  </div>
                )}

                {supplier.email && (
                  <div className="flex items-center text-sm text-muted">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    {supplier.email}
                  </div>
                )}

                {supplier.phone && (
                  <div className="flex items-center text-sm text-muted">
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    {supplier.phone}
                  </div>
                )}

                {supplier.website && (
                  <div className="flex items-center text-sm text-muted">
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {supplier.website}
                    </a>
                  </div>
                )}

                {supplier.city && supplier.country && (
                  <div className="text-sm text-muted">
                    <span className="font-medium">Location:</span> {supplier.city}, {supplier.country}
                  </div>
                )}

                {(supplier.circle_id || supplier.cluster_id) && (
                  <div className="text-sm text-muted">
                    <span className="font-medium">Region:</span>
                    {supplier.circle_id && (
                      <span className="ml-1">
                        {circles.find(c => c.id === supplier.circle_id)?.name || `Circle #${supplier.circle_id}`}
                      </span>
                    )}
                    {supplier.cluster_id && (
                      <span className="ml-1">
                        / {clusters.find(c => c.id === supplier.cluster_id)?.name || `Cluster #${supplier.cluster_id}`}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">
                    <span className="font-medium">Payment Terms:</span> {supplier.payment_terms} days
                  </span>
                  <span className="text-yellow-600 font-medium">
                    {getRatingStars(supplier.rating || 0)}
                  </span>
                </div>

                {supplier.credit_limit > 0 && (
                  <div className="text-sm text-muted">
                    <span className="font-medium">Credit Limit:</span> {supplier.currency} {supplier.credit_limit.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-card max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-fg mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Supplier Code</label>
                    <input
                      type="text"
                      required
                      value={formData.supplier_code}
                      onChange={(e) => setFormData({...formData, supplier_code: e.target.value})}
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
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Legal Name</label>
                    <input
                      type="text"
                      value={formData.legal_name}
                      onChange={(e) => setFormData({...formData, legal_name: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">GST Number</label>
                    <input
                      type="text"
                      value={formData.gst_number}
                      onChange={(e) => setFormData({...formData, gst_number: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">VAT Number</label>
                    <input
                      type="text"
                      value={formData.vat_number}
                      onChange={(e) => setFormData({...formData, vat_number: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Service Tax Number</label>
                    <input
                      type="text"
                      value={formData.service_tax_number}
                      onChange={(e) => setFormData({...formData, service_tax_number: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">PAN Number</label>
                    <input
                      type="text"
                      value={formData.pan_number}
                      onChange={(e) => setFormData({...formData, pan_number: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Supplier Type</label>
                    <select
                      value={formData.supplier_type}
                      onChange={(e) => setFormData({...formData, supplier_type: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="VENDOR">Vendor</option>
                      <option value="MANUFACTURER">Manufacturer</option>
                      <option value="DISTRIBUTOR">Distributor</option>
                      <option value="SERVICE_PROVIDER">Service Provider</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="BLACKLISTED">Blacklisted</option>
                      <option value="PENDING_APPROVAL">Pending Approval</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Address Line 1</label>
                    <input
                      type="text"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({...formData, address_line1: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Address Line 2</label>
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({...formData, address_line2: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">State/Province</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Postal Code</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Payment Terms (days)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({...formData, payment_terms: parseInt(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Credit Limit</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-fg">Circle</label>
                    <select
                      value={formData.circle_id}
                      onChange={(e) => setFormData({ ...formData, circle_id: e.target.value, cluster_id: '' })}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select Circle</option>
                      {circles.map(c => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Cluster</label>
                    <select
                      value={formData.cluster_id}
                      onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value })}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="">Select Cluster</option>
                      {clusters
                        .filter(cl => !formData.circle_id || cl.circle_id === parseInt(formData.circle_id))
                        .map(cl => (
                          <option key={cl.id} value={cl.id}>{cl.code} - {cl.name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Qualification</label>
                    <select
                      value={formData.qualification_status}
                      onChange={(e) => setFormData({ ...formData, qualification_status: e.target.value })}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2"
                    >
                      <option value="qualified">Qualified</option>
                      <option value="pending">Pending review</option>
                      <option value="blocked">Blocked</option>
                      <option value="disqualified">Disqualified</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg">Qualified until</label>
                    <input
                      type="date"
                      value={formData.qualified_until}
                      onChange={(e) => setFormData({ ...formData, qualified_until: e.target.value })}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-fg">Qualification notes</label>
                    <textarea
                      value={formData.qualification_notes}
                      onChange={(e) => setFormData({ ...formData, qualification_notes: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-fg">Rating</label>
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({...formData, rating: parseInt(e.target.value)})}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value={1}>1 Star</option>
                      <option value={2}>2 Stars</option>
                      <option value={3}>3 Stars</option>
                      <option value={4}>4 Stars</option>
                      <option value={5}>5 Stars</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingSupplier(null);
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
                    {editingSupplier ? 'Update' : 'Create'} Supplier
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Items Modal */}
      {showSupplierItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-default">
              <h2 className="text-lg font-semibold text-fg">
                {editingSupplierItem ? 'Edit Supplier Item' : 'Add Supplier Item'}
              </h2>
            </div>
            
            <form onSubmit={handleSupplierItemSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Item *
                  </label>
                  <select
                    required
                    value={supplierItemFormData.item_id}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, item_id: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select an item</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.item_code})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Supplier Item Code
                  </label>
                  <input
                    type="text"
                    value={supplierItemFormData.supplier_item_code}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, supplier_item_code: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Supplier Item Name
                  </label>
                  <input
                    type="text"
                    value={supplierItemFormData.supplier_item_name}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, supplier_item_name: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={supplierItemFormData.unit_price}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Currency
                  </label>
                  <select
                    value={supplierItemFormData.currency}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, currency: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Lead Time (days)
                  </label>
                  <input
                    type="number"
                    value={supplierItemFormData.lead_time_days}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, lead_time_days: parseInt(e.target.value) || 0 })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Minimum Order Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={supplierItemFormData.minimum_order_qty}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, minimum_order_qty: parseFloat(e.target.value) || 1 })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={supplierItemFormData.valid_from}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, valid_from: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Valid To
                  </label>
                  <input
                    type="date"
                    value={supplierItemFormData.valid_to}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, valid_to: e.target.value })}
                    className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Notes
                </label>
                <textarea
                  value={supplierItemFormData.notes}
                  onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={supplierItemFormData.is_preferred}
                    onChange={(e) => setSupplierItemFormData({ ...supplierItemFormData, is_preferred: e.target.checked })}
                    className="rounded border-default text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-fg">Preferred Supplier</span>
                </label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierItemModal(false);
                    setEditingSupplierItem(null);
                    resetSupplierItemForm();
                  }}
                  className="px-4 py-2 border border-default rounded-md text-fg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary transition-colors"
                >
                  {editingSupplierItem ? 'Update Supplier Item' : 'Add Supplier Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Modal */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-default">
              <h2 className="text-lg font-semibold text-fg">{editingPrice ? 'Edit Price' : 'Add Price'}</h2>
            </div>
            <form onSubmit={submitPrice} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Item *</label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={priceForm.item_id}
                      onChange={(e) => setPriceForm({ ...priceForm, item_id: e.target.value })}
                      className="flex-1 border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select an item</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.item_code})</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowItemPicker(true)}>Pick</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Vendor Item Code</label>
                  <input type="text" value={priceForm.supplier_item_code} onChange={(e)=>setPriceForm({...priceForm, supplier_item_code: e.target.value})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Vendor Item Name</label>
                  <input type="text" value={priceForm.supplier_item_name} onChange={(e)=>setPriceForm({...priceForm, supplier_item_name: e.target.value})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Unit Price</label>
                  <input type="number" step="0.01" value={priceForm.unit_price} onChange={(e)=>setPriceForm({...priceForm, unit_price: parseFloat(e.target.value)||0})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">GST %</label>
                  <input type="number" step="0.01" value={priceForm.gst_rate} onChange={(e)=>setPriceForm({...priceForm, gst_rate: parseFloat(e.target.value)||0})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">MOQ</label>
                  <input type="number" step="0.01" value={priceForm.min_quantity} onChange={(e)=>setPriceForm({...priceForm, min_quantity: parseFloat(e.target.value)||1})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Lead Time (days)</label>
                  <input type="number" value={priceForm.lead_time_days} onChange={(e)=>setPriceForm({...priceForm, lead_time_days: parseInt(e.target.value)||0})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">MRP</label>
                  <input type="number" step="0.01" value={priceForm.mrp} onChange={(e)=>setPriceForm({...priceForm, mrp: parseFloat(e.target.value)||0})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Valid From</label>
                  <input type="date" value={priceForm.valid_from} onChange={(e)=>setPriceForm({...priceForm, valid_from: e.target.value})} className="w-full border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button type="button" className="btn btn-secondary" onClick={()=>{setShowPriceModal(false); setEditingPrice(null);}}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingPrice ? 'Update Price' : 'Add Price'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ItemSelectionModal
        showModal={showItemPicker}
        setShowModal={setShowItemPicker}
        items={filteredItemsForPicker}
        itemSearchTerm={itemSearchTerm}
        setItemSearchTerm={setItemSearchTerm}
        selectItem={selectItemForPrice}
      />

      {/* Settings Modal */}
      {showSettingsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 lg:w-1/4 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Supplier Settings
                </h3>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedSupplier(null);
                  }}
                  className="text-muted hover:text-primary"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-fg mb-2">Supplier Details</h4>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-fg font-medium">{selectedSupplier.name}</div>
                  <div className="text-sm text-muted">{selectedSupplier.supplier_code}</div>
                  <div className="text-sm text-muted mt-1">
                    Status: <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      selectedSupplier.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : selectedSupplier.status === 'BLACKLISTED'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${
                        selectedSupplier.status === 'ACTIVE' ? 'bg-green-500' : 
                        selectedSupplier.status === 'BLACKLISTED' ? 'bg-red-500' : 'bg-gray-500'
                      }`}></span>
                      {selectedSupplier.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleToggleStatus(selectedSupplier.id, selectedSupplier.status)}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSupplier.status === 'ACTIVE' 
                      ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200' 
                      : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                  }`}
                >
                  {selectedSupplier.status === 'ACTIVE' ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Deactivate Supplier
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate Supplier
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDelete(selectedSupplier.id)}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Supplier
                </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-default">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSelectedSupplier(null);
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

export default SupplierManagementPage;
