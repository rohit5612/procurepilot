import { Navigate, Route, Routes } from 'react-router-dom';
import PermissionGate from '../components/routing/PermissionGate';
import MastersLayout from '../components/layout/MastersLayout';
import { MastersModuleRedirect, MastersTabRedirect } from '../components/routing/MastersRedirects';
import ItemManagementPage from '../pages/inventory/ItemManagementPage';
import CategoryManagementPage from '../pages/inventory/CategoryManagementPage';
import TransactionCategoryManagementPage from '../pages/inventory/TransactionCategoryManagementPage';
import WarehouseManagementPage from '../pages/inventory/WarehouseManagementPage';
import BinManagementPage from '../pages/inventory/BinManagementPage';
import SiteManagementPage from '../pages/inventory/SiteManagementPage';

export default function InventoryRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MastersModuleRedirect />} />

      <Route path="masters" element={<MastersLayout />}>
        <Route index element={<MastersTabRedirect />} />
        <Route
          path="items"
          element={
            <PermissionGate permission="inventory.item_master.read">
              <ItemManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="categories"
          element={
            <PermissionGate permission="inventory.item_master.read">
              <CategoryManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="transaction-categories"
          element={
            <PermissionGate permission="inventory.transaction_categories.read">
              <TransactionCategoryManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="warehouses"
          element={
            <PermissionGate permission="inventory.warehouse_management.read">
              <WarehouseManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="bins"
          element={
            <PermissionGate permission="inventory.bin_management.read">
              <BinManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="sites"
          element={
            <PermissionGate permission="inventory.site_master.read">
              <SiteManagementPage />
            </PermissionGate>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="masters" replace />} />
    </Routes>
  );
}
