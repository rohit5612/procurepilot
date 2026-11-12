import { Link, useLocation } from 'react-router-dom';
import { CreditCard, Shield } from 'lucide-react';

const TABS = [
  { path: '/admin/policy', label: 'Role spend matrix', icon: Shield, end: true },
  { path: '/admin/policy/audit', label: 'PayPal & ledger audit', icon: CreditCard, end: false }
];

export default function PolicySectionNav() {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Policy sections">
      {TABS.map(({ path, label, icon: Icon, end }) => {
        const active = end ? pathname === path : pathname.startsWith(path);
        return (
          <Link
            key={path}
            to={path}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border border-border text-muted hover:text-fg hover:border-primary/40'
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
