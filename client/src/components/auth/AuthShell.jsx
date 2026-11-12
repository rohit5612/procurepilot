import { Link } from 'react-router-dom';
import clsx from 'clsx';
import BrandLogo from '../common/BrandLogo';
import { BRAND_NAME } from '../../constants/branding';

const DEFAULT_FEATURES = [
  { title: 'AI requirement extraction', detail: 'Turn plain-language needs into structured requisitions.' },
  { title: 'Policy engine', detail: 'Budgets, categories, and rules enforced before spend.' },
  { title: 'Approvals & audit trail', detail: 'Human sign-off with explanations at every step.' },
];

/**
 * Split auth layout: marketing panel + form column.
 */
export default function AuthShell({
  badge,
  headline,
  headlineAccent,
  description,
  features = DEFAULT_FEATURES,
  alternateLink,
  children,
  formMaxWidth = 'max-w-[420px]',
  formClassName,
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-bg">
      <section
        className="relative lg:w-[min(52%,560px)] lg:min-w-[420px] shrink-0 overflow-hidden bg-[#0b1220] text-white px-6 py-10 sm:px-10 lg:px-12 lg:py-14 flex flex-col justify-between"
        aria-hidden={false}
      >
        <div className="absolute inset-0 app-mesh opacity-90" aria-hidden />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />
        <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" aria-hidden />
        <div className="absolute top-1/2 right-[-10%] h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />

        <div className="relative z-[1]">
          <BrandLogo
            size="lg"
            markClassName="rounded-xl bg-white p-1.5 shadow-lg shadow-black/20"
            wordmarkClassName="text-lg text-white"
            taglineClassName="text-slate-400 normal-case text-xs tracking-normal"
          />
        </div>

        <div className="relative z-[1] max-w-md my-10 lg:my-8">
          {badge ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" aria-hidden />
              {badge}
            </span>
          ) : null}
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-[1.15] tracking-tight">
            {headline}{' '}
            {headlineAccent ? <span className="text-gradient-brand">{headlineAccent}</span> : null}
          </h1>
          {description ? (
            <p className="mt-4 text-slate-400 text-base leading-relaxed">{description}</p>
          ) : null}

          <ul className="mt-8 space-y-4">
            {features.map((item) => (
              <li key={item.title} className="flex gap-3 text-sm">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-teal-400 text-xs font-bold"
                  aria-hidden
                >
                  ✓
                </span>
                <div>
                  <p className="font-medium text-slate-100">{item.title}</p>
                  {item.detail ? <p className="text-slate-400 mt-0.5 leading-snug">{item.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Nuvorn · {BRAND_NAME}</p>
          {alternateLink ? (
            <Link to={alternateLink.to} className="text-indigo-300 hover:text-white transition-colors font-medium">
              {alternateLink.label}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-start lg:items-center justify-center p-6 sm:p-10 overflow-y-auto">
          <div className={clsx('w-full fade-in', formMaxWidth, formClassName)}>{children}</div>
        </div>
      </section>
    </div>
  );
}

export function AuthFormCard({ title, subtitle, headerAction, children, className }) {
  return (
    <div className={clsx('page-panel overflow-hidden shadow-lg shadow-indigo-500/5 border-border/80', className)}>
      <div className="px-6 py-6 sm:px-8 sm:py-7 border-b border-border bg-gradient-to-b from-card to-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo size="md" className="mb-5 lg:hidden" tagline={false} />
            <h2 className="text-2xl font-bold text-fg tracking-tight">{title}</h2>
            {subtitle ? <p className="text-sm text-muted mt-1.5">{subtitle}</p> : null}
          </div>
          {headerAction}
        </div>
      </div>
      <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
    </div>
  );
}

export function AuthInput({
  id,
  name,
  label,
  type = 'text',
  icon: Icon,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  disabled,
  autoComplete,
  maxLength,
  trailing,
  className,
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label text-fg mb-1.5">{label}</label>
      <div className="relative">
        {Icon ? (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" aria-hidden />
        ) : null}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          className={clsx('input bg-card py-2.5 text-sm', Icon && 'pl-10', trailing && 'pr-10', error && 'input-error')}
        />
        {trailing}
      </div>
      {error ? <p className="form-error text-xs mt-1">{error}</p> : null}
    </div>
  );
}
