import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Save, Radio, IndianRupee, Package, Plus, X } from 'lucide-react';
import { inventoryAPI, procurementAPI, purchaseOrderAPI } from '../../utils/api';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';
import SupplierSelectModal from '../../components/inventory/SupplierSelectModal';
import { useToastContext } from '../../contexts/ToastContext.jsx';

const PurchaseOrderEditPage = () => {
  const { id } = useParams();
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
    status: 'draft',
    lines: []
  });

  const loadPO = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await purchaseOrderAPI.getPO(id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load PO');
      const po = data.data || data;
      if (po.status !== 'draft') {
        setError('Only draft purchase orders can be edited');
        return;
      }
      setFormData({
        title: po.title || '',
        description: po.description || '',
        supplier_id: po.supplier_id ? String(po.supplier_id) : '',
        site_id: po.site_id ? String(po.site_id) : '',
        warehouse_id: po.warehouse_id ? String(po.warehouse_id) : '',
        currency: po.currency || 'INR',
        promised_date: po.promised_date ? String(po.promised_date).slice(0, 10) : '',
        circle_id: po.circle_id || null,
        cluster_id: po.cluster_id || null,
        status: po.status,
        lines: (po.lines || []).map(l => ({
          id: l.id,
          requisition_line_id: l.requisition_line_id || null,
          item_id: l.item_id || null,
          item_code: l.item_code || '',
          item_name: l.item_name || '',
          item_description: l.item_description || '',
          manufacturer: l.manufacturer || '',
          spare_type: l.spare_type || '',
          brand: l.brand || '',
          model: l.model || '',
          quantity: Number(l.quantity || 0),
          unit_of_measure: l.unit_of_measure || 'PCS',
          unit_price: Number(l.unit_price || 0),
          gst_rate: Number(l.gst_rate || 0),
          // Preserve existing GST split from backend so UI & summary stay in sync
          cgst: Number(l.cgst_rate || 0),
          sgst: Number(l.sgst_rate || 0),
          igst: Number(l.igst_rate || 0),
          promised_date: l.promised_date ? String(l.promised_date).slice(0, 10) : ''
        }))
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // bootstrap
    loadPO();
    fetchItems();
    fetchSuppliers();
    fetchSites();
    fetchWarehouses();
  }, [id]);

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
  useEffect(() => { filterSuppliers(); }, [formData.circle_id, suppliers]);
  // Filter warehouses when circle/cluster changes
  useEffect(() => { filterWarehouses(); }, [formData.circle_id, formData.cluster_id, warehouses]);

  // Fetch supplier prices when supplier changes (draft only)
  useEffect(() => {
    if (formData.status === 'draft' && formData.supplier_id) {
      fetchSupplierPrices();
    } else {
      setSupplierPrices({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.supplier_id]);

  const fetchItems = async () => {
    try {
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
    if (!formData.circle_id && !formData.cluster_id) { setFilteredWarehouses(warehouses); return; }
    let filtered = warehouses;
    if (formData.cluster_id) filtered = warehouses.filter(w => w.cluster_id === parseInt(formData.cluster_id));
    else if (formData.circle_id) filtered = warehouses.filter(w => w.circle_id === parseInt(formData.circle_id));
    // ensure selected remains in list
    if (formData.warehouse_id && !filtered.some(w => String(w.id) === String(formData.warehouse_id))) {
      const selectedWh = warehouses.find(w => String(w.id) === String(formData.warehouse_id));
      if (selectedWh) filtered = [selectedWh, ...filtered];
    }
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

    // Recalculate GST split when quantity, price or GST rate changes
    if (['quantity', 'unit_price', 'gst_rate'].includes(field)) {
      setTimeout(() => {
        if (formData.status === 'draft' && formData.supplier_id && formData.circle_id) {
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
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
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
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
    setShowItemModal(false);
    setItemSearchTerm('');
  };

  const removeLine = (index) => {
    setFormData(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };

  // Use backend GST calculator to derive CGST/SGST/IGST split for all lines
  const calculateGstForLines = async (lines = formData.lines) => {
    if (
      formData.status !== 'draft' ||
      !formData.supplier_id ||
      !formData.circle_id ||
      !Array.isArray(lines) ||
      lines.length === 0
    ) {
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
      if (!res.ok) return;
      const data = await res.json();
      const calculatedLines = data?.data?.lines || [];

      setFormData(prev => ({
        ...prev,
        lines: prev.lines.map((line, idx) => {
          const calc = calculatedLines[idx];
          if (!calc) return line;
          return {
            ...line,
            cgst: calc.cgst || 0,
            sgst: calc.sgst || 0,
            igst: calc.igst || 0,
            total_with_gst: calc.total_amount || 0
          };
        })
      }));
    } catch (e) {
      console.error('Failed to calculate GST for PO edit:', e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.status !== 'draft') { setError('Only draft purchase orders can be updated'); return; }
    // basic validation
    if (!formData.title?.trim()) return setError('Title is required');
    if (!formData.supplier_id) return setError('Supplier is required');
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
        lines: formData.lines.map(l => {
          const qty = Math.max(parseFloat(l.quantity) || 0, 0.01);
          return {
            requisition_line_id: l.requisition_line_id || null,
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
            // Pass split GST rates so backend can compute amounts correctly
            cgst_rate: l.cgst ? parseFloat(l.cgst) : 0,
            sgst_rate: l.sgst ? parseFloat(l.sgst) : 0,
            igst_rate: l.igst ? parseFloat(l.igst) : 0,
            promised_date: l.promised_date || null
          };
        })
      };
      const res = await purchaseOrderAPI.updatePO(id, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const serverMsg = err?.errors?.[0]?.msg || err?.message || 'Failed to update purchase order';
        throw new Error(serverMsg);
      }
      add('Purchase Order updated', 'success');
      navigate(`/procurement/po/po-details/${id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const supplierCircleId = (() => {
    const s = suppliers.find(s => String(s.id) === String(formData.supplier_id));
    return s?.circle_id || null;
  })();

  const getSelectedSupplierLabel = () => {
    if (!formData.supplier_id) return 'Select supplier';
    const s = suppliers.find((sup) => String(sup.id) === String(formData.supplier_id));
    if (!s) return 'Select supplier';
    return s.supplier_code ? `${s.name} (${s.supplier_code})` : s.name;
  };

  // Calculate GST split and totals similar to Generate-from-PR UI.
  // If backend-provided split (cgst/sgst/igst) is present on the line, use it;
  // otherwise fall back to circle-based logic.
  const calculateGST = (line) => {
    const qty = Number(line.quantity || 0);
    const unit = Number(line.unit_price || 0);
    const baseAmount = qty * unit;
    const gstRate = Number(line.gst_rate || 0);

    // Prefer already-split GST from backend if available
    let cgst = Number(line.cgst || 0);
    let sgst = Number(line.sgst || 0);
    let igst = Number(line.igst || 0);

    // Fallback: split GST based on supplier vs delivery circle
    if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
      const isSameCircle =
        supplierCircleId &&
        formData.circle_id &&
        Number(supplierCircleId) === Number(formData.circle_id);

      if (isSameCircle) {
        cgst = gstRate / 2;
        sgst = gstRate / 2;
        igst = 0;
      } else {
        cgst = 0;
        sgst = 0;
        igst = gstRate;
      }
    }

    const cgstAmount = (baseAmount * cgst) / 100;
    const sgstAmount = (baseAmount * sgst) / 100;
    const igstAmount = (baseAmount * igst) / 100;
    const totalAmount = baseAmount + cgstAmount + sgstAmount + igstAmount;
    return { baseAmount, cgst, sgst, igst, cgstAmount, sgstAmount, igstAmount, totalAmount };
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

      // Fallback to supplier items if no applied list found
      if (Object.keys(priceMap).length === 0) {
        const response = await procurementAPI.getSupplierItems(formData.supplier_id);
        if (response.ok) {
          const data = await response.json();
          (data.data || []).forEach(item => {
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

      setSupplierPrices(priceMap);

      // Update existing line prices with supplier prices for matching items
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

        // After updating prices/GST rate, recompute GST split via backend
        if (prev.status === 'draft' && prev.supplier_id && prev.circle_id && updatedLines.length > 0) {
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

  if (loading && !formData.title) {
    return (
      <div className="space-y-6">
        <div className="card"><div className="card-body"><div className="animate-pulse h-32 bg-muted rounded" /></div></div>
      </div>
    );
  }

  if (error && formData.status !== 'draft') {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4"><AlertTriangle size={20} /><h2 className="text-lg font-semibold">Cannot Edit Purchase Order</h2></div>
            <p className="text-muted mb-4">{error}</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/procurement/po/po-list')} className="btn btn-secondary">Back to List</button>
              <button onClick={() => navigate(`/procurement/po/po-details/${id}`)} className="btn btn-primary">View Details</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Edit Purchase Order</h1>
        <p className="text-muted">Update purchase order #{id}</p>
      </div>

      {error && formData.status === 'draft' && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger"><AlertTriangle size={16} /><span>{error}</span></div>
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
              <label className="form-label">Site (from PR)</label>
              <select
                name="site_id"
                value={formData.site_id}
                className="input bg-muted cursor-not-allowed"
                disabled
              >
                <option value="">
                  {(() => {
                    const s = sites.find(x => String(x.id) === String(formData.site_id));
                    return s ? s.name : 'Site picked from PR';
                  })()}
                </option>
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
              <label className="form-label"><Radio size={14} className="inline mr-1" />Telecom Circle</label>
              <CircleSelector value={formData.circle_id} onChange={(value) => setFormData({ ...formData, circle_id: value, cluster_id: null })} className="w-full" />
            </div>
            <div>
              <label className="form-label"><Radio size={14} className="inline mr-1" />Cluster</label>
              <ClusterSelector value={formData.cluster_id} onChange={(value) => setFormData({ ...formData, cluster_id: value })} circleId={formData.circle_id} className="w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} className="input" rows={3} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={addManualLine}>
                <Plus size={14} className="mr-1" /> Add Manual
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowItemModal(true)}>
                <Plus size={14} className="mr-1" /> Select Item
              </button>
            </div>
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Manufacturer</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase w-24">Quantity</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase w-24">UOM</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase w-28">Unit Price</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase w-20">CGST</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase w-20">SGST</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase w-20">IGST</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase w-32">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase w-32">Promised Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase w-16"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {formData.lines.map((line, index) => {
                      const priceInfo = line.item_id ? supplierPrices[line.item_id] : null;
                      const hasSupplierPrice = Boolean(priceInfo);
                      const gstCalc = calculateGST(line);
                      return (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-3">
                            <div className="font-medium text-fg">{line.item_name || `Item #${line.item_id || ''}`}</div>
                            <div className="text-sm text-muted">{line.item_code || ''}{line.brand ? ` | ${line.brand}` : ''}{line.model ? ` | ${line.model}` : ''}</div>
                            {hasSupplierPrice && (
                              <div className="text-xs text-success mt-1">✓ Supplier price available</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-fg">{line.manufacturer || '-'}</div>
                            {line.spare_type && <div className="text-xs text-muted">{line.spare_type}</div>}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                              className="input input-sm w-full"
                              min="0.001"
                              step="0.001"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={line.unit_of_measure}
                              onChange={(e) => handleLineChange(index, 'unit_of_measure', e.target.value)}
                              className="input input-sm w-full"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className={`relative ${!hasSupplierPrice && formData.supplier_id ? 'opacity-40' : ''}`}>
                              <input
                                type="number"
                                value={line.unit_price}
                                onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                                className={`input input-sm w-full ${hasSupplierPrice ? 'bg-muted' : ''}`}
                                min="0"
                                step="0.01"
                                disabled={hasSupplierPrice}
                                readOnly={hasSupplierPrice}
                                title={hasSupplierPrice ? 'Price from applied price list (read-only)' : 'Enter unit price'}
                              />
                              {!hasSupplierPrice && formData.supplier_id && (
                                <div className="text-xs text-danger mt-1">No price</div>
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
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(index)} title="Remove">
                              <X size={14} />
                            </button>
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
                <div className="text-sm text-muted">Total PO Amount</div>
                <div className="text-2xl font-bold text-fg">
                  {(() => {
                    const sum = formData.lines.reduce((acc, l) => acc + calculateGST(l).totalAmount, 0);
                    return `₹${sum.toFixed(2)}`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(`/procurement/po/po-details/${id}`)} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || formData.lines.length === 0 || !formData.supplier_id} className="btn btn-primary">
            <Save size={16} className="mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
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

export default PurchaseOrderEditPage;


