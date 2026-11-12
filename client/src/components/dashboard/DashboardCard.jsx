import clsx from 'clsx';

/**
 * @param {{
 *   title: string;
 *   subtitle?: string;
 *   icon?: import('react').ComponentType<{ className?: string }>;
 *   actions?: import('react').ReactNode;
 *   footer?: import('react').ReactNode;
 *   className?: string;
 *   bodyClassName?: string;
 *   children: import('react').ReactNode;
 * }} props
 */
export default function DashboardCard({ title, subtitle, icon: Icon, actions, footer, className, bodyClassName, children }) {
  return (
    <section className={clsx('page-panel flex flex-col min-w-0 overflow-hidden', className)} aria-label={title}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon ? (
            <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg tracking-tight truncate">{title}</h3>
            {subtitle ? <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </header>
      <div className={clsx('flex-1 min-h-0 px-5 pb-4', bodyClassName)}>{children}</div>
      {footer ? <footer className="px-5 py-2.5 border-t border-border text-xs text-muted">{footer}</footer> : null}
    </section>
  );
}

/**
 * @param {{
 *   options: { id: string; label: string }[];
 *   value: string;
 *   onChange: (id: string) => void;
 *   ariaLabel: string;
 *   size?: 'sm' | 'md';
 * }} props
 */
export function Segmented({ options, value, onChange, ariaLabel, size = 'sm' }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center rounded-lg bg-muted p-0.5 border border-border">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={clsx(
              'rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChartEmpty({ message = 'No data for this period yet.', height = 260 }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center text-xs text-muted rounded-lg border border-dashed border-border bg-muted/40"
      style={{ height }}
    >
      <span className="h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
      </span>
      {message}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }) {
  return <div className="rounded-lg bg-muted/70 animate-pulse" style={{ height }} aria-hidden />;
}
