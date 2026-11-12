import { useMemo, useState } from 'react';
import AgChart from './AgChart';
import { Layers } from 'lucide-react';
import DashboardCard, { ChartEmpty, ChartSkeleton, Segmented } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';
import { formatCompactInr } from '../../utils/dashboardMetrics';
import { formatInr } from '../../utils/dashboardActivity';

const HEIGHT = 250;

const LENSES = {
  department: { label: 'Dept', subtitle: 'Requisition demand by department' },
  site: { label: 'Site', subtitle: 'Requisition demand by delivery site' },
  category: { label: 'Category', subtitle: 'Committed PO value by transaction category' },
  cluster: { label: 'Cluster', subtitle: 'Issued PO spend by cluster' }
};

/**
 * @param {{
 *   departments: { label: string; value: number; count?: number }[];
 *   sites: { label: string; value: number; count?: number }[];
 *   categories: { label: string; value: number; count?: number }[];
 *   clusters: { label: string; value: number }[];
 *   showPoLenses?: boolean;
 *   loading?: boolean;
 *   className?: string;
 * }} props
 */
export default function SpendBreakdownChart({ departments, sites, categories, clusters, showPoLenses = true, loading = false, className }) {
  const { chartTheme, tokens } = useAgTheme();
  const [lens, setLens] = useState('department');

  const lensOptions = Object.entries(LENSES)
    .filter(([id]) => showPoLenses || (id !== 'category' && id !== 'cluster'))
    .map(([id, l]) => ({ id, label: l.label }));
  const activeLens = lensOptions.some((o) => o.id === lens) ? lens : 'department';

  const data = useMemo(() => {
    const source = { department: departments, site: sites, category: categories, cluster: clusters.slice(0, 6) }[activeLens] || [];
    return source.filter((d) => d.value > 0).map((d, rank) => ({ ...d, rank }));
  }, [activeLens, departments, sites, categories, clusters]);

  const total = data.reduce((s, d) => s + d.value, 0);

  const options = useMemo(() => {
    const ramp = tokens.series;
    return {
      theme: chartTheme,
      data,
      height: HEIGHT,
      padding: { top: 4, right: 52, bottom: 4, left: 4 },
      legend: { enabled: false },
      axes: {
        x: { type: 'number', position: 'bottom', label: { enabled: false }, gridLine: { enabled: false }, line: { enabled: false } },
        y: {
          type: 'category',
          position: 'left',
          line: { enabled: false },
          tick: { enabled: false },
          paddingInner: 0.3,
          label: { formatter: ({ value }) => (String(value).length > 16 ? `${String(value).slice(0, 15)}…` : value) }
        }
      },
      series: [
        {
          type: 'bar',
          direction: 'horizontal',
          xKey: 'label',
          yKey: 'value',
          yName: 'Spend',
          cornerRadius: 5,
          itemStyler: ({ datum }) => ({
            fill: datum.label === 'Other' || datum.label === 'Unassigned' ? ramp[6] : ramp[0],
            fillOpacity: Math.max(0.45, 1 - datum.rank * 0.1)
          }),
          label: {
            enabled: true,
            placement: 'outside-end',
            color: tokens.muted,
            fontSize: 11,
            fontWeight: 600,
            formatter: ({ datum }) => formatCompactInr(datum.value)
          },
          tooltip: {
            renderer: ({ datum }) => ({
              heading: datum.label,
              data: [
                { label: 'Spend', value: formatInr(datum.value) },
                { label: 'Share', value: `${total ? Math.round((datum.value / total) * 100) : 0}%` },
                ...(datum.count != null ? [{ label: 'Documents', value: String(datum.count) }] : [])
              ]
            })
          }
        }
      ]
    };
  }, [chartTheme, data, tokens, total]);

  const leader = data[0];

  return (
    <DashboardCard
      className={className}
      title="Spend breakdown"
      subtitle={LENSES[activeLens].subtitle}
      icon={Layers}
      footer={
        leader && total ? (
          <span>
            <span className="font-medium text-fg">{leader.label}</span> accounts for{' '}
            {Math.round((leader.value / total) * 100)}% of {formatCompactInr(total)}
          </span>
        ) : (
          'Spend will appear here as documents are created.'
        )
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-fg tabular-nums">{formatCompactInr(total)}</span>
          <span className="text-xs text-muted">{data.length ? `across ${data.length} groups` : ''}</span>
        </div>
        <Segmented options={lensOptions} value={activeLens} onChange={setLens} ariaLabel="Breakdown dimension" />
      </div>
      {loading && !data.length ? (
        <ChartSkeleton height={HEIGHT} />
      ) : data.length ? (
        <AgChart options={options} style={{ height: HEIGHT, width: '100%' }} />
      ) : (
        <ChartEmpty height={HEIGHT} message="No spend recorded for this view." />
      )}
    </DashboardCard>
  );
}
