import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AgChart from './AgChart';
import { PieChart } from 'lucide-react';
import DashboardCard, { ChartEmpty, ChartSkeleton } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';

const HEIGHT = 210;

/**
 * @param {{ pipeline: { key: string; label: string; value: number }[]; loading?: boolean; className?: string }} props
 */
export default function PipelineDonut({ pipeline, loading = false, className }) {
  const { chartTheme, tokens } = useAgTheme();
  const total = pipeline.reduce((sum, s) => sum + s.value, 0);
  const fills = pipeline.map((s) => tokens.status[s.key]);

  const options = useMemo(
    () => ({
      theme: chartTheme,
      data: pipeline,
      height: HEIGHT,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      legend: { enabled: false },
      series: [
        {
          type: 'donut',
          angleKey: 'value',
          legendItemKey: 'label',
          fills,
          strokes: fills.map(() => tokens.card),
          strokeWidth: 2,
          innerRadiusRatio: 0.72,
          calloutLabel: { enabled: false },
          innerLabels: [
            { text: String(total), fontSize: 26, fontWeight: 700, color: tokens.fg },
            { text: 'requisitions', fontSize: 11, color: tokens.muted, spacing: 2 }
          ],
          tooltip: {
            renderer: ({ datum }) => ({
              heading: datum.label,
              data: [
                { label: 'Count', value: String(datum.value) },
                { label: 'Share', value: `${total ? Math.round((datum.value / total) * 100) : 0}%` }
              ]
            })
          }
        }
      ]
    }),
    [chartTheme, pipeline, fills, total, tokens]
  );

  return (
    <DashboardCard
      className={className}
      title="Requisition pipeline"
      subtitle="Current status of all requisitions"
      icon={PieChart}
      footer={
        <Link to="/procurement/pr/requisition-list" className="font-medium text-primary hover:underline">
          View all requisitions
        </Link>
      }
    >
      {loading && !total ? (
        <ChartSkeleton height={HEIGHT} />
      ) : total ? (
        <>
          <AgChart options={options} style={{ height: HEIGHT, width: '100%' }} />
          <ul className="mt-3 space-y-2">
            {pipeline.map((s) => {
              const share = total ? (s.value / total) * 100 : 0;
              return (
                <li key={s.key} className="flex items-center gap-3 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tokens.status[s.key] }} aria-hidden />
                  <span className="text-fg flex-1 truncate">{s.label}</span>
                  <span className="text-muted tabular-nums w-10 text-right">{Math.round(share)}%</span>
                  <span className="font-semibold text-fg tabular-nums w-8 text-right">{s.value}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ChartEmpty height={HEIGHT} message="No requisitions raised yet." />
      )}
    </DashboardCard>
  );
}
