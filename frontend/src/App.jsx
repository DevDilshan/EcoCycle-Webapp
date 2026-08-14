import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/layout/AdminLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UserDashboardPage from './pages/UserDashboardPage'
import DashboardPage from './pages/admin/DashboardPage'
import PickupRequestsPage from './pages/admin/PickupRequestsPage'
import RoutesPage from './pages/admin/RoutesPage'
import RewardsPage from './pages/admin/RewardsPage'
import ApprovalsPage from './pages/admin/ApprovalsPage'

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
          </Route>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <UserDashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
