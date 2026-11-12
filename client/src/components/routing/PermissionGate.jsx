import { usePermissions } from '../../hooks/usePermissions';

const Denied = ({ message }) => (
  <div className="flex items-center justify-center min-h-[280px]">
    <div className="page-panel p-8 text-center max-w-md">
      <h2 className="text-lg font-semibold text-fg mb-2">Access denied</h2>
      <p className="text-muted text-sm">{message}</p>
    </div>
  </div>
);

/** Renders children if user has permission (or any alternative). */
export function PermissionGate({ permission, alternativePermissions = [], children, deniedMessage }) {
  const { hasPermission } = usePermissions();
  const allowed =
    (permission && hasPermission(permission)) ||
    alternativePermissions.some((p) => hasPermission(p));

  if (!allowed) {
    return <Denied message={deniedMessage || 'You do not have permission to view this page.'} />;
  }
  return children;
}

export default PermissionGate;
