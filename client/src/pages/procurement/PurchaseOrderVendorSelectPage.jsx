import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { requisitionAPI, purchaseOrderAPI } from '../../utils/api';
import { AlertTriangle, Check, Users } from 'lucide-react';

const PurchaseOrderVendorSelectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendorOptions, setVendorOptions] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState({}); // line_id -> supplier_id
  const [groupBySupplier, setGroupBySupplier] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await requisitionAPI.getVendorOptions(id);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to load vendor options');
      }
      const data = await res.json();
      setVendorOptions(data.data || []);
      const initial = {};
      (data.data || []).forEach(line => { if (line.recommended_supplier_id) initial[line.line_id] = line.recommended_supplier_id; });
      setSelectedSuppliers(initial);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOptions(); }, [id]);

  const handleSelect = (lineId, supplierId) => {
    setSelectedSuppliers(prev => ({ ...prev, [lineId]: supplierId }));
  };

  const handleAssignBest = () => {
    const next = {};
    vendorOptions.forEach(line => { if (line.candidates?.length) next[line.line_id] = [...line.candidates].sort((a,b)=>Number(a.unit_price||0)-Number(b.unit_price||0))[0].supplier_id; });
    setSelectedSuppliers(next);
  };

  const buildLines = (linesFilter) => {
    return linesFilter.map(line => ({
      requisition_line_id: line.line_id,
      item_id: line.item_id,
      item_name: line.item_name,
      quantity: line.quantity,
      unit_of_measure: line.unit_of_measure,
      unit_price: (line.candidates || []).find(c => c.supplier_id === selectedSuppliers[line.line_id])?.unit_price || 0
    }));
  };

  const handleCreatePO = async () => {
    try {
      setError(null);
      const linesFull = buildLines(vendorOptions);
      const supplierIds = Array.from(new Set(Object.values(selectedSuppliers).filter(Boolean)));
      if (supplierIds.length === 0) throw new Error('Please select suppliers for at least one line');

      if (groupBySupplier) {
        for (const supplierId of supplierIds) {
          const supplierLines = linesFull.filter(l => selectedSuppliers[l.requisition_line_id] === supplierId);
          if (supplierLines.length === 0) continue;
          const payload = {
            title: `PO for PR ${id} - Supplier ${supplierId}`,
            supplier_id: supplierId,
            lines: supplierLines
          };
          const res = await purchaseOrderAPI.createFromRequisition(id, payload);
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to create PO');
          }
        }
      } else {
        if (supplierIds.length > 1) throw new Error('Single PO requires the same supplier for all selected lines');
        const payload = { title: `PO for PR ${id}`, supplier_id: supplierIds[0], lines: linesFull };
        const res = await purchaseOrderAPI.createFromRequisition(id, payload);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to create PO');
        }
      }
      navigate('/procurement/po/po-list');
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <div className="card"><div className="card-body"><div className="animate-pulse h-24 bg-muted rounded" /></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Select Suppliers for PR #{id}</h1>
          <p className="text-muted">Compare supplier options per line and generate PO</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupBySupplier} onChange={e => setGroupBySupplier(e.target.checked)} /> Group by supplier</label>
          <button onClick={handleAssignBest} className="btn btn-secondary btn-sm"><Check size={14} className="mr-1" /> Assign best</button>
          <button onClick={handleCreatePO} className="btn btn-primary btn-sm"><Users size={14} className="mr-1" /> Create PO</button>
        </div>
      </div>

      {error && (
        <div className="card"><div className="card-body"><div className="flex items-center gap-2 text-danger"><AlertTriangle size={16} /><span>{error}</span></div></div></div>
      )}

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Line</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Supplier Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendorOptions.map(line => {
                const bestPrice = line.candidates && line.candidates.length
                  ? Math.min(...line.candidates.map(c => Number(c.unit_price || 0)))
                  : null;
                return (
                  <tr key={line.line_id}>
                    <td className="px-4 py-3">{line.line_id}</td>
                    <td className="px-4 py-3">{line.item_name}</td>
                    <td className="px-4 py-3">{line.quantity} {line.unit_of_measure}</td>
                    <td className="px-4 py-3">
                      {line.candidates && line.candidates.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            {line.candidates.map(c => {
                              const isSelected = selectedSuppliers[line.line_id] === c.supplier_id;
                              const isBest = bestPrice !== null && Number(c.unit_price || 0) === bestPrice;
                              return (
                                <button
                                  key={c.supplier_id}
                                  onClick={() => handleSelect(line.line_id, c.supplier_id)}
                                  className={`px-3 py-2 rounded border text-sm transition-colors ${
                                    isSelected ? 'border-primary text-primary ring-primary' : 'border-default text-fg hover-bg-muted'
                                  } ${isBest ? 'bg-accent' : ''}`}
                                  title={`Lead time: ${c.lead_time_days} days`}
                                >
                                  {c.supplier_name} • ₹{Number(c.unit_price || 0).toFixed(2)} {isBest ? <span className="badge badge-info ml-1">Best</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">No supplier prices available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderVendorSelectPage;


