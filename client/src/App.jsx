import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { usePermissionRefresh } from './hooks/usePermissionRefresh';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { DialogProvider } from './contexts/DialogContext.jsx';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import EmailVerificationSuccess from './pages/auth/EmailVerificationSuccess';
import AppealSubmissionPage from './pages/AppealSubmissionPage';
import PermissionGuard from './components/auth/PermissionGuard';
import AppShell from './components/layout/AppShell';
import ProcurementRoutes from './routes/procurementRoutes';
import InventoryRoutes from './routes/inventoryRoutes';
import UserManagementRoutes from './routes/userManagementRoutes';
import AiBuyPage from './pages/procurepilot/AiBuyPage';
import PolicyAdminPage from './pages/procurepilot/PolicyAdminPage';
import PolicyPayPalAuditPage from './pages/procurepilot/PolicyPayPalAuditPage';

const HomePage = lazy(() => import('./pages/HomePage'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppContent = () => {
  usePermissionRefresh({
    intervalMs: 30000,
    onPermissionUpdate: (newUser, oldUser) => {
      console.log('User permissions automatically updated:', {
        oldRole: oldUser?.roleName,
        newRole: newUser?.roleName,
        oldDept: oldUser?.departmentName,
        newDept: newUser?.departmentName
      });
    }
  });

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterForm />
            </PublicRoute>
          }
        />
        <Route path="/email-verification-success" element={<EmailVerificationSuccess />} />
        <Route path="/appeal/:userId" element={<AppealSubmissionPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Suspense
                fallback={
                  <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="spinner w-8 h-8"></div>
                  </div>
                }
              >
                <HomePage />
              </Suspense>
            }
          />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route
            path="buy"
            element={
              <PermissionGuard permission="procurepilot.ai_buy.read">
                <AiBuyPage />
              </PermissionGuard>
            }
          />
          <Route
            path="admin/policy"
            element={
              <PermissionGuard permission="procurepilot.policy_admin.read" minLevel={1}>
                <PolicyAdminPage />
              </PermissionGuard>
            }
          />
          <Route
            path="admin/policy/audit"
            element={
              <PermissionGuard permission="procurepilot.policy_admin.read" minLevel={1}>
                <PolicyPayPalAuditPage />
              </PermissionGuard>
            }
          />

          <Route
            path="procurement/*"
            element={
              <PermissionGuard module="procurement">
                <ProcurementRoutes />
              </PermissionGuard>
            }
          />

          <Route
            path="inventory/*"
            element={
              <PermissionGuard
                permission="inventory.item_master.read"
                alternativePermissions={[
                  'inventory.warehouse_management.read',
                  'inventory.bin_management.read',
                  'inventory.site_master.read',
                  'inventory.transaction_categories.read'
                ]}
              >
                <InventoryRoutes />
              </PermissionGuard>
            }
          />

          <Route
            path="user-management/*"
            element={
              <PermissionGuard module="user_management">
                <UserManagementRoutes />
              </PermissionGuard>
            }
          />
        </Route>

        <Route path="/system/*" element={<Navigate to="/" replace />} />
        <Route path="/reports/*" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <DialogProvider>
            <AppContent />
          </DialogProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
