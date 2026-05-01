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
import KYCVerification from './pages/KYCVerification'
import SumsubApplicants from './pages/SumsubApplicants'
import WhatsApp from './pages/WhatsApp'
import ControlCenter from './pages/ControlCenter'
import DailyReport from './pages/DailyReport'
import Handbook from './pages/Handbook'
import DemoReport from './pages/DemoReport'
import Leads from './pages/Leads'

function AdminLayout() {
  const { user, loading, logout } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '2rem', color: 'var(--accent)' }}>
      ↻
    </div>
  )
  if (!user) return <Navigate to="/admin/login" replace />

  return (
    <div className="admin-layout">
      <Sidebar onLogout={logout} />
      <div className="main-area">
        <div className="topbar">
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            EasyTaxi Admin
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
            <Route path="sumsub" element={<SumsubApplicants />} />
            <Route path="control" element={<ControlCenter />} />
            <Route path="report" element={<DailyReport />} />
            <Route path="handbook" element={<Handbook />} />
            <Route path="whatsapp" element={<WhatsApp />} />
            <Route path="demo" element={<DemoReport />} />
            <Route path="leads" element={<Leads />} />
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
        <Route path="/verify" element={<KYCVerification />} />
        <Route path="*" element={<Navigate to="/admin/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
