import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { BRAND_LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from '../../constants/branding';

const MARK_SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
  '2xl': 'h-16 w-16',
  hero: 'h-20 w-20'
};

export function BrandMark({ size = 'md', className, alt = '' }) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={clsx('object-contain shrink-0', MARK_SIZES[size] ?? MARK_SIZES.md, className)}
      width={48}
      height={48}
      decoding="async"
    />
  );
}

/**
 * @param {{
 *   size?: keyof typeof MARK_SIZES;
 *   showWordmark?: boolean;
 *   tagline?: string | false;
 *   asLink?: boolean;
 *   to?: string;
 *   onNavigate?: () => void;
 *   className?: string;
 *   wordmarkClassName?: string;
 *   taglineClassName?: string;
 *   markClassName?: string;
 * }} props
 */
export default function BrandLogo({
  size = 'md',
  showWordmark = true,
  tagline,
  asLink = false,
  to = '/',
  onNavigate,
  className,
  wordmarkClassName,
  taglineClassName,
  markClassName
}) {
  const body = (
    <div className={clsx('flex items-center gap-2.5 min-w-0', className)}>
      <BrandMark size={size} className={markClassName} />
      {showWordmark ? (
        <div className="min-w-0">
          <p className={clsx('font-semibold text-sm truncate tracking-tight', wordmarkClassName)}>{BRAND_NAME}</p>
          {tagline !== false ? (
            <p className={clsx('text-[10px] uppercase tracking-wider truncate', taglineClassName ?? 'text-muted')}>
              {tagline ?? BRAND_TAGLINE}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (asLink) {
    return (
      <Link
        to={to}
        onClick={onNavigate}
        aria-label={BRAND_NAME}
        className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    );
  }

  return body;
}
