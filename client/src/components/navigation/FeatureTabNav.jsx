import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Archive,
  Boxes,
  Building2,
  CheckCircle2,
  FilePlus2,
  GitBranch,
  Layers,
  List,
  MapPin,
  Plus,
  Tags,
  UserCheck,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';
import { isProcurementTabPathActive } from '../../navigation/procurementNav';

const TAB_ICONS = {
  'requisition-list': List,
  'create-requisition': FilePlus2,
  'approval-tasks': CheckCircle2,
  'po-list': List,
  'create-po': Plus,
  'generate-from-pr': GitBranch,
  'supplier-management': Building2,
  'price-lists': Tags,
  'grn-list': List,
  'create-grn': FilePlus2,
  'user-directory': Users,
  'user-assignment': UserCog,
  'user-approval': UserCheck,
  'archived-users': Archive,
  appeals: CheckCircle2,
  'role-management': UserCog,
  'department-management': Building2,
  items: List,
  categories: Tags,
  sites: MapPin,
  warehouses: Warehouse,
  bins: Boxes,
  'transaction-categories': Layers,
};

/**
 * Route-linked horizontal tabs for a module feature area.
 */
export default function FeatureTabNav({
  feature,
  tabs,
  moduleLabel = 'Procurement',
  isTabPathActive = isProcurementTabPathActive,
}) {
  const location = useLocation();

  if (!tabs?.length) return null;

  return (
    <nav
      className="page-panel overflow-hidden shadow-md shadow-indigo-500/[0.04] border-border/80"
      aria-label={`${feature.sidebarLabel} navigation`}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-border/70 bg-gradient-to-br from-card via-card to-muted/30"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{moduleLabel}</p>
          <p className="text-sm font-semibold text-fg tracking-tight truncate">{feature.sidebarLabel}</p>
        </div>
        <span className="hidden sm:inline-flex shrink-0 items-center rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted">
          {tabs.length} {tabs.length === 1 ? 'view' : 'views'}
        </span>
      </div>

      <div className="px-3 py-3 sm:px-4 sm:py-3.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="inline-flex min-w-full sm:min-w-0 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 shadow-inner"
        >
          {tabs.map((tab) => {
            const to = `${feature.basePath}/${tab.segment}`;
            const active = isTabPathActive(location.pathname, feature, tab);
            const Icon = TAB_ICONS[tab.id];

            return (
              <Link
                key={tab.id}
                role="tab"
                to={to}
                aria-selected={active}
                className={clsx(
                  'group relative flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  active
                    ? 'bg-card text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-fg hover:bg-card/70'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {Icon ? (
                  <Icon
                    className={clsx(
                      'h-4 w-4 shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-muted group-hover:text-fg'
                    )}
                    aria-hidden
                  />
                ) : null}
                <span>{tab.label}</span>
                {active ? (
                  <span
                    className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-primary via-chart-2 to-chart-3 opacity-90"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
