import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronRight,
  Home,
  LogOut,
  Package,
  ShoppingCart,
  Sparkles,
  User,
  Users,
  X
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ADMINISTRATION_SIDEBAR_ITEMS,
  administrationFeatureIsAccessible,
} from '../../navigation/administrationNav';
import {
  PROCUREMENT_SIDEBAR_ITEMS,
  procurementFeatureIsAccessible,
} from '../../navigation/procurementNav';
import { getDefaultMastersHref, mastersModuleIsAccessible } from '../../navigation/mastersNav';

const NAV_SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: Home,
    alwaysVisible: true
  },
  {
    id: 'procurepilot',
    label: 'AI workspace',
    icon: Sparkles,
    module: 'procurepilot',
    children: [
      { label: 'AI Buy', path: '/buy', permission: 'procurepilot.ai_buy.read' },
      { label: 'Policy & budgets', path: '/admin/policy', permission: 'procurepilot.policy_admin.read', minLevel: 1 }
    ]
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: ShoppingCart,
    module: 'procurement',
    children: PROCUREMENT_SIDEBAR_ITEMS.map((item) => ({
      label: item.label,
      path: item.path,
      matchPrefix: item.matchPrefix,
      featureId: item.featureId,
    }))
  },
  {
    id: 'inventory',
    label: 'Masters',
    icon: Package,
    module: 'inventory',
    singleLink: true,
    path: '/inventory/masters',
    matchPrefix: '/inventory/masters',
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Users,
    module: 'user_management',
    children: ADMINISTRATION_SIDEBAR_ITEMS.map((item) => ({
      label: item.label,
      path: item.path,
      matchPrefix: item.matchPrefix,
      adminFeatureId: item.featureId,
    }))
  }
];

function linkAllowed(hasPermission, hasModuleAccess, isAtLeastLevel, section, link) {
  if (section.module && !hasModuleAccess(section.module)) return false;
  if (link?.minLevel != null && !isAtLeastLevel(link.minLevel)) return false;
  if (link?.featureId) return procurementFeatureIsAccessible(link.featureId, hasPermission);
  if (link?.adminFeatureId) return administrationFeatureIsAccessible(link.adminFeatureId, hasPermission);
  if (!link?.permission) return true;
  return hasPermission(link.permission);
}

function isNavLinkActive(pathname, link) {
  if (link.matchPrefix) {
    return pathname === link.path || pathname.startsWith(`${link.matchPrefix}/`);
  }
  return pathname === link.path || pathname.startsWith(`${link.path}/`);
}

function NavLink({ to, active, children, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/85 hover:bg-[var(--sidebar-hover)] hover:text-sidebar-foreground'
      }`}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary shrink-0" />}
      <span className={active ? '' : 'pl-3.5'}>{children}</span>
    </Link>
  );
}

export default function ProcurePilotSidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasPermission, hasModuleAccess, isAtLeastLevel } = usePermissions();
  const [expanded, setExpanded] = useState(() => new Set(['procurepilot', 'procurement']));

  useEffect(() => {
    const active = NAV_SECTIONS.find((s) => {
      if (s.singleLink) {
        return location.pathname === s.path || location.pathname.startsWith(`${s.matchPrefix}/`);
      }
      return s.children?.some((c) => isNavLinkActive(location.pathname, c)) || location.pathname === s.path;
    });
    if (active?.id) setExpanded((prev) => new Set([...prev, active.id]));
  }, [location.pathname]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onNavigate = () => onClose?.();

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`
      : (user?.email?.[0] || 'U').toUpperCase();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[17rem] flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 h-14 flex items-center justify-between border-b border-sidebar-border shrink-0">
          <BrandLogo
            asLink
            to="/"
            onNavigate={onNavigate}
            size="md"
            tagline="SaaS"
            markClassName="rounded-lg bg-white p-1 shadow-sm"
            wordmarkClassName="text-white"
            taglineClassName="text-slate-500"
          />
          <button type="button" className="lg:hidden p-1.5 text-slate-400 hover:text-white" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_SECTIONS.map((section) => {
            if (!section.alwaysVisible && section.module && !hasModuleAccess(section.module)) return null;

            const Icon = section.icon;
            const isHome = section.id === 'home';
            const sectionActive = isHome
              ? location.pathname === '/'
              : section.singleLink
                ? location.pathname.startsWith(section.matchPrefix)
                : section.children?.some((c) => isNavLinkActive(location.pathname, c));
            const isExp = expanded.has(section.id);

            if (isHome || section.singleLink) {
              if (section.singleLink && section.module && !hasModuleAccess(section.module)) return null;
              if (section.singleLink && !mastersModuleIsAccessible(hasPermission)) return null;
              const dest =
                section.singleLink && section.id === 'inventory'
                  ? getDefaultMastersHref(hasPermission) || section.path
                  : section.path;
              const active = section.singleLink
                ? location.pathname === dest ||
                  location.pathname.startsWith(`${section.matchPrefix}/`) ||
                  location.pathname === section.path
                : sectionActive;
              const Icon = section.icon || Home;
              return (
                <Link
                  key={section.id}
                  to={dest}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/85 hover:bg-[var(--sidebar-hover)]'
                  }`}
                >
                  <Icon size={16} className="opacity-80" />
                  {section.label}
                </Link>
              );
            }

            const visibleChildren = (section.children || []).filter((link) =>
              linkAllowed(hasPermission, hasModuleAccess, isAtLeastLevel, section, link)
            );
            if (visibleChildren.length === 0) return null;

            return (
              <div key={section.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    sectionActive ? 'text-white' : 'text-sidebar-foreground/80 hover:bg-[var(--sidebar-hover)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} className="opacity-75" />
                    {section.label}
                  </span>
                  <ChevronRight size={14} className={`opacity-60 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                </button>
                {isExp && (
                  <div className="mt-0.5 ml-2 pl-2 border-l border-sidebar-border space-y-0.5">
                    {visibleChildren.map((link) => {
                      const active = isNavLinkActive(location.pathname, link);
                      return (
                        <NavLink key={link.path} to={link.path} active={active} onNavigate={onNavigate}>
                          {link.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 mb-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-teal-500 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-white">{user?.name || user?.email}</p>
              <p className="text-[11px] truncate text-slate-500">{user?.roleName || 'Member'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
