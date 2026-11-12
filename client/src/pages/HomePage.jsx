import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, LayoutGrid, Package, RefreshCw, ShoppingCart, Sparkles, Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { computeDashboardMetrics, DASHBOARD_RANGES, getRangeStartIso } from '../utils/dashboardMetrics';
import DashboardCard, { Segmented } from '../components/dashboard/DashboardCard';
import DashboardKpiCards from '../components/dashboard/DashboardKpiCards';
import SpendTrendChart from '../components/dashboard/SpendTrendChart';
import PipelineDonut from '../components/dashboard/PipelineDonut';
import ProcurementFunnel from '../components/dashboard/ProcurementFunnel';
import SpendBreakdownChart from '../components/dashboard/SpendBreakdownChart';
import SupplierLeaderboard from '../components/dashboard/SupplierLeaderboard';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import DashboardActivityGrid from '../components/dashboard/DashboardActivityGrid';
import BrandLogo from '../components/common/BrandLogo';

const RANGE_STORAGE_KEY = 'pp.dashboard.range';

const QUICK_LINKS = [
  { title: 'AI Buy', description: 'Natural-language requests with policy checks', href: '/buy', icon: Sparkles },
  { title: 'Procurement', description: 'Requisitions, POs and suppliers', href: '/procurement/pr', icon: ShoppingCart },
  {
    title: 'Masters',
    description: 'Items, sites, warehouses, and reference data',
    href: '/inventory/masters',
    icon: Package,
  },
  { title: 'Administration', description: 'Users, roles and departments', href: '/user-management/user-operations', icon: Users }
];

