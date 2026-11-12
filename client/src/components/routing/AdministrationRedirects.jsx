import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getAdministrationTabHref,
  getDefaultAdministrationFeatureHref,
  getVisibleAdminTabs,
  ADMINISTRATION_FEATURES,
} from '../../navigation/administrationNav';

export function AdministrationModuleRedirect() {
  const { hasPermission } = usePermissions();
  const href = getDefaultAdministrationFeatureHref(hasPermission);
  if (!href) {
    return (
      <div className="page-panel p-8 text-center text-muted text-sm">
        You do not have access to administration features.
      </div>
    );
  }
  return <Navigate to={href} replace />;
}

export function AdministrationFeatureRedirect({ featureId }) {
  const { hasPermission } = usePermissions();
  const feature = ADMINISTRATION_FEATURES[featureId];
  const tabs = feature ? getVisibleAdminTabs(feature, hasPermission) : [];
  if (tabs.length === 0) {
    const fallback = getDefaultAdministrationFeatureHref(hasPermission);
    return fallback ? <Navigate to={fallback} replace /> : <Navigate to="/" replace />;
  }
  return <Navigate to={getAdministrationTabHref(feature, tabs[0])} replace />;
}
