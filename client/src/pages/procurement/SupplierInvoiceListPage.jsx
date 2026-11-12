import { useCallback, useEffect, useState } from 'react';
import PageToolbar from '../../components/layout/PageToolbar';
import { supplierInvoiceAPI } from '../../utils/api';

export default function SupplierInvoiceListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierInvoiceAPI.list();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setItems(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handoff = async (invoiceId) => {
    const res = await supplierInvoiceAPI.handoffFinance(invoiceId);
    const json = await res.json();
    if (!res.ok) {
      setError(json.message);
      return;
    }
    load();
  };

  return (
    <div className="space-y-4">
      <PageToolbar title="Supplier invoices" subtitle="Capture, match, and hand off to finance" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <table className="min-w-full text-sm rounded-lg border bg-white overflow-hidden">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">PO</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-4 py-3">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.supplier_name}</td>
                <td className="px-4 py-3">{inv.po_number || '—'}</td>
                <td className="px-4 py-3">₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 capitalize">{inv.status}</td>
                <td className="px-4 py-3 text-right">
                  {['matched', 'exception'].includes(inv.status) && (
                    <button
                      type="button"
                      className="text-indigo-600 hover:underline"
                      onClick={() => handoff(inv.id)}
                    >
                      Hand off
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
