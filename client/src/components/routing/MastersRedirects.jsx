import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { getDefaultMastersHref } from '../../navigation/mastersNav';

export function MastersModuleRedirect() {
  const { hasPermission } = usePermissions();
  const href = getDefaultMastersHref(hasPermission);
  if (!href) {
    return (
      <div className="page-panel p-8 text-center text-muted text-sm">
        You do not have access to masters.
      </div>
    );
  }
  return <Navigate to={href.replace('/inventory/', '')} replace />;
}

export function MastersTabRedirect() {
  const { hasPermission } = usePermissions();
  const href = getDefaultMastersHref(hasPermission);
  if (!href) return <Navigate to="/" replace />;
  const segment = href.replace('/inventory/masters/', '');
  return <Navigate to={segment} replace />;
}
