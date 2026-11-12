import { Outlet, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import FeatureTabNav from '../navigation/FeatureTabNav';
import {
  getMastersFeatureFromPath,
  getVisibleMastersTabs,
  isMastersTabPathActive,
  shouldShowMastersTabs,
} from '../../navigation/mastersNav';

export default function MastersLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const feature = getMastersFeatureFromPath(location.pathname);
  const showTabs = shouldShowMastersTabs(location.pathname);
  const tabs = feature ? getVisibleMastersTabs(feature, hasPermission) : [];

  return (
    <div className="space-y-6">
      {showTabs && feature && tabs.length > 0 ? (
        <FeatureTabNav
          feature={feature}
          tabs={tabs}
          moduleLabel="Masters"
          isTabPathActive={isMastersTabPathActive}
        />
      ) : null}
      <Outlet />
    </div>
  );
}
