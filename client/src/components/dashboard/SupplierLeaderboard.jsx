import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { Trophy } from 'lucide-react';
import DashboardCard, { ChartEmpty, ChartSkeleton } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';
import { formatCompactInr } from '../../utils/dashboardMetrics';
import { formatInr } from '../../utils/dashboardActivity';

const HEIGHT = 286;

function RankCell({ value }) {
  const medal = value <= 3;
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        medal ? 'bg-primary/15 text-primary' : 'bg-muted text-muted'
      }`}
    >
      {value}
    </span>
  );
}

function SupplierCell({ value, data }) {
  return (
    <div className="flex flex-col justify-center leading-tight h-full min-w-0">
      <span className="font-medium text-fg truncate">{value}</span>
      {data.count != null ? <span className="text-[11px] text-muted">{data.count} PO{data.count === 1 ? '' : 's'}</span> : null}
    </div>
  );
}

function ShareCell({ value, data }) {
  return (
    <div className="flex flex-col justify-center gap-1 h-full">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-fg tabular-nums" title={formatInr(data.value)}>
          {formatCompactInr(data.value)}
        </span>
        <span className="text-[11px] text-muted tabular-nums">{value.toFixed(value < 10 ? 1 : 0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   topSuppliers: { label: string; value: number }[];
 *   suppliersFromList: { label: string; value: number; count: number }[];
 *   loading?: boolean;
 *   className?: string;
 * }} props
 */
export default function SupplierLeaderboard({ topSuppliers, suppliersFromList, loading = false, className }) {
  const { gridTheme } = useAgTheme();

  const rows = useMemo(() => {
    const counts = new Map(suppliersFromList.map((s) => [s.label, s.count]));
    const base = topSuppliers.length
      ? topSuppliers.map((s) => ({ label: s.label, value: s.value, count: counts.get(s.label) }))
      : suppliersFromList.filter((s) => s.label !== 'Other');
    const total = base.reduce((sum, s) => sum + s.value, 0);
    return base.map((s, i) => ({ ...s, rank: i + 1, share: total ? (s.value / total) * 100 : 0 }));
  }, [topSuppliers, suppliersFromList]);

  const columnDefs = useMemo(
    () => [
      { field: 'rank', headerName: '#', width: 56, cellRenderer: RankCell, sortable: false },
      { field: 'label', headerName: 'Supplier', flex: 1, minWidth: 120, cellRenderer: SupplierCell },
      { field: 'share', headerName: 'Spend · share', width: 150, cellRenderer: ShareCell, sort: 'desc' }
    ],
    []
  );

  return (
    <DashboardCard
      className={className}
      title="Supplier leaderboard"
      subtitle="Top suppliers by purchase value"
      icon={Trophy}
      bodyClassName="px-0 pb-0"
      footer={
        <Link to="/procurement/supplier/supplier-management" className="font-medium text-primary hover:underline">
          Manage suppliers
        </Link>
      }
    >
      {loading && !rows.length ? (
        <div className="px-5 pb-4">
          <ChartSkeleton height={HEIGHT - 16} />
        </div>
      ) : rows.length ? (
        <div style={{ height: HEIGHT }} className="border-t border-border">
          <AgGridReact
            theme={gridTheme}
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.label}
            rowHeight={52}
            suppressCellFocus
            defaultColDef={{ resizable: false, sortable: true }}
          />
        </div>
      ) : (
        <div className="px-5 pb-4">
          <ChartEmpty height={HEIGHT - 16} message="No committed purchase orders yet." />
        </div>
      )}
    </DashboardCard>
  );
}
