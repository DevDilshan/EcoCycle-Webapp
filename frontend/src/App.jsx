import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/layout/AdminLayout'
import ResidentLayout from './components/layout/ResidentLayout'
import CollectorLayout from './components/layout/CollectorLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/admin/DashboardPage'
import PickupRequestsPage from './pages/admin/PickupRequestsPage'
import RoutesPage from './pages/admin/RoutesPage'
import RewardsPage from './pages/admin/RewardsPage'
import RewardCatalogPage from './pages/admin/rewards/RewardCatalogPage'
import RewardRequestsPage from './pages/admin/rewards/RewardRequestsPage'
import RewardHistoryPage from './pages/admin/rewards/RewardHistoryPage'
import RewardAwardPage from './pages/admin/rewards/RewardAwardPage'
import RewardCheckPage from './pages/admin/rewards/RewardCheckPage'
import ApprovalsPage from './pages/admin/ApprovalsPage'
import ComplaintsPage from './pages/admin/ComplaintsPage'
import CompliancePage from './pages/admin/CompliancePage'
import AdminAccountPage from './pages/admin/AdminAccountPage'
import ResidentDashboardPage from './pages/resident/DashboardPage'
import ResidentPickupsPage from './pages/resident/PickupsPage'
import ResidentRewardsPage from './pages/resident/RewardsPage'
import ResidentComplaintsPage from './pages/resident/ComplaintsPage'
import CollectorDashboardPage from './pages/collector/DashboardPage'
import CollectorRoutePage from './pages/collector/RoutePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
