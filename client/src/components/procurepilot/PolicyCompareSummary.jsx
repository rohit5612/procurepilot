import { CheckCircle2, XCircle, Star, Package } from 'lucide-react';
import { formatInr } from './procurePilotFormat';
import AiBuyPolicyContext from './AiBuyPolicyContext';

/**
 * @param {{
 *   draft?: object;
 *   compareResult?: object;
 *   activityPolicy?: object;
 *   activityLedger?: object;
 * }} props
 */
export default function PolicyCompareSummary({ draft, compareResult, activityPolicy, activityLedger }) {
  const policy = compareResult?.policy;
  const offers = compareResult?.offers || [];
  const policyOffers = policy?.offers || [];
  const eligible = policyOffers.filter((p) => p.eligible).length;
  const rejected = policyOffers.length - eligible;
  const effective = policy?.effective_policy;

  const policyForBar = effective
    ? {
        role_level: policy.role_level,
        is_superuser: activityPolicy?.is_superuser,
        max_per_transaction: effective.max_per_transaction,
        max_monthly_budget: effective.max_monthly_budget,
        allowed_categories: effective.allowed_categories
      }
    : activityPolicy;

  const recommendedName = policy?.recommended_offer_id
    ? compareResult?.offers?.find((o) => String(o.id) === String(policy.recommended_offer_id))?.supplier_name
    : null;

  return (
    <div className="space-y-4">
      {draft && (
        <div className="page-panel p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Request</p>
              <p className="text-base font-semibold text-fg mt-0.5 leading-snug">{draft.item}</p>
              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Qty</dt>
                  <dd className="font-medium">{draft.quantity ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Max budget</dt>
                  <dd className="font-medium tabular-nums">{formatInr(draft.maximum_budget)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Category</dt>
                  <dd className="font-medium capitalize">{draft.procurement_category || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Need by</dt>
                  <dd className="font-medium">{draft.delivery_deadline || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            label="Eligible"
            value={String(eligible)}
            sub={offers.length ? `of ${offers.length} offers` : ''}
            tone="emerald"
          />
          <StatTile
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            label="Rejected"
            value={String(rejected)}
            sub="by policy engine"
            tone="red"
          />
          <StatTile
            icon={<Star className="h-5 w-5 text-amber-500" />}
            label="Recommended"
            value={recommendedName ? (recommendedName.length > 14 ? `${recommendedName.slice(0, 14)}…` : recommendedName) : '—'}
            sub="best compliant price"
            tone="amber"
          />
        </div>
        <AiBuyPolicyContext
          policy={policyForBar}
          ledger={
            activityLedger ||
            (policy?.monthly_ledger
              ? {
                  spent: policy.monthly_ledger.spent,
                  reserved: policy.monthly_ledger.reserved,
                  remaining: null
                }
              : null)
          }
          compact
        />
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, sub, tone }) {
  const border =
    tone === 'emerald'
      ? 'border-emerald-200/80 bg-emerald-50/50'
      : tone === 'red'
        ? 'border-red-200/80 bg-red-50/40'
        : 'border-amber-200/80 bg-amber-50/40';
  return (
    <div className={`rounded-xl border p-4 min-w-0 ${border}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-fg mt-2 tabular-nums truncate" title={value}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}
