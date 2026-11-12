import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageToolbar from '../../components/layout/PageToolbar';
import { rfqAPI } from '../../utils/api';

export default function RfqManagementPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await rfqAPI.list();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load RFQs');
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

  return (
    <div className="space-y-4">
      <PageToolbar title="Request for quotation (RFQ)" subtitle="Sourcing and quote comparison" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">RFQ</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3">Quotes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{r.rfq_number}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 capitalize">{r.status?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{r.invited_count ?? 0}</td>
                  <td className="px-4 py-3">{r.quote_count ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-indigo-600 hover:underline" to={`/procurement/rfq/rfq-details/${r.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No RFQs yet. Create one from an approved requisition.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
