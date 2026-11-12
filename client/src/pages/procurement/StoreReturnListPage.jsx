import { useCallback, useEffect, useState } from 'react';
import PageToolbar from '../../components/layout/PageToolbar';
import { storeReturnAPI } from '../../utils/api';

export default function StoreReturnListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeReturnAPI.list();
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

  const post = async (id) => {
    const res = await storeReturnAPI.post(id);
    const json = await res.json();
    if (!res.ok) {
      setError(json.message);
      return;
    }
    load();
  };

  return (
    <div className="space-y-4">
      <PageToolbar title="Store returns (SRN)" subtitle="Returns against posted GRNs" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <table className="min-w-full text-sm rounded-lg border bg-white">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">SRN</th>
              <th className="px-4 py-3">GRN</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">{r.srn_number}</td>
                <td className="px-4 py-3">{r.grn_number || r.goods_receipt_id}</td>
                <td className="px-4 py-3">{r.supplier_name || '—'}</td>
                <td className="px-4 py-3 capitalize">{r.status}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'draft' && (
                    <button type="button" className="text-indigo-600 hover:underline" onClick={() => post(r.id)}>
                      Post
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
