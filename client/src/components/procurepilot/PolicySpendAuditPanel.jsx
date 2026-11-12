import { useCallback, useEffect, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { procurePilotPolicyApi } from '../../utils/api';

function formatInr(v, currency) {
  const cur = currency || 'INR';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function PolicySpendAuditPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await procurePilotPolicyApi.getSpendAudit();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load audit');
      setData(json.data);
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
    <div className="page-panel p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-fg flex items-center gap-2">
          <CreditCard size={18} />
          PayPal & budget audit
        </h3>
        <button type="button" className="btn btn-secondary btn-sm inline-flex items-center gap-1" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted">
        Recent payment events and open budget reservations (AI Buy / PayPal). Use this to verify webhooks and ledger
        after sandbox checkouts.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">User</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Order</th>
              <th className="py-2">AI session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {(data?.payment_events || []).map((row) => (
              <tr key={row.id}>
                <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">{formatWhen(row.created_at)}</td>
                <td className="py-2 pr-3 truncate max-w-[140px]">{row.user_email}</td>
                <td className="py-2 pr-3">
                  <span className="text-xs font-medium">{row.status}</span>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {formatInr(row.amount_inr ?? row.amount, row.amount_inr ? 'INR' : row.currency)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs truncate max-w-[120px]">{row.paypal_order_id || '—'}</td>
                <td className="py-2 text-xs">#{row.purchase_request_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !(data?.payment_events || []).length && (
          <p className="text-sm text-muted py-4 text-center">No payment events yet.</p>
        )}
      </div>

      {(data?.open_commitments || []).length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Open commitments</p>
          <ul className="text-sm space-y-1">
            {data.open_commitments.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {c.user_email} · {c.reference_type} #{c.reference_id} · {c.status}
                </span>
                <span className="font-medium">{formatInr(c.amount, c.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
