import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Users from './pages/Users'
import Drivers from './pages/Drivers'
import Rides from './pages/Rides'
import AuditLogs from './pages/AuditLogs'
import AIAgents from './pages/AIAgents'

function AdminLayout() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/admin/login" replace />

  return (
    <div className="admin-layout">
      <Sidebar user={user} onLogout={logout} />
      <div className="main-area">
        <div className="topbar">
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            שלום, {user.phone}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span className="badge badge-yellow">אדמין</span>
          </div>
        </div>
        <div className="page-body">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="users" element={<Users />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="rides" element={<Rides />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="ai-agents" element={<AIAgents />} />
            <Route path="*" element={<Navigate to="/admin/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function LoginGuard() {
  const { user } = useAuth()
  if (user) return <Navigate to="/admin/" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<LoginGuard />} />
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route path="*" element={<Navigate to="/admin/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
