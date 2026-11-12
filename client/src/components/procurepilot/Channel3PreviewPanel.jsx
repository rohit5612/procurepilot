import { ExternalLink, ImageOff, Loader2, Store } from 'lucide-react';

function formatInr(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

/**
 * @param {{ offers?: object[]; meta?: object; loading?: boolean; error?: string; emptyHint?: string }} props
 */
export default function Channel3PreviewPanel({ offers = [], meta, loading, error, emptyHint }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 flex flex-col items-center gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Searching Channel3 retailers…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!offers?.length) {
    return (
      <p className="text-sm text-muted py-4 text-center">
        {emptyHint || 'No preview yet. Run a preview search to see live listings.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {meta?.disclaimer && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          {meta.disclaimer}
        </p>
      )}
      {meta?.query && (
        <p className="text-xs text-muted">
          Query: <span className="text-fg font-medium">&quot;{meta.query}&quot;</span>
          {meta.offer_count != null && <> · {meta.offer_count} listing{meta.offer_count === 1 ? '' : 's'}</>}
        </p>
      )}
      <ul className="grid sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {offers.map((o) => (
          <li
            key={o.id}
            className="flex gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors"
          >
            <div className="h-16 w-16 shrink-0 rounded-lg bg-muted/60 border border-border overflow-hidden flex items-center justify-center">
              {o.image_url ? (
                <img src={o.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <ImageOff className="h-6 w-6 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-fg line-clamp-2 leading-snug">{o.product_title || o.item || 'Listing'}</p>
              <p className="text-xs text-muted flex items-center gap-1">
                <Store size={12} />
                {o.supplier_name}
                {o.availability ? ` · ${o.availability}` : ''}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-sm font-semibold text-fg">{formatInr(o.price)}</span>
                {o.purchase_url && (
                  <a
                    href={o.purchase_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    View <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
