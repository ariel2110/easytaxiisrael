import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import ActiveRide from './pages/ActiveRide'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'driver') return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Access denied: driver accounts only.</div>
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route path="/home" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/ride/:rideId" element={<RequireAuth><ActiveRide /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

