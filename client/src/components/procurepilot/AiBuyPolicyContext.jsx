import { Shield } from 'lucide-react';
import { formatInr, rolePolicyLabel } from './procurePilotFormat';

/**
 * Compact policy caps + monthly budget usage for AI Buy sidebar and compare header.
 * @param {{ policy?: object; ledger?: object; compact?: boolean; className?: string }} props
 */
export default function AiBuyPolicyContext({ policy, ledger, compact = false, className = '' }) {
  if (!policy) return null;

  const maxMonthly = policy.max_monthly_budget != null ? Number(policy.max_monthly_budget) : null;
  const spent = Number(ledger?.spent || 0);
  const reserved = Number(ledger?.reserved || 0);
  const used = spent + reserved;
  const pct = maxMonthly != null && maxMonthly > 0 ? Math.min(100, (used / maxMonthly) * 100) : 0;

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Your spend policy</p>
          <p className="text-xs text-muted truncate">
            {rolePolicyLabel(policy.role_level, policy.is_superuser)}
          </p>
        </div>
      </div>
      <div className={`p-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted font-medium">Per transaction</p>
            <p className="text-base font-semibold text-fg tabular-nums mt-0.5">
              {formatInr(policy.max_per_transaction)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted font-medium">Monthly cap</p>
            <p className="text-base font-semibold text-fg tabular-nums mt-0.5">
              {formatInr(policy.max_monthly_budget)}
            </p>
          </div>
          {!compact && ledger?.remaining != null && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted font-medium">Left this month</p>
              <p className="text-base font-semibold text-fg tabular-nums mt-0.5">{formatInr(ledger.remaining)}</p>
            </div>
          )}
        </div>
        {maxMonthly != null && (
          <div>
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>Used {formatInr(used)}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        {Array.isArray(policy.allowed_categories) && policy.allowed_categories.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {policy.allowed_categories.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card text-muted capitalize">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
