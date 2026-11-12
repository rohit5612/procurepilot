import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Hourglass, IndianRupee, PackageCheck, ShoppingCart } from 'lucide-react';
import Sparkline from './Sparkline';
import { useAgTheme } from '../../hooks/useAgTheme';
import { formatCompactInr, formatDuration } from '../../utils/dashboardMetrics';
import { formatInr } from '../../utils/dashboardActivity';

const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
const count = (v) => String(Math.round(v ?? 0));

function DeltaBadge({ delta, unit = '%', inverse = false }) {
  if (delta == null || !Number.isFinite(delta)) {
    return <span className="text-[11px] font-medium text-muted">No prior data</span>;
  }
  const rounded = Math.abs(delta) < 0.5 ? 0 : delta;
  const up = rounded > 0;
  const flat = rounded === 0;
  const good = flat ? null : inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        good === null && 'bg-muted text-muted',
        good === true && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
        good === false && 'bg-rose-500/12 text-rose-700 dark:text-rose-400'
      )}
    >
      {flat ? null : <Icon className="h-3 w-3" aria-hidden />}
      {flat ? '0' : `${up ? '+' : '−'}${Math.abs(rounded).toFixed(Math.abs(rounded) < 10 ? 1 : 0)}`}
      {unit}
    </span>
  );
}

function KpiCard({ title, value, valueTitle, icon: Icon, delta, deltaUnit, inverse, caption, spark, loading }) {
  return (
    <article className="page-panel relative overflow-hidden p-4 flex flex-col gap-3 min-w-0 group hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">{title}</p>
        <span className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2 min-w-0">
        {loading ? (
          <span className="h-7 w-24 rounded-md bg-muted animate-pulse" aria-hidden />
        ) : (
          <p className="text-2xl font-bold text-fg tracking-tight tabular-nums truncate" title={valueTitle}>
            {value}
          </p>
        )}
        {delta !== undefined ? <DeltaBadge delta={delta} unit={deltaUnit} inverse={inverse} /> : null}
      </div>
      <div className="-mx-1">{spark}</div>
      <p className="text-xs text-muted truncate">{caption}</p>
    </article>
  );
}

/**
 * @param {{
 *   metrics: ReturnType<typeof import('../../utils/dashboardMetrics').computeDashboardMetrics>;
 *   stats: Record<string, number>;
 *   poPendingCount: number;
 *   myApprovalsCount: number;
 *   loading?: boolean;
 * }} props
 */
export default function DashboardKpiCards({ metrics, stats, poPendingCount = 0, myApprovalsCount = 0, loading = false }) {
  const { tokens } = useAgTheme();
  const { current, deltas, series, range } = metrics;
  const [c1, c2, c3, c4, c5] = tokens.series;
  const compare = `vs previous ${range.longLabel.replace('Last ', '').toLowerCase()}`;
  const prPending = Number(stats.pending_approval_count) || 0;

  const cards = [
    {
      title: 'Demand raised',
      icon: IndianRupee,
      value: formatCompactInr(current.prValue),
      valueTitle: formatInr(current.prValue),
      delta: deltas.prValue,
      caption: `${current.prCount} requisitions · ${compare}`,
      spark: <Sparkline data={series} yKey="prValue" name="PR value" color={c1} format={formatInr} />
    },
    {
      title: 'PO committed',
      icon: ShoppingCart,
      value: formatCompactInr(current.poValue),
      valueTitle: formatInr(current.poValue),
      delta: deltas.poValue,
      caption: `${current.poCount} purchase orders created`,
      spark: <Sparkline data={series} yKey="poValue" name="PO value" color={c2} format={formatInr} />
    },
    {
      title: 'Open approvals',
      icon: Hourglass,
      value: String(prPending + poPendingCount),
      caption:
        myApprovalsCount > 0
          ? `${myApprovalsCount} waiting on you · ${prPending} PR / ${poPendingCount} PO`
          : `${prPending} PR · ${poPendingCount} PO awaiting approvers`,
      spark: <Sparkline data={series} yKey="prCount" name="New requisitions" color={c5} format={count} type="bar" />
    },
    {
      title: 'Approval rate',
      icon: CheckCircle2,
      value: pct(current.approvalRate),
      delta: deltas.approvalRate,
      deltaUnit: 'pp',
      caption: `${current.approved} approved · ${current.rejected} rejected`,
      spark: <Sparkline data={series} yKey="approvalRate" name="Approval rate" color={c3} format={pct} />
    },
    {
      title: 'Avg. approval time',
      icon: Clock,
      value: formatDuration(current.avgCycleHours),
      delta: deltas.avgCycleHours,
      inverse: true,
      caption: 'Submission to final approval',
      spark: <Sparkline data={series} yKey="avgCycleHours" name="Avg. hours" color={c4} format={formatDuration} type="bar" />
    },
    {
      title: 'Receipt completion',
      icon: PackageCheck,
      value: pct(current.receiptRate),
      delta: deltas.receiptRate,
      deltaUnit: 'pp',
      caption: `${current.received} of ${current.issued} issued POs fully received`,
      spark: <Sparkline data={series} yKey="receiptRate" name="Received" color={tokens.status.approved} format={pct} />
    }
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} loading={loading} />
      ))}
    </div>
  );
}
