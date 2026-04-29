import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ActiveRide from './pages/ActiveRide'
import PendingDriverDashboard from './pages/PendingDriverDashboard'
import LicensedDriverDashboard from './pages/LicensedDriverDashboard'
import KycReturn from './pages/KycReturn'
import Profile from './pages/Profile'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, logout } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
      טוען…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'driver') return (
    <div style={{ padding: '2rem', color: 'var(--danger)' }}>גישה נדחתה: חשבונות נהגים בלבד.</div>
  )

  // Not yet approved → show pending progress screen
  if (user.auth_status !== 'approved') {
    return <PendingDriverDashboard user={user} onLogout={logout} />
  }

  // Approved licensed taxi → enhanced dashboard
  if (user.driver_type === 'licensed_taxi') {
    return <LicensedDriverDashboard />
  }

  // Approved rideshare / fallback → existing dashboard
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/kyc/done" element={<KycReturn />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/ride/:rideId" element={<RequireAuth><ActiveRide /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

