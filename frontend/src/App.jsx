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
import ApprovalsPage from './pages/admin/ApprovalsPage'
import ComplaintsPage from './pages/admin/ComplaintsPage'
import CompliancePage from './pages/admin/CompliancePage'
import AccountPage from './pages/admin/AccountPage'
import ResidentDashboardPage from './pages/resident/DashboardPage'
import ResidentPickupsPage from './pages/resident/PickupsPage'
import ResidentRewardsPage from './pages/resident/RewardsPage'
import ResidentComplaintsPage from './pages/resident/ComplaintsPage'
import CollectorDashboardPage from './pages/collector/DashboardPage'
import CollectorRoutePage from './pages/collector/RoutePage'
import CollectorAssignPage from './pages/collector/AssignPage'
import CollectorClassifyPage from './pages/collector/ClassifyPage'

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
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="account" element={<AccountPage />} />
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
            <Route path="account" element={<AccountPage />} />
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
            <Route path="assign" element={<CollectorAssignPage />} />
            <Route path="classify" element={<CollectorClassifyPage />} />
            <Route path="account" element={<AccountPage eyebrow="Collector" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
