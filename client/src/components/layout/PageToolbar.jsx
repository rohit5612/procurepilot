export default function PageToolbar({ description, children, className = '' }) {
  if (!description && !children) return null;
  return (
    <div
      className={`page-panel px-4 py-3 sm:px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 ${className}`}
    >
      {description ? <p className="text-sm text-muted">{description}</p> : <span />}
      {children ? <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">{children}</div> : null}
    </div>
  );
}
