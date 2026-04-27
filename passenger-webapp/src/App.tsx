import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import RequestRide from './pages/RequestRide'
import ActiveRide from './pages/ActiveRide'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<RequireAuth><RequestRide /></RequireAuth>} />
        <Route path="/ride/:rideId" element={<RequireAuth><ActiveRide /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

