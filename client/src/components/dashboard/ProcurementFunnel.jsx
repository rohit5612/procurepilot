import { useMemo } from 'react';
import AgChart from './AgChart';
import { Filter } from 'lucide-react';
import DashboardCard, { ChartEmpty, ChartSkeleton } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';

const HEIGHT = 250;

function biggestDropOff(funnel) {
  let worst = null;
  for (let i = 1; i < funnel.length; i += 1) {
    const prev = funnel[i - 1].value;
    if (!prev) continue;
    const loss = (prev - funnel[i].value) / prev;
    if (worst == null || loss > worst.loss) worst = { from: funnel[i - 1].stage, to: funnel[i].stage, loss };
  }
  return worst;
}

/**
 * @param {{ funnel: { stage: string; value: number }[]; loading?: boolean; className?: string }} props
 */
export default function ProcurementFunnel({ funnel, loading = false, className }) {
  const { chartTheme, tokens } = useAgTheme();
  const top = funnel[0]?.value || 0;
  const hasData = funnel.some((s) => s.value > 0);

  const options = useMemo(() => {
    const colors = [tokens.series[0], tokens.series[2], tokens.series[3], tokens.series[1], tokens.series[1], tokens.status.approved];
    const colorFor = (stage) => colors[Math.max(0, funnel.findIndex((s) => s.stage === stage))];
    return {
      theme: chartTheme,
      data: funnel,
      height: HEIGHT,
      padding: { top: 4, right: 64, bottom: 4, left: 4 },
      legend: { enabled: false },
      axes: {
        x: { type: 'number', position: 'bottom', label: { enabled: false }, gridLine: { enabled: false }, line: { enabled: false } },
        y: { type: 'category', position: 'left', line: { enabled: false }, tick: { enabled: false }, paddingInner: 0.28 }
      },
      series: [
        {
          type: 'bar',
          direction: 'horizontal',
          xKey: 'stage',
          yKey: 'value',
          yName: 'Documents',
          cornerRadius: 5,
          itemStyler: ({ datum }) => ({ fill: colorFor(datum.stage) }),
          label: {
            enabled: true,
            placement: 'outside-end',
            color: tokens.muted,
            fontSize: 11,
            fontWeight: 600,
            formatter: ({ datum }) =>
              top ? `${datum.value} · ${Math.round((datum.value / top) * 100)}%` : String(datum.value)
          },
          tooltip: {
            renderer: ({ datum }) => ({
              heading: datum.stage,
              data: [
                { label: 'Documents', value: String(datum.value) },
                { label: 'Of raised', value: top ? `${Math.round((datum.value / top) * 100)}%` : '—' }
              ]
            })
          }
        }
      ]
    };
  }, [chartTheme, funnel, tokens, top]);

  const drop = biggestDropOff(funnel);
  const last = funnel[funnel.length - 1]?.value || 0;

  return (
    <DashboardCard
      className={className}
      title="Procure-to-receipt funnel"
      subtitle="How far documents raised in this period progressed"
      icon={Filter}
      footer={
        drop && drop.loss > 0 ? (
          <span>
            Largest drop-off: <span className="font-medium text-fg">{drop.from} → {drop.to}</span> (
            {Math.round(drop.loss * 100)}% lost)
          </span>
        ) : (
          'Every stage is keeping pace.'
        )
      }
    >
      <div className="flex items-baseline gap-2 pb-2">
        <span className="text-2xl font-bold text-fg tabular-nums">{top ? `${Math.round((last / top) * 100)}%` : '—'}</span>
        <span className="text-xs text-muted">end-to-end conversion</span>
      </div>
      {loading && !hasData ? (
        <ChartSkeleton height={HEIGHT} />
      ) : hasData ? (
        <AgChart options={options} style={{ height: HEIGHT, width: '100%' }} />
      ) : (
        <ChartEmpty height={HEIGHT} message="Nothing moved through the pipeline in this period." />
      )}
    </DashboardCard>
  );
}
