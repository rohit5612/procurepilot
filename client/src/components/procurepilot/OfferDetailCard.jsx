import { ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';

function formatInr(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

/**
 * @param {{ offer?: object; policy?: object; recommended?: boolean }} props
 */
export default function OfferDetailCard({ offer, policy, recommended }) {
  if (!offer) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted text-center">
        Select a row in the comparison table to see listing details.
      </div>
    );
  }

  const pol = policy;
  const eligible = pol?.eligible !== false;

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      {offer.image_url && (
        <div className="h-36 bg-muted/40 border-b border-border flex items-center justify-center p-4">
          <img src={offer.image_url} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-fg leading-snug">{offer.product_title || offer.supplier_name}</h4>
          <p className="text-sm text-muted mt-1">{offer.supplier_name}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Line total (INR)</dt>
            <dd className="font-semibold">{formatInr(offer.price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Delivery</dt>
            <dd>
              {offer.delivery_verified === false && offer.source === 'channel3'
                ? 'Not verified'
                : offer.delivery_date || '—'}
            </dd>
          </div>
          {offer.unit_price_inr != null && (
            <div>
              <dt className="text-xs text-muted">Unit (est. INR)</dt>
              <dd>{formatInr(offer.unit_price_inr)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted">Qty</dt>
            <dd>{offer.quantity ?? '—'}</dd>
          </div>
        </dl>
        {offer.notes && <p className="text-xs text-muted leading-relaxed">{offer.notes}</p>}
        <div
          className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
            eligible ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {eligible ? <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" /> : <ShieldX className="h-4 w-4 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">{eligible ? 'Policy eligible' : 'Does not pass policy'}</p>
            {!eligible && pol?.violations?.length > 0 && (
              <ul className="text-xs mt-1 space-y-0.5 opacity-90 list-disc pl-4">
                {pol.violations.map((v, i) => (
                  <li key={v.code || i}>{v.message}</li>
                ))}
              </ul>
            )}
            {recommended && <p className="text-xs mt-1 font-medium">★ Recommended pick</p>}
          </div>
        </div>
        {offer.purchase_url && (
          <a
            href={offer.purchase_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm w-full inline-flex items-center justify-center gap-2"
          >
            Open retailer listing <ExternalLink size={14} />
          </a>
        )}
      </div>
    </article>
  );
}
