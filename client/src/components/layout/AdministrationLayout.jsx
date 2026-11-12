import { Outlet, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import FeatureTabNav from '../navigation/FeatureTabNav';
import {
  getAdministrationFeatureFromPath,
  getVisibleAdminTabs,
  isAdministrationTabPathActive,
  shouldShowAdministrationFeatureTabs,
} from '../../navigation/administrationNav';

export default function AdministrationLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const feature = getAdministrationFeatureFromPath(location.pathname);
  const showTabs = shouldShowAdministrationFeatureTabs(location.pathname);
  const tabs = feature ? getVisibleAdminTabs(feature, hasPermission) : [];

  return (
    <div className="space-y-6">
      {showTabs && feature && tabs.length > 0 ? (
        <FeatureTabNav
          feature={feature}
          tabs={tabs}
          moduleLabel="Administration"
          isTabPathActive={isAdministrationTabPathActive}
        />
      ) : null}
      <Outlet />
    </div>
  );
}
