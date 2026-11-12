import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Radio, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { goodsReceiptAPI, purchaseOrderAPI, inventoryAPI } from '../../utils/api';
import CircleSelector from '../../components/common/CircleSelector';
import ClusterSelector from '../../components/common/ClusterSelector';
import { useToastContext } from '../../contexts/ToastContext.jsx';

const GoodsReceiptEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useToastContext() || { add: () => {} };
  const [form, setForm] = useState({ purchase_order_id: '', supplier_id: '', warehouse_id: '', bin_id: '', site_id: '', remarks: '', circle_id: null, cluster_id: null });
  const [lines, setLines] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [poPicked, setPoPicked] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [bins, setBins] = useState([]);

  const loadGRN = async () => {
    try {
      setError(null);
      const res = await goodsReceiptAPI.getGRN(id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load GRN');
      const grn = data.data || data;
      if (grn.status !== 'draft') { setError('Only draft GRNs can be edited'); return; }
      setForm({
        purchase_order_id: grn.purchase_order_id || '',
        supplier_id: grn.supplier_id || '',
        warehouse_id: grn.warehouse_id || '',
        bin_id: grn.bin_id || '',
        site_id: grn.site_id || '',
        remarks: grn.remarks || '',
        circle_id: grn.circle_id || null,
        cluster_id: grn.cluster_id || null
      });
      setPoPicked({
        po_number: grn.po_number,
        title: grn.po_title,
        supplier_name: grn.supplier_name,
        received_quantity: 0,
        total_quantity: 0
      });
      setLines((grn.lines || []).map(l => {
        const qtyAsPerPO = (l.qty_as_per_po != null) ? Number(l.qty_as_per_po) : undefined;
        const alreadyReceived = (l.already_received != null) ? Number(l.already_received) : undefined;
        const expected = (l.expected_qty != null)
          ? Number(l.expected_qty)
          : (qtyAsPerPO != null && alreadyReceived != null ? Math.max(qtyAsPerPO - alreadyReceived, 0) : undefined);
        return ({
          id: l.id,
          po_line_id: l.po_line_id || null,
          item_id: l.item_id || null,
          item_code: l.item_code || '',
          item_name: l.item_name || '',
          qty_as_per_po: qtyAsPerPO,
          already_received: alreadyReceived,
          expected_qty: expected,
          received_qty: Number(l.received_qty || 0),
          accepted_qty: Number(l.accepted_qty || 0),
          rejected_qty: Number(l.rejected_qty || 0),
          unit_of_measure: l.unit_of_measure || 'PCS',
          unit_price: Number(l.unit_price || 0),
          serial_numbers: l.serial_numbers || '',
          manufacturer: l.manufacturer || null,
          spare_type: l.spare_type || null
        });
      }));
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadGRN(); }, [id]);

  useEffect(() => { (async () => { try { const res = await inventoryAPI.getWarehouses(); const j = await res.json(); if (res.ok) { setWarehouses(j.data || []); setFilteredWarehouses(j.data || []); } } catch {} })(); }, []);
  useEffect(() => {
    let filtered = warehouses;
    if (form.cluster_id) filtered = warehouses.filter(warehouse => String(warehouse.cluster_id) === String(form.cluster_id));
    else if (form.circle_id) filtered = warehouses.filter(warehouse => String(warehouse.circle_id) === String(form.circle_id));
    if (form.warehouse_id && !filtered.some(w => String(w.id) === String(form.warehouse_id))) {
      const selectedWh = warehouses.find(w => String(w.id) === String(form.warehouse_id));
      if (selectedWh) filtered = [selectedWh, ...filtered];
    }
    setFilteredWarehouses(filtered);
  }, [form.circle_id, form.cluster_id, form.warehouse_id, warehouses]);

  useEffect(() => { (async () => { try { if (!form.warehouse_id) { setBins([]); return; } const res = await inventoryAPI.getWarehouseBins(form.warehouse_id); const d = await res.json(); if (res.ok) setBins(d.data || []); else setBins([]); } catch { setBins([]); } })(); }, [form.warehouse_id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleLineChange = (idx, key, value) => { const newLines = [...lines]; newLines[idx][key] = value; setLines(newLines); };
  const addLine = () => setLines([...lines, { item_name: '', received_qty: '', accepted_qty: '', rejected_qty: '0', unit_of_measure: 'PCS', unit_price: '' }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));

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
        ...(form.bin_id ? { bin_id: Number(form.bin_id) } : {}),
        lines: lines.map(l => {
          const recv = Math.max(parseInt(l.received_qty, 10) || 0, 0);
          return {
            po_line_id: l.po_line_id || null,
            item_id: l.item_id || null,
            item_code: l.item_code || undefined,
            item_name: l.item_name,
            received_qty: recv,
            accepted_qty: Number(l.accepted_qty || 0),
            rejected_qty: Number(l.rejected_qty || 0),
            unit_of_measure: l.unit_of_measure || 'PCS',
            unit_price: Number(l.unit_price || 0),
            manufacturer: l.manufacturer || undefined,
            spare_type: l.spare_type || undefined,
            serial_numbers: l.serial_numbers || undefined
          };
        })
      };
      const res = await goodsReceiptAPI.updateGRN(id, payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update GRN');
      add('GRN updated', 'success');
      navigate(`/procurement/grn/grn-details/${id}`);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg">Edit Goods Receipt</h1>
        <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Saving…' : 'Save Changes'}</button>
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
              <div className="text-sm text-muted">Linked PO</div>
              <div className="font-medium text-fg">{poPicked.po_number} — {poPicked.title}</div>
              <div className="text-sm text-muted">Supplier: {poPicked.supplier_name || form.supplier_id}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPoPicked(null); setForm(prev => ({ ...prev, purchase_order_id: '', supplier_id: '' })); setLines([]); }}>
              <X size={16} className="mr-2" /> Unlink PO
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">PO Number</label>
            <input value={poPicked?.po_number || ''} className="input" readOnly />
          </div>
          <div>
            <label className="form-label">Supplier</label>
            <input value={poPicked?.supplier_name || (form.supplier_id ? `#${form.supplier_id}` : '')} className="input" readOnly />
          </div>
          <div>
            <label className="form-label required"><WarehouseIcon size={14} className="inline mr-1" /> Warehouse</label>
            <select name="warehouse_id" value={form.warehouse_id} onChange={handleChange} className="input" required>
              <option value="">Select warehouse</option>
              {filteredWarehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} {w.warehouse_code && `(${w.warehouse_code})`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Bin (optional)</label>
            <select name="bin_id" value={form.bin_id} onChange={handleChange} className="input">
              <option value="">No bin (warehouse only)</option>
              {bins.map(b => (
                <option key={b.id} value={b.id}>{b.bin_code || `Bin #${b.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label"><Radio size={14} className="inline mr-1" /> Telecom Circle</label>
            <CircleSelector value={form.circle_id} onChange={(value) => setForm({ ...form, circle_id: value, cluster_id: null })} className="w-full" />
          </div>
          <div>
            <label className="form-label"><Radio size={14} className="inline mr-1" /> Cluster</label>
            <ClusterSelector value={form.cluster_id} onChange={(value) => setForm({ ...form, cluster_id: value })} circleId={form.circle_id} className="w-full" />
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
            <div key={idx} className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
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
                <input value={l.already_received_snapshot ?? ''} readOnly className="input bg-muted" />
              </div>
              <div>
                <label className="form-label">Expected Qty</label>
                <input value={l.expected_qty_snapshot ?? ''} readOnly className="input bg-muted" />
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
                <label className="form-label">Accepted Qty</label>
                <input value={l.accepted_qty} onChange={e => handleLineChange(idx, 'accepted_qty', e.target.value)} className="input" />
              </div>
              <div>
                <label className="form-label">Rejected Qty</label>
                <input value={l.rejected_qty} onChange={e => handleLineChange(idx, 'rejected_qty', e.target.value)} className="input" />
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
              <div className="flex gap-2 md:col-span-7">
                <button type="button" onClick={() => removeLine(idx)} className="btn btn-secondary">Remove</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addLine} className="btn btn-secondary">Add Line</button>
        </div>
      </div>
    </form>
  );
};

export default GoodsReceiptEditPage;


