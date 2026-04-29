import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import RequestRide from './pages/RequestRide'
import ActiveRide from './pages/ActiveRide'
import GuestDashboard from './pages/GuestDashboard'
import DriverOnboarding from './pages/DriverOnboarding'
import DriverLanding from './pages/DriverLanding'
import DriverPending from './pages/DriverPending'
import DriverDashboard from './pages/DriverDashboard'
import AdminPanel from './pages/AdminPanel'
import FAQ from './pages/FAQ'
import Profile from './pages/Profile'

const Loader = () => (
  <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)' }}>
    <div style={{ fontSize: '2.5rem' }} className="taxi-bounce">🚕</div>
    <div style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>טוען…</div>
  </div>
)

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login?role=passenger" replace />
  return children
}

function RequireDriverAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login?role=driver" replace />
  return children
}

function RequireAdminAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/guest" element={<GuestDashboard />} />
        <Route path="/driver/join" element={<DriverLanding />} />
        <Route path="/driver/onboarding" element={<DriverOnboarding />} />
        <Route path="/driver/pending" element={<DriverPending />} />
        <Route path="/faq" element={<FAQ />} />

        {/* Driver dashboard (auth required) */}
        <Route path="/driver" element={<RequireDriverAuth><DriverDashboard /></RequireDriverAuth>} />

        {/* Passenger app (auth required) */}
        <Route path="/app" element={<RequireAuth><RequestRide /></RequireAuth>} />
        <Route path="/app/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/ride/:rideId" element={<RequireAuth><ActiveRide /></RequireAuth>} />

        {/* Admin panel */}
        <Route path="/admin" element={<RequireAdminAuth><AdminPanel /></RequireAdminAuth>} />

        {/* Legacy redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}


