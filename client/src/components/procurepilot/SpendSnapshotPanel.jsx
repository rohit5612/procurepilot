import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { procurePilotAiBuyApi } from '../../utils/api';
import AiBuyPolicyContext from './AiBuyPolicyContext';
import { formatInr } from './procurePilotFormat';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SpendSnapshotPanel({ className = '' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await procurePilotAiBuyApi.getActivity();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load activity');
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

  const ledger = data?.ledger;

  return (
    <div className={`page-panel p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-fg text-sm flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          Spend & payments (this month)
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading} aria-label="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <AiBuyPolicyContext
          className="border-0 shadow-none"
          policy={{
            role_level: data.role_level,
            is_superuser: data.is_superuser,
            max_per_transaction: data.max_per_transaction,
            max_monthly_budget: data.max_monthly_budget
          }}
          ledger={ledger}
          compact
        />
      )}

      {data?.payment_events?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Recent PayPal events</p>
          <ul className="text-xs space-y-1.5 max-h-32 overflow-y-auto">
            {data.payment_events.slice(0, 5).map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b border-border/50 pb-1">
                <span className="truncate">
                  {p.status} · PR #{p.purchase_request_id || '—'} · {p.paypal_order_id?.slice(0, 12) || '—'}
                </span>
                <span className="text-muted shrink-0">{formatWhen(p.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.commitments?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Budget commitments</p>
          <ul className="text-xs space-y-1.5 max-h-28 overflow-y-auto">
            {data.commitments.slice(0, 5).map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>
                  {c.status} · {c.reference_type} #{c.reference_id} · {formatInr(c.amount)}
                </span>
                <span className="text-muted">{c.procurement_category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !data?.payment_events?.length && !data?.commitments?.length && !error && (
        <p className="text-xs text-muted">No AI Buy payments or reservations yet this period.</p>
      )}
    </div>
  );
}
