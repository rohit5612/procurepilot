import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import clsx from 'clsx';
import { Activity, RefreshCw, Search } from 'lucide-react';
import DashboardCard, { ChartEmpty, Segmented } from './DashboardCard';
import { useAgTheme } from '../../hooks/useAgTheme';
import { formatInr } from '../../utils/dashboardActivity';

const TABS = [
  { id: 'activity', label: 'Recent activity' },
  { id: 'approvals', label: 'My approvals' }
];

const DOC_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'PR', label: 'PR' },
  { id: 'PO', label: 'PO' },
  { id: 'GRN', label: 'GRN' }
];

const STATUS_STYLES = {
  draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  submitted: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  pending_approval: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  issued: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
  closed: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  rejected: 'bg-rose-500/12 text-rose-700 dark:text-rose-400',
  cancelled: 'bg-slate-500/10 text-slate-500',
  canceled: 'bg-slate-500/10 text-slate-500',
  withdrawn: 'bg-slate-500/10 text-slate-500'
};

function TypeCell({ value }) {
  return (
    <div className="flex items-center h-full">
      <span
        className={clsx(
          'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-wide',
          value === 'PO'
            ? 'bg-teal-500/12 text-teal-700 dark:text-teal-300'
            : value === 'GRN'
              ? 'bg-amber-500/12 text-amber-800 dark:text-amber-300'
              : 'bg-primary/12 text-primary'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatusCell({ value, data }) {
  return (
    <div className="flex items-center h-full">
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs leading-4 font-medium',
          STATUS_STYLES[data?.status] || 'bg-muted text-muted'
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {value}
      </span>
    </div>
  );
}

function DocumentCell({ value, data }) {
  return (
    <div className="flex flex-col justify-center leading-tight h-full min-w-0">
      <span className="font-mono text-[13px] text-fg truncate">{value}</span>
      <span className="text-[11px] text-muted truncate">{data?.title}</span>
    </div>
  );
}

/**
 * @param {{
 *   activityRows: object[];
 *   approvalRows: object[];
 *   loading?: boolean;
 *   onRefresh?: () => void;
 *   showApprovalsTab?: boolean;
 *   className?: string;
 * }} props
 */
export default function DashboardActivityGrid({
  activityRows,
  approvalRows,
  loading = false,
  onRefresh,
  showApprovalsTab = true,
  className
}) {
  const navigate = useNavigate();
  const { gridTheme } = useAgTheme();
  const [tab, setTab] = useState('activity');
  const [docFilter, setDocFilter] = useState('all');
  const [search, setSearch] = useState('');

  const visibleTabs = showApprovalsTab
    ? TABS.map((t) => (t.id === 'approvals' && approvalRows.length ? { ...t, label: `${t.label} (${approvalRows.length})` } : t))
    : TABS.filter((t) => t.id === 'activity');
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'activity';

  const rowData = useMemo(() => {
    const source = activeTab === 'approvals' ? approvalRows : activityRows;
    return docFilter === 'all' ? source : source.filter((r) => r.docType === docFilter);
  }, [activeTab, approvalRows, activityRows, docFilter]);

  const columnDefs = useMemo(
    () => [
      { field: 'docType', headerName: 'Type', width: 76, cellRenderer: TypeCell },
      { field: 'documentNumber', headerName: 'Document', flex: 1.4, minWidth: 200, cellRenderer: DocumentCell },
      { field: 'statusLabel', headerName: 'Status', width: 170, cellRenderer: StatusCell },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 140,
        type: 'rightAligned',
        cellClass: 'tabular-nums font-medium',
        valueGetter: (p) => (p.data?.amount == null ? null : Number(p.data.amount)),
        valueFormatter: (p) => formatInr(p.value)
      },
      { field: 'party', headerName: 'Requester / Supplier', flex: 1, minWidth: 160 },
      {
        field: 'dateLabel',
        headerName: 'Updated',
        width: 130,
        comparator: (_a, _b, nodeA, nodeB) => new Date(nodeA.data?.date || 0) - new Date(nodeB.data?.date || 0)
      },
      { field: 'title', hide: true }
    ],
    []
  );

  const emptyMessage =
    activeTab === 'approvals' ? 'No pending approvals assigned to you. Nice work.' : 'No recent requisitions or purchase orders yet.';

  return (
    <DashboardCard
      className={className}
      title="Document activity"
      subtitle="Latest requisitions and purchase orders across your scope"
      icon={Activity}
      bodyClassName="px-0 pb-0"
      actions={
        onRefresh ? (
          <button type="button" onClick={onRefresh} disabled={loading} className="btn btn-ghost btn-sm" aria-label="Refresh activity">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        ) : null
      }
      footer="Click a row to open the requisition or purchase order."
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-5 pb-3">
        <Segmented options={visibleTabs} value={activeTab} onChange={setTab} ariaLabel="Activity view" />
        <Segmented options={DOC_FILTERS} value={docFilter} onChange={setDocFilter} ariaLabel="Document type" />
        <label className="relative lg:ml-auto w-full lg:w-64">
          <span className="sr-only">Search documents</span>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, title, party…"
            className="w-full h-9 rounded-lg border border-border bg-card pl-8 pr-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {loading && rowData.length === 0 ? (
        <div className="px-5 pb-4">
          <div className="h-[380px] rounded-lg bg-muted/70 animate-pulse" aria-hidden />
        </div>
      ) : rowData.length === 0 ? (
        <div className="px-5 pb-4">
          <ChartEmpty height={280} message={emptyMessage} />
        </div>
      ) : (
        <div className="border-t border-border" style={{ height: 'min(440px, 60vh)', minHeight: 320 }}>
          <AgGridReact
            theme={gridTheme}
            rowData={rowData}
            columnDefs={columnDefs}
            quickFilterText={search}
            includeHiddenColumnsInQuickFilter
            getRowId={(p) => p.data.id}
            rowHeight={52}
            onRowClicked={(e) => {
              if (e.data?.href) navigate(e.data.href);
            }}
            rowClass="cursor-pointer"
            suppressCellFocus
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={false}
            defaultColDef={{ sortable: true, resizable: true, filter: false }}
            overlayNoRowsTemplate='<span class="text-sm">No documents match your search.</span>'
          />
        </div>
      )}
    </DashboardCard>
  );
}
