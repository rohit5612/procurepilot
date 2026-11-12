import { useMemo, useState } from 'react';
import AgChart from './AgChart';
import { TrendingUp } from 'lucide-react';
import DashboardCard, { ChartEmpty, ChartSkeleton, Segmented } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';
import { formatCompactInr } from '../../utils/dashboardMetrics';
import { formatInr } from '../../utils/dashboardActivity';

const MODES = [
  { id: 'value', label: 'Value' },
  { id: 'volume', label: 'Volume' }
];

const MODE_CONFIG = {
  value: { pr: 'prValue', po: 'poValue', fmt: formatInr, axis: formatCompactInr },
  volume: { pr: 'prCount', po: 'poCount', fmt: (v) => `${Math.round(v)} docs`, axis: String }
};

const HEIGHT = 300;

function LegendStat({ color, label, value, shape = 'square' }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {color ? (
          <span
            className={shape === 'line' ? 'h-0.5 w-3 rounded-full' : 'h-2.5 w-2.5 rounded-[3px]'}
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-lg font-semibold text-fg tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

/**
 * @param {{ metrics: ReturnType<typeof import('../../utils/dashboardMetrics').computeDashboardMetrics>; loading?: boolean; className?: string }} props
 */
export default function SpendTrendChart({ metrics, loading = false, className }) {
  const { chartTheme, tokens } = useAgTheme();
  const [mode, setMode] = useState('value');
  const { series, current, range } = metrics;
  const [prColor, poColor] = tokens.series;
  const cardColor = tokens.card;

  const isValue = mode === 'value';
  const hasData = series.some((row) => row[MODE_CONFIG[mode].pr] > 0 || row[MODE_CONFIG[mode].po] > 0);

  const options = useMemo(() => {
    const { pr, po, fmt, axis } = MODE_CONFIG[mode];
    const tooltip = {
      renderer: ({ datum }) => ({
        heading: datum.label,
        data: [
          { label: 'Requisition demand', value: fmt(datum[pr]) },
          { label: 'PO committed', value: fmt(datum[po]) }
        ]
      })
    };

    return {
      theme: chartTheme,
      data: series,
      height: HEIGHT,
      legend: { enabled: false },
      axes: {
        x: {
          type: 'category',
          position: 'bottom',
          gridLine: { enabled: false },
          line: { enabled: false },
          tick: { enabled: false },
          label: { minSpacing: 14 },
          paddingInner: 0.35
        },
        y: {
          type: 'number',
          position: 'left',
          line: { enabled: false },
          tick: { enabled: false },
          label: { formatter: ({ value }) => axis(value) }
        }
      },
      series: [
        {
          type: 'bar',
          xKey: 'label',
          yKey: pr,
          yName: 'Requisition demand',
          fill: prColor,
          fillOpacity: 0.9,
          cornerRadius: 4,
          tooltip
        },
        {
          type: 'line',
          xKey: 'label',
          yKey: po,
          yName: 'PO committed',
          stroke: poColor,
          strokeWidth: 2.5,
          interpolation: { type: 'smooth', tension: 0.35 },
          marker: { enabled: true, size: 6, fill: poColor, stroke: cardColor, strokeWidth: 2 },
          tooltip
        }
      ]
    };
  }, [chartTheme, series, mode, prColor, poColor, cardColor]);

  const coverage = current.prValue ? Math.round((current.poValue / current.prValue) * 100) : null;

  return (
    <DashboardCard
      className={className}
      title="Spend trend"
      subtitle={`Requisition demand vs. committed PO spend · ${range.longLabel.toLowerCase()}, by ${range.bucket}`}
      icon={TrendingUp}
      actions={<Segmented options={MODES} value={mode} onChange={setMode} ariaLabel="Trend measure" />}
    >
      <div className="grid grid-cols-3 gap-4 pb-3 mb-2 border-b border-border">
        <LegendStat
          color={prColor}
          label="Requisition demand"
          value={isValue ? formatCompactInr(current.prValue) : current.prCount}
        />
        <LegendStat
          color={poColor}
          shape="line"
          label="PO committed"
          value={isValue ? formatCompactInr(current.poValue) : current.poCount}
        />
        <LegendStat label="Demand converted to PO" value={coverage == null ? '—' : `${coverage}%`} />
      </div>
      {loading && !hasData ? (
        <ChartSkeleton height={HEIGHT} />
      ) : hasData ? (
        <AgChart options={options} style={{ height: HEIGHT, width: '100%' }} />
      ) : (
        <ChartEmpty height={HEIGHT} message="No requisitions or purchase orders in this period." />
      )}
    </DashboardCard>
  );
}
