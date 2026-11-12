import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Radio, Warehouse, FileSearch, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { goodsReceiptAPI, purchaseOrderAPI, inventoryAPI } from '../../utils/api';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';

const GoodsReceiptCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { add } = useToastContext() || { add: () => {} };
  const [form, setForm] = useState({ purchase_order_id: '', supplier_id: '', warehouse_id: '', bin_id: '', site_id: '', remarks: '', circle_id: null, cluster_id: null });
  const [poSearch, setPoSearch] = useState('');
  const [poOptions, setPoOptions] = useState([]);
  const [showPoModal, setShowPoModal] = useState(false);
  const [poLoading, setPoLoading] = useState(false);
  const [poError, setPoError] = useState(null);
  const [poPage, setPoPage] = useState(1);
  const [poPagination, setPoPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [lines, setLines] = useState([{ item_name: '', qty_as_per_po: '', already_received: '', expected_qty: '', received_qty: '', unit_of_measure: 'PCS', unit_price: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [poPicked, setPoPicked] = useState(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const poIdFromQuery = searchParams.get('poId') || searchParams.get('purchase_order_id');

  useEffect(() => {
    if (!poIdFromQuery || !warehouses.length) return;
    const poId = Number(poIdFromQuery);
    if (!Number.isInteger(poId) || poId <= 0) return;
    if (String(form.purchase_order_id) === String(poId)) return;
    handlePickPO({ id: poId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill once when PO deep-linked and warehouses are ready
  }, [poIdFromQuery, warehouses.length]);

  useEffect(() => {
    filterWarehouses();
  }, [form.circle_id, form.cluster_id, warehouses]);

  // Load bins for selected warehouse
  useEffect(() => {
    const loadBins = async () => {
      try {
        if (!form.warehouse_id) { setBins([]); return; }
        const res = await inventoryAPI.getWarehouseBins(form.warehouse_id);
        const data = await res.json();
        if (res.ok) setBins(data.data || []); else setBins([]);
      } catch { setBins([]); }
    };
    loadBins();
  }, [form.warehouse_id]);

  const fetchWarehouses = async () => {
    try {
      const res = await inventoryAPI.getWarehouses();
      const data = await res.json();
      if (res.ok) {
        setWarehouses(data.data || []);
        setFilteredWarehouses(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch warehouses:', e);
    }
  };

  const filterWarehouses = () => {
    let filtered = warehouses;
    if (form.cluster_id) {
      filtered = warehouses.filter(warehouse => String(warehouse.cluster_id) === String(form.cluster_id));
    } else if (form.circle_id) {
      filtered = warehouses.filter(warehouse => String(warehouse.circle_id) === String(form.circle_id));
    }
    // Ensure selected warehouse appears in list even if it doesn't match filter metadata
    if (form.warehouse_id && !filtered.some(w => String(w.id) === String(form.warehouse_id))) {
      const selectedWh = warehouses.find(w => String(w.id) === String(form.warehouse_id));
      if (selectedWh) filtered = [selectedWh, ...filtered];
    }
    setFilteredWarehouses(filtered);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleLineChange = (idx, key, value) => {
    const newLines = [...lines];
    newLines[idx][key] = value;
    setLines(newLines);
  };
  const addLine = () => setLines([...lines, { item_name: '', qty_as_per_po: '', already_received: '', expected_qty: '', received_qty: '', unit_of_measure: 'PCS', unit_price: '' }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));

  const openPoModal = async () => {
    setShowPoModal(true);
    await loadPoOptions(1);
  };
  const closePoModal = () => setShowPoModal(false);

  const loadPoOptions = async (page = 1) => {
    try {
      setPoLoading(true);
      setPoError(null);
      const qs = `status=issued&receiving=open${poSearch ? `&search=${encodeURIComponent(poSearch)}` : ''}&include=lines&page=${page}&limit=${poPagination.limit || 10}`;
      const res = await purchaseOrderAPI.getPOs(qs);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load POs');
      setPoOptions(data.data || []);
      setPoPagination(data.pagination || { page: page, limit: 10, total: 0, totalPages: 0 });
      setPoPage(page);
    } catch (e) {
      setPoError(e.message);
    } finally {
      setPoLoading(false);
    }
  };

  const handlePickPO = async (po) => {
    setPoPicked(po);
    try {
      // Always fetch full PO to get site, circle/cluster and received quantities per line
      const res = await purchaseOrderAPI.getPO(po.id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch PO');
      const poData = data.data || data;

      // Merge into visible banner state as well (for site code/name)
      setPoPicked({
        ...po,
        ...poData,
        site_name: poData.site_name || po.site_name || poData.site?.name,
        site_code: poData.site_code || po.site_code || poData.site?.site_code,
        site: poData.site || po.site
      });

      // Prefill header fields from PO
      setForm(prev => ({
        ...prev,
        purchase_order_id: poData.id,
        supplier_id: poData.supplier_id || '',
        warehouse_id: poData.warehouse_id || '',
        site_id: poData.site_id || '',
        circle_id: poData.circle_id || null,
        cluster_id: poData.cluster_id || null
      }));

      // Filter warehouses by circle/cluster and include selected warehouse
      try {
        const circleId = poData.circle_id || null;
        const clusterId = poData.cluster_id || null;
        let filtered = warehouses;
        if (clusterId) filtered = warehouses.filter(w => String(w.cluster_id) === String(clusterId));
        else if (circleId) filtered = warehouses.filter(w => String(w.circle_id) === String(circleId));
        if (poData.warehouse_id && !filtered.some(w => String(w.id) === String(poData.warehouse_id))) {
          const selectedWh = warehouses.find(w => String(w.id) === String(poData.warehouse_id));
          if (selectedWh) filtered = [selectedWh, ...filtered];
        }
        setFilteredWarehouses(filtered);
      } catch {}

      // Map lines with PO linkage and computed quantities
      const mapped = (poData.lines || []).map(l => {
        const qtyAsPerPO = Number(l.quantity || 0);
        const alreadyReceived = Number(l.received_quantity || 0);
        const expected = Math.max(qtyAsPerPO - alreadyReceived, 0);
        return ({
          po_line_id: l.id,
          item_id: l.item_id || null,
          item_code: l.item_code || '',
          item_name: l.item_name,
          qty_as_per_po: qtyAsPerPO,
          already_received: alreadyReceived,
          expected_qty: expected,
          received_qty: '',
          unit_of_measure: l.unit_of_measure || 'PCS',
          unit_price: l.unit_price || 0,
          manufacturer: l.manufacturer || null,
          spare_type: l.spare_type || null
        });
      });
      setLines(mapped);
    } catch (e) {
      setError(e.message);
      return;
    }
    closePoModal();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        purchase_order_id: Number(form.purchase_order_id),
        supplier_id: Number(form.supplier_id),
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        site_id: form.site_id ? Number(form.site_id) : undefined,
        remarks: form.remarks || undefined,
        ...(form.circle_id ? { circle_id: Number(form.circle_id) } : {}),
        ...(form.cluster_id ? { cluster_id: Number(form.cluster_id) } : {}),
        lines: lines.map(l => {
          const recv = Math.max(parseInt(l.received_qty, 10) || 0, 0);
          return {
            po_line_id: l.po_line_id || null,
            item_id: l.item_id || null,
            item_code: l.item_code || undefined,
            item_name: l.item_name,
            received_qty: recv,
            accepted_qty: recv, // accepted equals received per simplified flow
            rejected_qty: 0,
            unit_of_measure: l.unit_of_measure || 'PCS',
            unit_price: Number(l.unit_price || 0),
            manufacturer: l.manufacturer || undefined,
            spare_type: l.spare_type || undefined
          };
        })
      };
      const res = await goodsReceiptAPI.createGRN(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create GRN');
      add('GRN draft created', 'success');
      navigate(`/procurement/grn/grn-details/${data.data.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg">Create Goods Receipt</h1>
        <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating…' : 'Create GRN'}</button>
      </div>

      {error && (
        <div className="card border-l-4 border-red-500 bg-red-50">
          <div className="card-body flex items-start gap-3 text-red-700">
            <AlertTriangle size={18} />
            <div>
              <div className="font-semibold">Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Selected PO Banner */}
      {poPicked && (
        <div className="card">
          <div className="card-body flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm text-muted">Selected PO</div>
              <div className="font-medium text-fg">{poPicked.po_number} — {poPicked.title}</div>
              <div className="text-sm text-muted">Supplier: {poPicked.supplier_name || poPicked.supplier_id} · Receiving: {Number(poPicked.received_quantity || 0)}/{Number(poPicked.total_quantity || 0)}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPoPicked(null); setForm({ purchase_order_id: '', supplier_id: '', warehouse_id: '', site_id: '', remarks: '', circle_id: null, cluster_id: null }); setLines([{ item_name: '', qty_as_per_po: '', already_received: '', expected_qty: '', received_qty: '', unit_of_measure: 'PCS', unit_price: '' }]); }}>
              <X size={16} className="mr-2" /> Change PO
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="form-label">Select PO</label>
            <div className="flex gap-2">
              <button type="button" onClick={openPoModal} className="btn btn-secondary">
                <FileSearch size={16} className="mr-2" /> Open PO Search
              </button>
              {form.purchase_order_id && (
                <span className="text-sm text-muted">Selected PO ID: {form.purchase_order_id}</span>
              )}
            </div>
          </div>
          {/* Auto-filled fields - read-only to prevent accidental edits */}
          <div>
            <label className="form-label">PO Number</label>
            <input value={poPicked?.po_number || ''} className="input" readOnly />
          </div>
          <div>
            <label className="form-label">Supplier</label>
            <input value={poPicked?.supplier_name || (form.supplier_id ? `#${form.supplier_id}` : '')} className="input" readOnly />
          </div>
          <div>
            <label className="form-label">Site</label>
            <input value={(() => {
              if (!poPicked) return form.site_id ? `#${form.site_id}` : '';
              const sObj = poPicked.site || {};
              const code = poPicked.site_code || sObj.site_code;
              const name = poPicked.site_name || sObj.name;
              if (name && code) return `${code} — ${name}`;
              if (name) return name;
              if (form.site_id) return `#${form.site_id}`;
              return '';
            })()} className="input" readOnly />
          </div>
          <div>
            <label className="form-label required">
              <Warehouse size={14} className="inline mr-1" />
              Warehouse
            </label>
            <select 
              name="warehouse_id" 
              value={form.warehouse_id} 
              onChange={handleChange} 
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
          </div>
          <div>
            <label className="form-label"><Radio size={14} className="inline mr-1" /> Telecom Circle</label>
            <CircleSelector
              value={form.circle_id}
              onChange={(value) => setForm({ ...form, circle_id: value, cluster_id: null })}
              className="w-full"
            />
          </div>
          <div>
            <label className="form-label"><Radio size={14} className="inline mr-1" /> Cluster</label>
            <ClusterSelector
              value={form.cluster_id}
              onChange={(value) => setForm({ ...form, cluster_id: value })}
              circleId={form.circle_id}
              className="w-full"
            />
          </div>
          <div>
            <label className="form-label">Bin (optional)</label>
            <select 
              name="bin_id" 
              value={form.bin_id} 
              onChange={handleChange} 
              className="input"
            >
              <option value="">No bin (warehouse only)</option>
              {bins.map(b => (
                <option key={b.id} value={b.id}>{b.bin_code || `Bin #${b.id}`}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} className="input" required />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="text-lg font-semibold">Lines</h3></div>
          <div className="card-body space-y-4">
          {lines.map((l, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
              <div>
                <label className="form-label">Item</label>
                <div className="font-medium text-fg">{l.item_name}</div>
                {l.item_code && <div className="text-xs text-muted">{l.item_code}</div>}
              </div>
              <div>
                <label className="form-label">Qty as per PO</label>
                <input value={l.qty_as_per_po_snapshot ?? l.qty_as_per_po ?? ''} readOnly className="input bg-muted" />
              </div>
              <div>
                <label className="form-label">Already Received</label>
                <input value={l.already_received_snapshot ?? l.already_received ?? ''} readOnly className="input bg-muted" />
              </div>
              <div>
                <label className="form-label">Expected Qty</label>
                <input value={l.expected_qty_snapshot ?? l.expected_qty ?? ''} readOnly className="input bg-muted" />
              </div>
              <div>
                <label className="form-label">Received Qty</label>
                <input
                  type="number"
                  value={l.received_qty}
                  onChange={e => {
                    const raw = e.target.value;
                    if (raw === '') {
                      handleLineChange(idx, 'received_qty', '');
                      return;
                    }
                    const numVal = Math.max(parseFloat(raw) || 0, 0);
                    handleLineChange(idx, 'received_qty', numVal);
                  }}
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="form-label">UoM</label>
                <input value={l.unit_of_measure || 'PCS'} readOnly className="input bg-muted" />
              </div>
              <div>
                <label className="form-label">Unit Price</label>
                <input value={l.unit_price} readOnly className="input" />
              </div>
              <div>
                <label className="form-label">Lot/Serial</label>
                <input value={l.serial_numbers || ''} onChange={e => handleLineChange(idx, 'serial_numbers', e.target.value)} className="input" placeholder="Comma-separated serials or lot" />
              </div>
            <div className="flex gap-2 md:col-span-8">
                <button type="button" onClick={() => removeLine(idx)} className="btn btn-secondary">Remove</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addLine} className="btn btn-secondary">Add Line</button>
        </div>
      </div>

      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-3xl">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold">Search Issued POs</h3>
              <button type="button" onClick={closePoModal} className="btn btn-secondary btn-sm">Close</button>
            </div>
            <div className="card-body space-y-3">
              <div className="flex gap-2">
                <input value={poSearch} onChange={e => setPoSearch(e.target.value)} placeholder="Search PO by number/title" className="input flex-1" />
                <button type="button" onClick={() => loadPoOptions(1)} className="btn btn-primary">Search</button>
              </div>
              {poError && (
                <div className="card border-l-4 border-red-500 bg-red-50">
                  <div className="card-body flex items-start gap-3 text-red-700">
                    <AlertTriangle size={16} />
                    <div className="text-sm">{poError}</div>
                  </div>
                </div>
              )}
              <div className="border rounded overflow-hidden">
                {poLoading ? (
                  <div className="p-6 animate-pulse bg-muted" />
                ) : (
                  <div className="divide-y max-h-80 overflow-auto">
                    {poOptions.length === 0 ? (
                      <div className="p-4 text-muted">No results</div>
                    ) : (
                      <>
                        {poOptions.map(po => (
                          <button key={po.id} type="button" onClick={() => handlePickPO(po)} className="w-full text-left px-4 py-3 hover:bg-muted">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-fg">{po.po_number} — {po.title}</div>
                                <div className="text-sm text-muted">Supplier: {po.supplier_name || po.supplier_id} · Received {Number(po.received_quantity || 0)}/{Number(po.total_quantity || 0)}</div>
                              </div>
                              <span className="badge">{po.status}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button type="button" className="btn btn-secondary btn-sm" disabled={poPage <= 1} onClick={() => loadPoOptions(poPage - 1)}>Prev</button>
                <div className="text-sm text-muted">Page {poPagination.page} / {poPagination.totalPages || 1}</div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={poPagination.totalPages && poPage >= poPagination.totalPages} onClick={() => loadPoOptions(poPage + 1)}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bottom-right action bar */}
      <div className="flex justify-end gap-3 sticky bottom-4">
        <button type="button" onClick={() => navigate('/procurement/grn/grn-list')} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating…' : 'Create GRN'}</button>
      </div>
    </form>
  );
};

export default GoodsReceiptCreatePage;


