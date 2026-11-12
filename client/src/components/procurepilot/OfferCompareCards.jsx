import { Check, ShieldAlert, Star } from 'lucide-react';
import { formatInr } from './procurePilotFormat';

/**
 * Visual offer picker — complements the comparison table on AI Buy.
 */
export default function OfferCompareCards({
  offers,
  policyOffers,
  recommendedOfferId,
  selectedId,
  maxPerTransaction,
  onSelect,
  onFocus
}) {
  const policyById = new Map((policyOffers || []).map((p) => [p.offer_id, p]));

  if (!offers?.length) return null;

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {offers.map((o) => {
        const pol = policyById.get(o.id);
        const eligible = pol?.eligible ?? false;
        const selected = String(o.id) === String(selectedId);
        const recommended = o.id === recommendedOfferId;
        const price = Number(o.price);
        const capPct =
          maxPerTransaction != null && maxPerTransaction > 0
            ? Math.min(100, (price / maxPerTransaction) * 100)
            : null;

        return (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              onFocus?.(o);
              if (eligible) onSelect?.(o);
            }}
            disabled={!eligible}
            className={`text-left rounded-xl border overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? 'border-primary ring-2 ring-primary/30 shadow-md'
                : eligible
                  ? 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                  : 'border-border/80 bg-muted/30 opacity-80 cursor-not-allowed'
            }`}
          >
            <div className="flex gap-3 p-3 border-b border-border/80 bg-gradient-to-br from-card to-muted/20">
              {o.image_url ? (
                <img src={o.image_url} alt="" className="h-16 w-16 rounded-lg object-contain bg-white border border-border shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-muted shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg line-clamp-2 leading-snug">
                  {o.product_title || o.supplier_name}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">{o.supplier_name}</p>
                <p className="text-lg font-bold text-fg tabular-nums mt-1">{formatInr(o.price)}</p>
              </div>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {eligible ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Check className="h-3 w-3" /> Eligible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                    <ShieldAlert className="h-3 w-3" /> Blocked
                  </span>
                )}
                {recommended && eligible && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Best pick
                  </span>
                )}
                {selected && eligible && (
                  <span className="text-[10px] font-medium text-primary">Selected</span>
                )}
              </div>
              {capPct != null && (
                <div>
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>vs txn cap</span>
                    <span>{capPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-0.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${capPct > 100 ? 'bg-red-500' : capPct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, capPct)}%` }}
                    />
                  </div>
                </div>
              )}
              {!eligible && pol?.violations?.[0]?.message && (
                <p className="text-xs text-red-800/90 leading-snug line-clamp-2">{pol.violations[0].message}</p>
              )}
              <p className="text-xs text-muted">
                Delivery:{' '}
                {o.delivery_verified === false && o.source === 'channel3' ? 'Unverified' : o.delivery_date || '—'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
