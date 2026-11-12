import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { requisitionAPI, purchaseOrderAPI, procurementAPI, inventoryAPI, userManagementAPI, systemAPI } from '../../utils/api';
import { ArrowLeft, AlertTriangle, Save, Radio, Package, CheckSquare, Square, IndianRupee } from 'lucide-react';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';
import SupplierSelectModal from '../../components/inventory/SupplierSelectModal';

const PurchaseOrderGenerateFromPR = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: prId } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prDetails, setPrDetails] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [sites, setSites] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLines, setSelectedLines] = useState({});
  const [supplierPrices, setSupplierPrices] = useState({});
  const [txnCategories, setTxnCategories] = useState([]);
  const [transactionCategoryId, setTransactionCategoryId] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    supplier_id: '',
    site_id: '',
    warehouse_id: '',
    currency: 'INR',
    promised_date: '',
    circle_id: null,
    cluster_id: null,
    lines: []
  });
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  const getSiteDisplay = () => {
    if (!formData.site_id) return 'Site picked from PR';
    const s = sites.find(x => String(x.id) === String(formData.site_id));
    if (!s) return 'Site picked from PR';
    const code = s.site_code || s.code || '';
    return code ? `${s.name} (${code})` : s.name;
  };

  // Helper function to convert ISO date to yyyy-MM-dd
  const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (prId) {
      fetchPRData();
    } else {
      setError('No PR ID provided');
      setLoading(false);
    }
  }, [prId]);

  useEffect(() => {
    fetchItems();
    fetchSuppliers();
    fetchSites();
    fetchWarehouses();
    fetchDepartments();
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await inventoryAPI.getTransactionCategories(); if (res.ok) { const js = await res.json(); setTxnCategories(js.data || []); } } catch (_) {}
    })();
  }, []);

  // Fetch supplier prices when supplier is selected
  useEffect(() => {
    if (formData.supplier_id) {
      fetchSupplierPrices();
    } else {
      setSupplierPrices({});
    }
  }, [formData.supplier_id]);

  useEffect(() => {
    if (itemSearchTerm) {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(itemSearchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [itemSearchTerm, items]);

  // Filter suppliers when circle changes
  useEffect(() => {
    filterSuppliers();
  }, [formData.circle_id, suppliers]);

  // Filter warehouses when circle/cluster changes
  useEffect(() => {
    filterWarehouses();
  }, [formData.circle_id, formData.cluster_id, warehouses]);

  // Recalculate GST when supplier or circle changes
  useEffect(() => {
    if (formData.supplier_id && formData.circle_id && formData.lines.length > 0) {
      calculateGstForLines();
    }
  }, [formData.supplier_id, formData.circle_id]);

  const fetchPRData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await requisitionAPI.getRequisition(prId);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch PR details');
      }

      const data = await response.json();
      const pr = data.data || data;
      
      if (pr.status !== 'approved') {
        setError('This requisition is not approved yet');
        setLoading(false);
        return;
      }

      setPrDetails(pr);

      // Auto-fill form data from PR
      const lines = (pr.lines || []).map(line => ({
        requisition_line_id: line.id,
        item_id: line.item_id,
        item_code: line.item_code,
        item_name: line.item_name,
        item_description: line.item_description || '',
        manufacturer: line.manufacturer || '',
        spare_type: line.spare_type || '',
        brand: line.brand || '',
        model: line.model || '',
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unit_price || 0,
        gst_rate: line.gst_rate || 0,
        specifications: line.specifications || '',
        promised_date: formatDateForInput(line.needed_by_date || pr.needed_by_date)
      }));

      setFormData({
        title: `PO for PR ${pr.requisition_number || pr.id}`,
        description: pr.description || '',
        supplier_id: '',
        site_id: pr.site_id || '',
        warehouse_id: '',
        currency: 'INR',
        promised_date: formatDateForInput(pr.needed_by_date),
        circle_id: pr.circle_id || null,
        cluster_id: pr.cluster_id || null,
        lines: lines
      });

      // Select all lines by default
      const selected = {};
      lines.forEach((line, index) => {
        selected[index] = true;
      });
      setSelectedLines(selected);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching PR data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await inventoryAPI.getItems();
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
        setFilteredItems(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch items:', e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await procurementAPI.getSuppliers();
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
    }
  };

  const fetchSites = async () => {
    try {
      const response = await inventoryAPI.getSites();
      if (response.ok) {
        const data = await response.json();
        setSites(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch sites:', e);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await userManagementAPI.getDepartments();
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch departments:', e);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await inventoryAPI.getWarehouses();
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.data || []);
        setFilteredWarehouses(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch warehouses:', e);
    }
  };

  const fetchSupplierPrices = async () => {
    try {
      // First, get supplier's applied price list
      const appliedRes = await procurementAPI.getAppliedPriceList(formData.supplier_id);
      let priceMap = {};
      
      if (appliedRes.ok) {
        const appliedData = await appliedRes.json();
        const appliedList = appliedData.data;
        
        if (appliedList && appliedList.id) {
          // Fetch prices from applied price list
          const pricesRes = await procurementAPI.getItemPrices(appliedList.id);
          if (pricesRes.ok) {
            const pricesData = await pricesRes.json();
            (pricesData.data || pricesData.item_prices || []).forEach(item => {
              if (item.item_id) {
                priceMap[item.item_id] = {
                  unit_price: item.unit_price,
                  currency: item.currency || 'INR',
                  lead_time_days: item.lead_time_days,
                  gst_rate: item.gst_rate || 0
                };
              }
            });
          }
        }
      }
      
      // Fallback: if no applied list or no prices found, try supplier_items
      if (Object.keys(priceMap).length === 0) {
        const response = await procurementAPI.getSupplierItems(formData.supplier_id);
        if (response.ok) {
          const data = await response.json();
          (data.data || []).forEach(item => {
            if (item.item_id) {
              priceMap[item.item_id] = {
                unit_price: item.unit_price,
                currency: item.currency || 'INR',
                lead_time_days: item.lead_time_days
              };
            }
          });
        }
      }
      
      setSupplierPrices(priceMap);

      // Update line prices with supplier prices AND GST rates
      setFormData(prev => {
        const updatedLines = prev.lines.map(line => {
          if (line.item_id && priceMap[line.item_id]) {
            return {
              ...line,
              unit_price: priceMap[line.item_id].unit_price,
              gst_rate: priceMap[line.item_id].gst_rate || 0
            };
          }
          return line;
        });
        
        // Calculate GST breakdown after prices are updated
        if (formData.supplier_id && formData.circle_id) {
          // Use setTimeout to avoid race condition
          setTimeout(() => calculateGstForLines(updatedLines), 100);
        }
        
        return {
          ...prev,
          lines: updatedLines
        };
      });
    } catch (e) {
      console.error('Failed to fetch supplier prices:', e);
    }
  };
  
  const calculateGstForLines = async (lines = formData.lines) => {
    if (!formData.supplier_id || !formData.circle_id || lines.length === 0) {
      return;
    }
    
    try {
      const payload = {
        supplier_id: formData.supplier_id,
        delivery_circle_id: formData.circle_id,
        lines: lines.map(line => ({
          unit_price: line.unit_price || 0,
          quantity: line.quantity || 0,
          gst_rate: line.gst_rate || 0
        }))
      };
      
      const res = await procurementAPI.calculateGst(payload);
      if (res.ok) {
        const data = await res.json();
        const calculatedLines = data.data?.lines || [];
        
        setFormData(prev => ({
          ...prev,
          lines: prev.lines.map((line, idx) => {
            const calc = calculatedLines[idx];
            if (calc) {
              return {
                ...line,
                cgst: calc.cgst || 0,
                sgst: calc.sgst || 0,
                igst: calc.igst || 0,
                total_with_gst: calc.total_amount || 0
              };
            }
            return line;
          })
        }));
      }
    } catch (e) {
      console.error('Failed to calculate GST:', e);
    }
  };

  const filterSuppliers = async () => {
    // If no circle is selected, show all suppliers
    if (!formData.circle_id) {
      setFilteredSuppliers(suppliers);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('circle_id', formData.circle_id);
      
      const response = await procurementAPI.getSuppliers(params.toString());
      if (response.ok) {
        const data = await response.json();
        setFilteredSuppliers(data.data || []);
      } else {
        console.error('Failed to filter suppliers');
        setFilteredSuppliers(suppliers);
      }
    } catch (e) {
      console.error('Failed to filter suppliers:', e);
      setFilteredSuppliers(suppliers);
    }
  };

  const filterWarehouses = () => {
    if (!formData.circle_id && !formData.cluster_id) {
      setFilteredWarehouses(warehouses);
      return;
    }

    // Filter warehouses based on circle/cluster
    const filtered = warehouses.filter(warehouse => {
      if (formData.cluster_id) {
        return warehouse.cluster_id === parseInt(formData.cluster_id);
      } else if (formData.circle_id) {
        return warehouse.circle_id === parseInt(formData.circle_id);
      }
      return true;
    });
    setFilteredWarehouses(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineChange = async (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));
    
    // Recalculate GST when quantity, unit_price, or gst_rate changes
    if (['quantity', 'unit_price', 'gst_rate'].includes(field)) {
      // Small delay to let state update
      setTimeout(() => {
        if (formData.supplier_id && formData.circle_id) {
          calculateGstForLines();
        }
      }, 100);
    }
  };

  const toggleLineSelection = (index) => {
    setSelectedLines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleAllLines = () => {
    const allSelected = Object.keys(selectedLines).every(key => selectedLines[key]);
    const newSelection = {};
    formData.lines.forEach((_, index) => {
      newSelection[index] = !allSelected;
    });
    setSelectedLines(newSelection);
  };

  const calculateGST = (line) => {
    const baseAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
    const gstRate = parseFloat(line.gst_rate) || 0;
    
    // Use pre-calculated GST split from API if available
    let cgst = parseFloat(line.cgst) || 0;
    let sgst = parseFloat(line.sgst) || 0;
    let igst = parseFloat(line.igst) || 0;
    
    // Fallback: if not pre-calculated, calculate based on circles
    if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
      const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
      
      if (supplier && formData.circle_id && supplier.circle_id === parseInt(formData.circle_id)) {
        // Same circle - CGST + SGST
        cgst = gstRate / 2;
        sgst = gstRate / 2;
      } else {
        // Different circle - IGST
        igst = gstRate;
      }
    }

    const totalTaxAmount = baseAmount * (gstRate / 100);
    const totalAmount = baseAmount + totalTaxAmount;

    return {
      baseAmount,
      cgst, sgst, igst,
      cgstAmount: baseAmount * (cgst / 100),
      sgstAmount: baseAmount * (sgst / 100),
      igstAmount: baseAmount * (igst / 100),
      totalTaxAmount,
      totalAmount
    };
  };

  const calculateTotal = () => {
    let total = 0;
    formData.lines.forEach((line, index) => {
      if (selectedLines[index]) {
        const gstCalc = calculateGST(line);
        total += gstCalc.totalAmount;
      }
    });
    return total;
  };

  const getSelectedSupplierLabel = () => {
    if (!formData.supplier_id) return 'Select supplier';
    const s = suppliers.find((sup) => String(sup.id) === String(formData.supplier_id));
    if (!s) return 'Select supplier';
    return s.supplier_code ? `${s.name} (${s.supplier_code})` : s.name;
  };

  const addManualLine = () => {
    const newLine = {
      requisition_line_id: null,
      item_id: null,
      item_code: '',
      item_name: '',
      item_description: '',
      manufacturer: '',
      spare_type: '',
      quantity: 1,
      unit_of_measure: 'PCS',
      unit_price: 0,
      gst_rate: 0,
      brand: '',
      model: '',
      promised_date: ''
    };
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
  };

  const selectItem = (item) => {
    const newLine = {
      requisition_line_id: null,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      item_description: item.description || '',
      manufacturer: item.manufacturer || '',
      spare_type: item.spare_type || '',
      brand: item.brand || '',
      model: item.model || '',
      quantity: 1,
      unit_of_measure: item.unit_of_measure || 'PCS',
      unit_price: item.estimated_price || item.standard_cost || 0,
      gst_rate: item.gst_rate || 0,
      promised_date: formData.promised_date || ''
    };
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
    setShowItemModal(false);
    setItemSearchTerm('');
  };

  const removeLine = (index) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.title?.trim()) return setError('Title is required');
    if (!formData.supplier_id) return setError('Supplier is required');
    if (!transactionCategoryId) { setError('Category is required'); return; }
    
    // Filter only selected lines
    const selectedLinesArray = formData.lines.filter((_, index) => selectedLines[index]);
    
    if (selectedLinesArray.length === 0) return setError('At least one line item must be selected');
    
    for (let i = 0; i < selectedLinesArray.length; i++) {
      const ln = selectedLinesArray[i];
      if (!ln.item_name || !ln.item_name.trim()) return setError(`Selected line ${i + 1}: Item name is required`);
      const qty = parseFloat(ln.quantity);
      if (!(qty > 0)) return setError(`Selected line ${i + 1}: Quantity must be greater than 0`);
      const up = ln.unit_price === '' || ln.unit_price === undefined ? 0 : parseFloat(ln.unit_price);
      if (Number.isNaN(up) || up < 0) return setError(`Selected line ${i + 1}: Unit price must be 0 or more`);
    }

    try {
      setSubmitting(true);
      setError(null);
      
          const payload = {
        title: formData.title,
        description: formData.description,
        currency: formData.currency,
        promised_date: formData.promised_date || undefined,
        supplier_id: parseInt(formData.supplier_id),
        ...(formData.site_id ? { site_id: parseInt(formData.site_id) } : {}),
        ...(formData.warehouse_id ? { warehouse_id: parseInt(formData.warehouse_id) } : {}),
        ...(formData.circle_id ? { circle_id: parseInt(formData.circle_id) } : {}),
        ...(formData.cluster_id ? { cluster_id: parseInt(formData.cluster_id) } : {}),
        transaction_category_id: parseInt(transactionCategoryId),
        lines: selectedLinesArray.map(l => {
          const qty = Math.max(parseFloat(l.quantity) || 0, 0.01);
          return {
            requisition_line_id: l.requisition_line_id || null,
            item_id: l.item_id,
            item_code: l.item_code,
            item_name: l.item_name,
            item_description: l.item_description,
            manufacturer: l.manufacturer,
            spare_type: l.spare_type,
            brand: l.brand,
            model: l.model,
            quantity: qty,
            unit_of_measure: l.unit_of_measure,
            unit_price: l.unit_price ? parseFloat(l.unit_price) : 0,
            gst_rate: l.gst_rate ? parseFloat(l.gst_rate) : 0,
            cgst_rate: l.cgst ? parseFloat(l.cgst) : 0,
            sgst_rate: l.sgst ? parseFloat(l.sgst) : 0,
            igst_rate: l.igst ? parseFloat(l.igst) : 0,
            promised_date: l.promised_date || null
          };
        })
      };

      const res = await purchaseOrderAPI.createFromRequisition(prId, payload);
          if (!res.ok) {
            const err = await res.json();
        const serverMsg = err?.errors?.[0]?.msg || err?.message || 'Failed to create purchase order';
        throw new Error(serverMsg);
      }
      
      // Get the created PO data
      const data = await res.json();
      alert(`Purchase Order created successfully! PO Number: ${data.data.po_number}`);
      
      // Navigate to PO details with state to indicate source
      navigate(`/procurement/po/po-details/${data.data.id}`, { 
        state: { from: 'generate-from-pr', prId: prId } 
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !prDetails) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Error</h2>
            </div>
            <p className="text-muted mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/procurement/po/generate-from-pr')}
                className="btn btn-secondary"
              >
                Back to PR Selection
              </button>
              <button
                onClick={() => navigate('/procurement/pr/requisition-list')}
                className="btn btn-primary"
              >
                Back to PR List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (location.state?.from === 'pr-details') {
                navigate(`/procurement/pr/requisition-details/${prId}`);
              } else {
                navigate('/procurement/po/generate-from-pr');
              }
            }}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to PR Selection
          </button>
        <div>
            <h1 className="text-2xl font-bold text-fg">Generate PO from PR</h1>
            <p className="text-muted">
              Creating PO from PR #{prDetails?.requisition_number || prId}
              {prDetails?.title && ` - ${prDetails.title}`}
            </p>
          </div>
        </div>
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

      {/* PR Summary */}
      {prDetails && (
      <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Source Requisition Details</h3>
          </div>
        <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted">PR Number:</span>
                <span className="ml-2 font-medium">{prDetails.requisition_number}</span>
            </div>
              <div>
                <span className="text-muted">Department:</span>
                <span className="ml-2 font-medium">
                  {departments.find(d => d.id === prDetails.department_id)?.name || 'N/A'}
                </span>
      </div>
              <div>
                <span className="text-muted">Total Amount:</span>
                <span className="ml-2 font-medium">₹{parseFloat(prDetails.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Purchase Order Information</h3>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label required">Title</label>
              <input 
                name="title" 
                value={formData.title} 
                onChange={handleInputChange} 
                className="input" 
                required 
              />
            </div>
            <div>
              <label className="form-label required">Supplier</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  className="input flex-1 bg-muted cursor-pointer"
                  value={getSelectedSupplierLabel()}
                  onClick={() => setSupplierModalOpen(true)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSupplierModalOpen(true)}
                >
                  Select
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Site (from PR)</label>
              <select 
                name="site_id" 
                value={formData.site_id} 
                className="input bg-muted cursor-not-allowed"
                disabled
              >
                <option value="">
                  {getSiteDisplay()}
                </option>
              </select>
            </div>
            <div>
              <label className="form-label required">Warehouse</label>
              <select 
                name="warehouse_id" 
                value={formData.warehouse_id} 
                onChange={handleInputChange} 
                className="input"
                required
              >
                <option value="">Select warehouse</option>
                {filteredWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.warehouse_code && `(${w.warehouse_code})`}
                  </option>
                ))}
              </select>
              {(formData.circle_id || formData.cluster_id) && filteredWarehouses.length > 0 && (
                <p className="text-xs text-muted mt-1">
                  Showing warehouses mapped to selected {formData.cluster_id ? 'cluster' : 'circle'}
                </p>
              )}
              {(formData.circle_id || formData.cluster_id) && filteredWarehouses.length === 0 && (
                <p className="text-xs text-warning mt-1">
                  No warehouses mapped to selected {formData.cluster_id ? 'cluster' : 'circle'}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Currency</label>
              <input 
                name="currency" 
                value={formData.currency} 
                onChange={handleInputChange} 
                className="input" 
              />
            </div>
            <div>
              <label className="form-label">
                <Radio size={14} className="inline mr-1" />
                Telecom Circle
              </label>
              <CircleSelector
                value={formData.circle_id}
                onChange={(value) => setFormData({ ...formData, circle_id: value, cluster_id: null })}
                className="w-full"
              />
            </div>
            <div>
              <label className="form-label">
                <Radio size={14} className="inline mr-1" />
                Cluster
              </label>
              <ClusterSelector
                value={formData.cluster_id}
                onChange={(value) => setFormData({ ...formData, cluster_id: value })}
                circleId={formData.circle_id}
                className="w-full"
              />
            </div>
            <div>
              <label className="form-label">Promised Date</label>
              <input 
                type="date" 
                name="promised_date" 
                value={formData.promised_date} 
                onChange={handleInputChange} 
                className="input" 
              />
            </div>
            <div>
              <label className="form-label required">Category</label>
              <select className="input" value={transactionCategoryId} onChange={(e) => setTransactionCategoryId(e.target.value)} required>
                <option value="">Select category</option>
                {txnCategories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                className="input" 
                rows={3} 
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <button
              type="button"
              onClick={toggleAllLines}
              className="btn btn-secondary btn-sm"
            >
              {Object.keys(selectedLines).every(key => selectedLines[key]) ? (
                <>
                  <Square size={14} className="mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare size={14} className="mr-1" />
                  Select All
                </>
              )}
            </button>
                  </div>
          <div className="card-body">
            {formData.lines.length === 0 ? (
              <div className="text-center py-12">
                <Package size={48} className="text-muted mx-auto mb-4" />
                <p className="text-muted">No line items found</p>
                    </div>
            ) : (
              <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-12">
                        Select
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Item
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-32">
                        Manufacturer
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-24">
                        Quantity
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-28">
                        UOM
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-32">
                        Unit Price
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-20">
                        CGST
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-20">
                        SGST
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-20">
                        IGST
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-32">
                        Total
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-32">
                        Promised Date
                      </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                    {formData.lines.map((line, index) => {
                      const hasSupplierPrice = line.item_id && supplierPrices[line.item_id];
                      const isSelected = selectedLines[index];
                      const gstCalc = calculateGST(line);
                      
                            return (
                        <tr 
                          key={index}
                          className={`${!isSelected ? 'opacity-50' : ''} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected || false}
                              onChange={() => toggleLineSelection(index)}
                              className="w-4 h-4 cursor-pointer"
                            />
                                </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-fg">
                              {line.item_name}
                            </div>
                            <div className="text-sm text-muted">
                              {line.item_code && `Code: ${line.item_code}`}
                              {line.brand && ` | ${line.brand}`}
                              {line.model && ` | ${line.model}`}
                            </div>
                            {line.specifications && (
                              <div className="text-xs text-muted mt-1">
                                {line.specifications}
                              </div>
                            )}
                            {hasSupplierPrice && (
                              <div className="text-xs text-success mt-1">
                                ✓ Supplier price available
                                    </div>
                                  )}
                                </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-fg">
                              {line.manufacturer || '-'}
                            </div>
                            {line.spare_type && (
                              <div className="text-xs text-muted">
                                {line.spare_type}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  handleLineChange(index, 'quantity', '');
                                  return;
                                }
                                const numVal = Math.max(parseFloat(raw) || 0, 0.01);
                                handleLineChange(index, 'quantity', numVal);
                              }}
                              className="input input-sm w-full"
                              min="0.01"
                              step="0.01"
                              disabled={!isSelected}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={line.unit_of_measure}
                              onChange={(e) => handleLineChange(index, 'unit_of_measure', e.target.value)}
                              className="input input-sm w-full"
                              disabled={!isSelected}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className={`relative ${!hasSupplierPrice && formData.supplier_id ? 'opacity-40' : ''}`}>
                              <input
                                type="number"
                                value={line.unit_price}
                                onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                                className="input input-sm w-full bg-muted"
                                min="0"
                                step="0.01"
                                disabled={true}
                                readOnly={true}
                                title="Price from applied price list (read-only)"
                              />
                              {!hasSupplierPrice && formData.supplier_id && (
                                <div className="text-xs text-danger mt-1">
                                  No price
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="text-xs text-fg bg-muted rounded border border-default py-1 px-2">
                              {gstCalc.cgst > 0 ? `${gstCalc.cgst}%` : '-'}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="text-xs text-fg bg-muted rounded border border-default py-1 px-2">
                              {gstCalc.sgst > 0 ? `${gstCalc.sgst}%` : '-'}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="text-xs text-fg bg-muted rounded border border-default py-1 px-2">
                              {gstCalc.igst > 0 ? `${gstCalc.igst}%` : '-'}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-xs font-bold text-primary bg-accent rounded border border-default py-1 px-2 flex items-center justify-end">
                              <IndianRupee size={12} className="mr-1" />
                              {gstCalc.totalAmount.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="date"
                              value={line.promised_date}
                              onChange={(e) => handleLineChange(index, 'promised_date', e.target.value)}
                              className="input input-sm w-full"
                              disabled={!isSelected}
                            />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
              </div>
            )}
          </div>
        </div>

        {/* Total Summary */}
        {formData.lines.length > 0 && (
          <div className="card bg-muted/30">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted">
                    Selected Items: {Object.values(selectedLines).filter(Boolean).length} / {formData.lines.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted mb-1">Total PO Amount</p>
                  <p className="text-2xl font-bold text-fg">
                    ₹{calculateTotal().toFixed(2)}
                  </p>
                    </div>
                  </div>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <button 
            type="button" 
            onClick={() => {
              if (location.state?.from === 'pr-details') {
                navigate(`/procurement/pr/requisition-details/${prId}`);
              } else {
                navigate('/procurement/pr/requisition-list');
              }
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting || Object.values(selectedLines).filter(Boolean).length === 0 || !formData.supplier_id} 
            className="btn btn-primary"
          >
            <Save size={16} className="mr-2" />
            {submitting ? 'Creating PO...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>

      {/* Item Selection Modal */}
      <ItemSelectionModal
        showModal={showItemModal}
        setShowModal={setShowItemModal}
        items={filteredItems}
        itemSearchTerm={itemSearchTerm}
        setItemSearchTerm={setItemSearchTerm}
        selectItem={selectItem}
      />
      <SupplierSelectModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onSelect={(s) => {
          setFormData((prev) => ({
            ...prev,
            supplier_id: s.vendor_id ? String(s.vendor_id) : String(s.id || '')
          }));
        }}
      />
    </div>
  );
};

export default PurchaseOrderGenerateFromPR;
