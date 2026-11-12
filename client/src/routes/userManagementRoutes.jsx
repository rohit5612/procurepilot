import { Navigate, Route, Routes } from 'react-router-dom';
import PermissionGate from '../components/routing/PermissionGate';
import AdministrationLayout from '../components/layout/AdministrationLayout';
import {
  AdministrationFeatureRedirect,
  AdministrationModuleRedirect,
} from '../components/routing/AdministrationRedirects';
import UserDirectoryPage from '../pages/user-management/UserDirectoryPage';
import UserAssignmentPage from '../pages/user-management/UserAssignmentPage';
import ArchivedUsersPage from '../pages/user-management/ArchivedUsersPage';
import UserApprovalPage from '../pages/user-management/UserApprovalPage';
import AppealManagementPage from '../pages/user-management/AppealManagementPage';
import RoleManagementPage from '../pages/user-management/RoleManagementPage';
import DepartmentManagementPage from '../pages/user-management/DepartmentManagementPage';

export default function UserManagementRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdministrationModuleRedirect />} />

      <Route element={<AdministrationLayout />}>
        <Route
          path="user-operations"
          element={<AdministrationFeatureRedirect featureId="user-operations" />}
        />
        <Route
          path="approval-workflows"
          element={<AdministrationFeatureRedirect featureId="approval-workflows" />}
        />
        <Route path="organization" element={<AdministrationFeatureRedirect featureId="organization" />} />

        <Route
          path="user-operations/user-directory"
          element={
            <PermissionGate permission="user_management.user_directory.read">
              <UserDirectoryPage />
            </PermissionGate>
          }
        />
        <Route
          path="user-operations/user-assignment"
          element={
            <PermissionGate permission="user_management.user_assignment.read">
              <UserAssignmentPage />
            </PermissionGate>
          }
        />
        <Route
          path="user-operations/archived-users"
          element={<Navigate to="/user-management/approval-workflows/archived-users" replace />}
        />

        <Route
          path="approval-workflows/user-approval"
          element={
            <PermissionGate permission="user_management.user_approval.read">
              <UserApprovalPage />
            </PermissionGate>
          }
        />
        <Route
          path="approval-workflows/archived-users"
          element={
            <PermissionGate permission="user_management.archived_users.read">
              <ArchivedUsersPage />
            </PermissionGate>
          }
        />
        <Route
          path="approval-workflows/appeals"
          element={
            <PermissionGate permission="user_management.appeals.read">
              <AppealManagementPage />
            </PermissionGate>
          }
        />

        <Route
          path="organization/role-management"
          element={
            <PermissionGate permission="user_management.role_management.read">
              <RoleManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="organization/department-management"
          element={
            <PermissionGate permission="user_management.department_management.read">
              <DepartmentManagementPage />
            </PermissionGate>
          }
        />
      </Route>

      <Route path="*" element={<AdministrationModuleRedirect />} />
    </Routes>
  );
}
