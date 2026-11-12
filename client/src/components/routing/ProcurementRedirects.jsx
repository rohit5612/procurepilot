import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getDefaultProcurementFeatureHref,
  getProcurementTabHref,
  getVisibleTabs,
  PROCUREMENT_FEATURES,
} from '../../navigation/procurementNav';

export function ProcurementModuleRedirect() {
  const { hasPermission } = usePermissions();
  const href = getDefaultProcurementFeatureHref(hasPermission);
  if (!href) {
    return (
      <div className="page-panel p-8 text-center text-muted text-sm">
        You do not have access to any procurement features.
      </div>
    );
  }
  return <Navigate to={href} replace />;
}

export function ProcurementFeatureRedirect({ featureId }) {
  const { hasPermission } = usePermissions();
  const feature = PROCUREMENT_FEATURES[featureId];
  const tabs = feature ? getVisibleTabs(feature, hasPermission) : [];
  if (tabs.length === 0) {
    const fallback = getDefaultProcurementFeatureHref(hasPermission);
    return fallback ? <Navigate to={fallback} replace /> : <Navigate to="/" replace />;
  }
  return <Navigate to={getProcurementTabHref(feature, tabs[0])} replace />;
}
