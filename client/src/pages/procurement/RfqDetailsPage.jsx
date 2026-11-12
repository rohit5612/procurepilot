import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageToolbar from '../../components/layout/PageToolbar';
import { procurementAPI, rfqAPI } from '../../utils/api';

export default function RfqDetailsPage() {
  const { id } = useParams();
  const [rfq, setRfq] = useState(null);
  const [compare, setCompare] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rfqRes, cmpRes, supRes] = await Promise.all([
        rfqAPI.get(id),
        rfqAPI.compare(id),
        procurementAPI.getSuppliers()
      ]);
      const rfqJson = await rfqRes.json();
      const cmpJson = await cmpRes.json();
      const supJson = await supRes.json();
      if (!rfqRes.ok) throw new Error(rfqJson.message || 'RFQ not found');
      setRfq(rfqJson.data);
      setCompare(cmpJson.data || []);
      setSuppliers(supJson.data?.suppliers || supJson.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    if (!selectedSuppliers.length) return;
    const res = await rfqAPI.invite(id, selectedSuppliers.map(Number));
    const json = await res.json();
    if (!res.ok) {
      setError(json.message || 'Invite failed');
      return;
    }
    await load();
  };

  const award = async (quotationId) => {
    const res = await rfqAPI.award(id, quotationId);
    const json = await res.json();
    if (!res.ok) {
      setError(json.message || json.code || 'Award failed');
      return;
    }
    await load();
  };

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading RFQ…</p>;
  if (!rfq) return <p className="text-sm text-red-600 p-4">{error || 'Not found'}</p>;

  return (
    <div className="space-y-6">
      <PageToolbar title={rfq.rfq_number} subtitle={rfq.title} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="rounded-lg border bg-white p-4 text-sm">
        <p>
          Status: <span className="font-medium capitalize">{rfq.status}</span>
        </p>
        {rfq.requisition_id && <p>Linked PR ID: {rfq.requisition_id}</p>}
      </div>

      {rfq.status === 'draft' && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-medium">Invite suppliers</h3>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {suppliers.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedSuppliers.includes(String(s.id))}
                  onChange={(e) => {
                    setSelectedSuppliers((prev) =>
                      e.target.checked ? [...prev, String(s.id)] : prev.filter((x) => x !== String(s.id))
                    );
                  }}
                />
                {s.name}
              </label>
            ))}
          </div>
          <button type="button" onClick={invite} className="rounded bg-indigo-600 px-3 py-1.5 text-white text-sm">
            Send invitations
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium mb-3">Quote comparison</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-2">Supplier</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {compare.map((q) => (
              <tr key={q.id} className="border-t">
                <td className="py-2">{q.supplier_name}</td>
                <td className="py-2">₹{Number(q.total_amount || 0).toLocaleString('en-IN')}</td>
                <td className="py-2 capitalize">{q.status}</td>
                <td className="py-2 text-right">
                  {rfq.status !== 'awarded' && q.status === 'submitted' && (
                    <button
                      type="button"
                      className="text-indigo-600 hover:underline"
                      onClick={() => award(q.id)}
                    >
                      Award
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
