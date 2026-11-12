import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Save, Radio, Package, CheckSquare, Square, IndianRupee, Plus } from 'lucide-react';
import { inventoryAPI, procurementAPI, purchaseOrderAPI } from '../../utils/api';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';
import SupplierSelectModal from '../../components/inventory/SupplierSelectModal';
import { useToastContext } from '../../contexts/ToastContext.jsx';

const PurchaseOrderCreatePage = () => {
  const navigate = useNavigate();
  const { add } = useToastContext() || { add: () => {} };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [sites, setSites] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [supplierPrices, setSupplierPrices] = useState({});
  const [txnCategories, setTxnCategories] = useState([]);
  const [selectedLines, setSelectedLines] = useState({});
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

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
    transaction_category_id: '',
    lines: []
  });

  useEffect(() => {
    fetchItems();
    fetchSuppliers();
    fetchSites();
    fetchWarehouses();
    fetchTxnCategories();
  }, []);

  // Fetch supplier prices when supplier is selected
  useEffect(() => {
    if (formData.supplier_id) {
      fetchSupplierPrices();
    } else {
      setSupplierPrices({});
    }
  }, [formData.supplier_id]);

  // Recalculate GST when supplier or circle changes
  useEffect(() => {
    if (formData.supplier_id && formData.circle_id && formData.lines.length > 0) {
      calculateGstForLines();
    }
  }, [formData.supplier_id, formData.circle_id]);

  // Filter suppliers when circle changes
  useEffect(() => {
    filterSuppliers();
  }, [formData.circle_id, suppliers]);

  // Filter warehouses when circle/cluster changes
  useEffect(() => {
    filterWarehouses();
  }, [formData.circle_id, formData.cluster_id, warehouses]);

  useEffect(() => {
    if (itemSearchTerm) {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        (item.company_code && item.company_code.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.spare_type && item.spare_type.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.brand && item.brand.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.model && item.model.toLowerCase().includes(itemSearchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [itemSearchTerm, items]);

  const fetchItems = async () => {
    try {
      // Fetch all items for selection
      const response = await inventoryAPI.getItems('limit=10000');
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

    const filtered = warehouses.filter(w => {
      if (formData.cluster_id) {
        return w.cluster_id === parseInt(formData.cluster_id);
      }
      if (formData.circle_id) {
        return w.circle_id === parseInt(formData.circle_id);
      }
      return true;
    });
    setFilteredWarehouses(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));

    // Keep GST split in sync with quantity/price/GST changes
    if (['quantity', 'unit_price', 'gst_rate'].includes(field)) {
      setTimeout(() => {
        if (formData.supplier_id && formData.circle_id) {
          calculateGstForLines();
        }
      }, 100);
    }
  };

  const addManualLine = () => {
    const newLine = {
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
      promised_date: '',
      isFromItemMaster: false
    };
    setFormData(prev => {
      const updatedLines = [...prev.lines, newLine];
      // auto-select new line
      setSelectedLines(prevSel => ({
        ...prevSel,
        [updatedLines.length - 1]: true
      }));
      if (prev.supplier_id && prev.circle_id) {
        setTimeout(() => calculateGstForLines(updatedLines), 100);
      }
      return { ...prev, lines: updatedLines };
    });
  };

  const selectItem = (item) => {
    const newLine = {
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
      unit_price: (supplierPrices[item.id]?.unit_price) ?? (item.estimated_price || item.standard_cost || 0),
      gst_rate: (supplierPrices[item.id]?.gst_rate) ?? (item.gst_rate || 0),
      promised_date: '',
      isFromItemMaster: true
    };
    setFormData(prev => {
      const updatedLines = [...prev.lines, newLine];
      // auto-select new line
      setSelectedLines(prevSel => ({
        ...prevSel,
        [updatedLines.length - 1]: true
      }));
      if (prev.supplier_id && prev.circle_id) {
        setTimeout(() => calculateGstForLines(updatedLines), 100);
      }
      return { ...prev, lines: updatedLines };
    });
    setShowItemModal(false);
    setItemSearchTerm('');
  };

  const removeLine = (index) => {
    setFormData(prev => {
      const newLines = prev.lines.filter((_, i) => i !== index);
      const newSelected = {};
      newLines.forEach((_, idx) => {
        newSelected[idx] = true;
      });
      setSelectedLines(newSelected);
      return {
        ...prev,
        lines: newLines
      };
    });
  };

  const fetchSupplierPrices = async () => {
    try {
      const appliedRes = await procurementAPI.getAppliedPriceList(formData.supplier_id);
      let priceMap = {};
      
      if (appliedRes.ok) {
        const appliedData = await appliedRes.json();
        const appliedList = appliedData.data;
        
        if (appliedList && appliedList.id) {
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
      
      setSupplierPrices(priceMap);

      // Update existing line prices with supplier prices
      setFormData(prev => ({
        ...prev,
        lines: prev.lines.map(line => {
          if (line.item_id && priceMap[line.item_id]) {
            return {
              ...line,
              unit_price: priceMap[line.item_id].unit_price,
              gst_rate: priceMap[line.item_id].gst_rate || 0
            };
          }
          return line;
        })
      }));
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

  const toggleLineSelection = (index) => {
    setSelectedLines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleAllLines = () => {
    const allSelected =
      Object.keys(selectedLines).length > 0 &&
      Object.keys(selectedLines).every(key => selectedLines[key]);
    const upd = {};
    formData.lines.forEach((_, idx) => {
      upd[idx] = !allSelected;
    });
    setSelectedLines(upd);
  };

  // Mirror Generate-from-PR GST calculation for display
  const calculateGST = (line) => {
    const baseAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
    const gstRate = parseFloat(line.gst_rate) || 0;

    // Use pre-calculated GST split from API if available
    let cgst = parseFloat(line.cgst) || 0;
    let sgst = parseFloat(line.sgst) || 0;
    let igst = parseFloat(line.igst) || 0;

    if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
      const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
      const deliverySite = sites.find(s => s.id === parseInt(formData.site_id));
      const deliveryCircleId = deliverySite?.circle_id || formData.circle_id;

      if (supplier && deliveryCircleId && supplier.circle_id === parseInt(deliveryCircleId)) {
        cgst = gstRate / 2;
        sgst = gstRate / 2;
      } else {
        igst = gstRate;
      }
    }

    const totalTaxAmount = baseAmount * (gstRate / 100);
    const totalAmount = baseAmount + totalTaxAmount;

    return {
      baseAmount,
      cgst,
      sgst,
      igst,
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
      if (selectedLines[index] !== false) {
        const gstCalc = calculateGST(line);
        total += gstCalc.totalAmount;
      }
    });
    return total;
  };

  const fetchTxnCategories = async () => {
    try {
      const res = await inventoryAPI.getTransactionCategories();
      if (res.ok) {
        const js = await res.json();
        setTxnCategories(js.data || []);
      }
    } catch (_) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation aligned to backend
    if (!formData.title?.trim()) return setError('Title is required');
    if (!formData.supplier_id) return setError('Supplier is required');
    if (!formData.transaction_category_id) return setError('Category is required');
    if (formData.lines.length === 0) return setError('At least one line item is required');
    for (let i = 0; i < formData.lines.length; i++) {
      const ln = formData.lines[i];
      if (!ln.item_name || !ln.item_name.trim()) return setError(`Line ${i + 1}: Item name is required`);
      const qty = parseFloat(ln.quantity);
      if (!(qty > 0)) return setError(`Line ${i + 1}: Quantity must be a positive number`);
      const up = ln.unit_price === '' || ln.unit_price === undefined ? 0 : parseFloat(ln.unit_price);
      if (Number.isNaN(up) || up < 0) return setError(`Line ${i + 1}: Unit price must be 0 or more`);
    }
    try {
      setLoading(true);
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
        transaction_category_id: parseInt(formData.transaction_category_id),
        lines: formData.lines
          .filter((_, idx) => selectedLines[idx] !== false)
          .map(l => {
        const qty = Math.max(parseFloat(l.quantity) || 0, 0.01);
        return {
          item_id: l.item_id,
          item_code: l.item_code,
          item_name: l.item_name,
          item_description: l.item_description,
          manufacturer: l.manufacturer || null,
          spare_type: l.spare_type || null,
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
      const res = await purchaseOrderAPI.createPO(payload);
      if (!res.ok) {
        const err = await res.json();
        // Surface specific validation errors if available
        const serverMsg = err?.errors?.[0]?.msg || err?.message || 'Failed to create purchase order';
        throw new Error(serverMsg);
      }
      add('Purchase Order draft created', 'success');
      navigate('/procurement/po/po-list');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedSupplierLabel = () => {
    if (!formData.supplier_id) return 'Select supplier';
    const s = suppliers.find((sup) => String(sup.id) === String(formData.supplier_id));
    if (!s) return 'Select supplier';
    return s.supplier_code ? `${s.name} (${s.supplier_code})` : s.name;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Create Purchase Order</h1>
        <p className="text-muted">Create a new purchase order</p>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label required">Title</label>
              <input name="title" value={formData.title} onChange={handleInputChange} className="input" required />
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
              <label className="form-label">Site</label>
              <select
                name="site_id"
                value={formData.site_id}
                onChange={handleInputChange}
                className="input"
              >
                <option value="">Select site</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Warehouse</label>
              <select name="warehouse_id" value={formData.warehouse_id} onChange={handleInputChange} className="input">
                <option value="">Select warehouse</option>
                {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Currency</label>
              <input name="currency" value={formData.currency} onChange={handleInputChange} className="input" />
            </div>
            <div>
              <label className="form-label">Promised Date</label>
              <input type="date" name="promised_date" value={formData.promised_date} onChange={handleInputChange} className="input" />
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
              <label className="form-label required">Category</label>
              <select
                name="transaction_category_id"
                value={formData.transaction_category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, transaction_category_id: e.target.value }))}
                className="input"
                required
              >
                <option value="">Select category</option>
                {txnCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} className="input" rows={3} />
            </div>
          </div>
        </div>

        {/* Line Items – aligned with Generate-from-PR */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addManualLine}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={14} className="mr-1" />
                Add Manual
              </button>
              <button
                type="button"
                onClick={() => setShowItemModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} className="mr-1" />
                Select Item
              </button>
              {formData.lines.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllLines}
                  className="btn btn-secondary btn-sm"
                >
                  {Object.keys(selectedLines).length > 0 &&
                  Object.keys(selectedLines).every(key => selectedLines[key]) ? (
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
              )}
            </div>
          </div>
          <div className="card-body">
            {formData.lines.length === 0 ? (
              <div className="text-center py-12">
                <Package size={48} className="text-muted mx-auto mb-4" />
                <p className="text-muted">No line items added yet</p>
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
                      const isSelected = selectedLines[index] !== false;
                      const gstCalc = calculateGST(line);

                      return (
                        <tr
                          key={index}
                          className={`${!isSelected ? 'opacity-50' : ''} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLineSelection(index)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-fg">
                              {line.item_name || 'Manual item'}
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
                                disabled
                                readOnly
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
                              value={line.promised_date || ''}
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

        {formData.lines.length > 0 && (
          <div className="card bg-muted/30">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted">
                    Selected Items:{' '}
                    {Object.entries(selectedLines).filter(([, v]) => v !== false).length} / {formData.lines.length}
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

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/procurement/po/po-list')} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || formData.lines.length === 0 || !formData.supplier_id} className="btn btn-primary">
            <Save size={16} className="mr-2" />
            {loading ? 'Creating...' : 'Create PO'}
          </button>
        </div>

        {/* Bottom-right action bar */}
        <div className="flex justify-end gap-3 sticky bottom-4 mt-6">
          <button type="button" onClick={() => navigate('/procurement/po/po-list')} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || formData.lines.length === 0 || !formData.supplier_id} className="btn btn-primary">
            <Save size={16} className="mr-2" />
            {loading ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </form>

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

export default PurchaseOrderCreatePage;


