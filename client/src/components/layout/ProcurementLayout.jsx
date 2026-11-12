import { Outlet, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import FeatureTabNav from '../navigation/FeatureTabNav';
import {
  getProcurementFeatureFromPath,
  getVisibleTabs,
  shouldShowProcurementFeatureTabs,
} from '../../navigation/procurementNav';

export default function ProcurementLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const feature = getProcurementFeatureFromPath(location.pathname);
  const showTabs = shouldShowProcurementFeatureTabs(location.pathname);
  const tabs = feature ? getVisibleTabs(feature, hasPermission) : [];

  return (
    <div className="space-y-6">
      {showTabs && feature && tabs.length > 0 ? (
        <FeatureTabNav feature={feature} tabs={tabs} moduleLabel="Procurement" />
      ) : null}
      <Outlet />
    </div>
  );
}