const rangeOptions = DASHBOARD_RANGES.map((r) => ({ id: r.id, label: r.label }));

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useRelativeTime(date) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!date) return null;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function QuickActions({ className }) {
  return (
    <DashboardCard title="Quick actions" subtitle="Jump straight into a workflow" icon={Zap} className={className} bodyClassName="px-3 pb-3">
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-1.5">
        {QUICK_LINKS.map(({ title, description, href, icon: Icon }) => (
          <li key={href}>
            <Link
              to={href}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 min-h-[44px] hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-fg">{title}</span>
                <span className="block text-xs text-muted truncate">{description}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const name = user?.first_name || user?.name?.split(' ')[0];

  const [rangeId, setRangeId] = useState(() => localStorage.getItem(RANGE_STORAGE_KEY) || '30d');
  useEffect(() => {
    localStorage.setItem(RANGE_STORAGE_KEY, rangeId);
  }, [rangeId]);

  const canViewPr = hasPermission('procurement.purchase_requisition.read');
  const canViewPo = hasPermission('procurement.purchase_order.read');
  const canViewGrn = hasPermission('procurement.goods_receipt.read');
  const canViewProcurement =
    canViewPr || canViewPo || canViewGrn || hasPermission('procurement.supplier_management.read');
  const canApprovePr = hasPermission('procurement.purchase_requisition.approve');
  const canApprovePo = hasPermission('procurement.purchase_order.approve');

  const analyticsFrom = useMemo(() => getRangeStartIso(rangeId), [rangeId]);

  const {
    loading,
    error,
    stats,
    requisitions,
    purchaseOrders,
    activityRows,
    approvalRows,
    analytics,
    lastUpdated,
    poPendingCount,
    refresh
  } = useHomeDashboard(user, {
    enabled: canViewProcurement,
    canViewPo,
    canViewGrn,
    canApprovePr,
    canApprovePo,
    analyticsFrom
  });

  const metrics = useMemo(
    () => computeDashboardMetrics({ requisitions, purchaseOrders, approvalRows, stats, rangeId }),
    [requisitions, purchaseOrders, approvalRows, stats, rangeId]
  );

  const updatedLabel = useRelativeTime(lastUpdated);
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="space-y-6">
      <section className="page-panel relative overflow-hidden px-5 py-5 lg:px-7 lg:py-6">
        <div
          className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-gradient-to-bl from-indigo-500/20 via-violet-500/10 to-transparent blur-3xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-gradient-to-tr from-teal-400/10 to-transparent blur-3xl pointer-events-none"
          aria-hidden
        />
        <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div className="min-w-0">
            <BrandLogo size="md" tagline={false} className="mb-4" />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{today}</p>
            <h2 className="mt-1.5 text-2xl lg:text-3xl font-bold text-fg tracking-tight">
              {greeting()}
              {name ? `, ${name}` : ''}
            </h2>
            <p className="text-muted mt-1.5 max-w-2xl text-sm leading-relaxed">
              {canViewProcurement
                ? `Procurement command center — demand, commitments, approvals and supplier performance for the ${metrics.range.longLabel.toLowerCase()}.`
                : 'Your workspace shortcuts are below.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canViewProcurement ? (
              <>
                <span className="inline-flex items-center gap-2 text-xs text-muted mr-1" aria-live="polite">
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {loading ? 'Syncing…' : updatedLabel ? `Updated ${updatedLabel}` : 'Live'}
                </span>
                <Segmented options={rangeOptions} value={rangeId} onChange={setRangeId} ariaLabel="Reporting period" size="md" />
                <button type="button" onClick={refresh} disabled={loading} className="btn btn-secondary btn-sm h-9" aria-label="Refresh dashboard">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <Link to="/procurement/pr" className="btn btn-secondary h-9 hidden sm:inline-flex">
                  <LayoutGrid size={16} className="mr-2" />
                  Procurement
                </Link>
              </>
            ) : null}
            <Link to="/buy" className="btn btn-primary h-9">
              <Sparkles size={16} className="mr-2" />
              Start AI Buy
            </Link>
          </div>
        </div>
      </section>

      {canViewProcurement ? (
        <>
          {error ? (
            <div role="alert" className="page-panel p-4 flex items-start gap-3 text-sm text-danger border-danger/30">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Could not refresh dashboard data</p>
                <p className="text-muted mt-1">{error}</p>
              </div>
              <button type="button" onClick={refresh} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          ) : null}

          <DashboardKpiCards
            metrics={metrics}
            stats={stats}
            poPendingCount={poPendingCount}
            myApprovalsCount={approvalRows.length}
            loading={loading && !lastUpdated}
          />

          <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
            <SpendTrendChart metrics={metrics} loading={loading} className="xl:col-span-8" />
            <PipelineDonut pipeline={metrics.pipeline} loading={loading} className="xl:col-span-4" />
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            <ProcurementFunnel funnel={metrics.funnel} loading={loading} />
            <SpendBreakdownChart
              departments={metrics.departments}
              sites={metrics.sites}
              categories={metrics.categories}
              clusters={analytics.clusters}
              showPoLenses={canViewPo}
              loading={loading}
            />
            {canViewPo ? (
              <SupplierLeaderboard
                topSuppliers={analytics.topSuppliers}
                suppliersFromList={metrics.suppliersFromList}
                loading={loading || analytics.loading}
                className="md:col-span-2 xl:col-span-1"
              />
            ) : null}
          </div>

          <div className="grid gap-6 grid-cols-1 xl:grid-cols-12 items-start">
            <DashboardActivityGrid
              className="xl:col-span-8"
              activityRows={activityRows}
              approvalRows={approvalRows}
              loading={loading}
              onRefresh={refresh}
              showApprovalsTab={canApprovePr || canApprovePo}
            />
            <div className="xl:col-span-4 space-y-6">
              <AttentionPanel items={metrics.attention} loading={loading && !lastUpdated} />
              <QuickActions />
            </div>
          </div>
        </>
      ) : (
        <>
          <section className="page-panel p-6 text-sm text-muted">
            Procurement metrics are hidden until you have requisition or purchase order access. Use the shortcuts below to
            open modules available to your role.
          </section>
          <QuickActions />
        </>
      )}
    </div>
  );
}
