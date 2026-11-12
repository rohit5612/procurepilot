import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { AlertOctagon, BellRing, CalendarX, ChevronRight, FilePen, Truck } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { formatCompactInr } from '../../utils/dashboardMetrics';

const TONES = {
  danger: { icon: AlertOctagon, chip: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  warning: { icon: CalendarX, chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  info: { icon: Truck, chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-400' },
  neutral: { icon: FilePen, chip: 'bg-muted text-muted' }
};

/**
 * @param {{
 *   items: { id: string; tone: keyof typeof TONES; title: string; description: string; count: number; value?: number; href: string }[];
 *   loading?: boolean;
 *   className?: string;
 * }} props
 */
export default function AttentionPanel({ items, loading = false, className }) {
  const open = items.filter((i) => i.count > 0).length;

  return (
    <DashboardCard
      className={className}
      title="Needs attention"
      subtitle={open ? `${open} area${open === 1 ? '' : 's'} need follow-up` : 'All clear right now'}
      icon={BellRing}
      bodyClassName="px-3 pb-3"
    >
      <ul className="space-y-1.5">
        {items.map((item) => {
          const tone = TONES[item.tone] || TONES.neutral;
          const Icon = tone.icon;
          const idle = item.count === 0;
          return (
            <li key={item.id}>
              <Link
                to={item.href}
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-2.5 py-2.5 min-h-[44px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  idle && 'opacity-60'
                )}
              >
                <span className={clsx('h-9 w-9 shrink-0 rounded-lg flex items-center justify-center', tone.chip)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-fg truncate">{item.title}</span>
                  <span className="block text-xs text-muted truncate">
                    {item.value ? `${formatCompactInr(item.value)} · ` : ''}
                    {item.description}
                  </span>
                </span>
                {loading ? (
                  <span className="h-5 w-6 rounded bg-muted animate-pulse" aria-hidden />
                ) : (
                  <span className={clsx('text-sm font-bold tabular-nums', idle ? 'text-muted' : 'text-fg')}>{item.count}</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary transition-colors" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
