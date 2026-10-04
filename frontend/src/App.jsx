import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/layout/AdminLayout'
import ResidentLayout from './components/layout/ResidentLayout'
import CollectorLayout from './components/layout/CollectorLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Each console page is its own chunk: a resident never downloads the admin
// screens or the map library, and the landing page loads without any of them.
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const PickupRequestsPage = lazy(() => import('./pages/admin/PickupRequestsPage'))
const RoutesPage = lazy(() => import('./pages/admin/RoutesPage'))
const RewardsPage = lazy(() => import('./pages/admin/RewardsPage'))
const RewardCatalogPage = lazy(() => import('./pages/admin/rewards/RewardCatalogPage'))
const RewardRequestsPage = lazy(() => import('./pages/admin/rewards/RewardRequestsPage'))
const RewardHistoryPage = lazy(() => import('./pages/admin/rewards/RewardHistoryPage'))
const RewardAwardPage = lazy(() => import('./pages/admin/rewards/RewardAwardPage'))
const RewardCheckPage = lazy(() => import('./pages/admin/rewards/RewardCheckPage'))
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'))
const ComplaintsPage = lazy(() => import('./pages/admin/ComplaintsPage'))
const CompliancePage = lazy(() => import('./pages/admin/CompliancePage'))
const AdminAccountPage = lazy(() => import('./pages/admin/AdminAccountPage'))
const ResidentDashboardPage = lazy(() => import('./pages/resident/DashboardPage'))
const ResidentPickupsPage = lazy(() => import('./pages/resident/PickupsPage'))
const ResidentRewardsPage = lazy(() => import('./pages/resident/RewardsPage'))
const ResidentComplaintsPage = lazy(() => import('./pages/resident/ComplaintsPage'))
const CollectorDashboardPage = lazy(() => import('./pages/collector/DashboardPage'))
const CollectorRoutePage = lazy(() => import('./pages/collector/RoutePage'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="pickup-requests" element={<PickupRequestsPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="rewards/catalog" element={<RewardCatalogPage />} />
            <Route path="rewards/requests" element={<RewardRequestsPage />} />
            <Route path="rewards/history" element={<RewardHistoryPage />} />
            <Route path="rewards/award" element={<RewardAwardPage />} />
            <Route path="rewards/check" element={<RewardCheckPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="account" element={<AdminAccountPage />} />
          </Route>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="resident">
                <ResidentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ResidentDashboardPage />} />
            <Route path="pickups" element={<ResidentPickupsPage />} />
            <Route path="rewards" element={<ResidentRewardsPage />} />
            <Route path="complaints" element={<ResidentComplaintsPage />} />
            {/* The same console account screen the admin and collector sides
                use. It reads the role from the session, so the resident side no
                longer needs its own unstyled copy of these forms. */}
            <Route path="account" element={<AdminAccountPage />} />
          </Route>
          <Route
            path="/collector"
            element={
              <ProtectedRoute requiredRole="collector">
                <CollectorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CollectorDashboardPage />} />
            <Route path="route" element={<CollectorRoutePage />} />
            {/* The console-styled account screen, shared with /admin/account:
                it is role-agnostic, so the collector side reuses it rather than
                keeping a second copy of the same profile and password forms. */}
            <Route path="account" element={<AdminAccountPage />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
