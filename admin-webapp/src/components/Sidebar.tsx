import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface Props {
  onLogout: () => void
}

const NAV = [
  { to: '/admin/', label: 'סקירה',    icon: '📊', end: true },
  { to: '/admin/pending', label: 'ממתין לאישור', icon: '⏳', end: false, badge: true },
  { to: '/admin/driver-applications', label: 'חוק הובר — נהגים', icon: '🚗🆕', end: false },
  { to: '/admin/drivers', label: 'נהגים',  icon: '🚗', end: false },
  { to: '/admin/users',   label: 'משתמשים', icon: '👥', end: false },
  { to: '/admin/rides',   label: 'נסיעות',  icon: '🛣️', end: false },
  { to: '/admin/audit',   label: 'יומן',    icon: '📋', end: false },
  { to: '/admin/sumsub',  label: 'KYC',     icon: '🪪', end: false },
  { to: '/admin/ai-agents', label: 'סוכני AI', icon: '🤖', end: false },
  { to: '/admin/control', label: 'מרכז שליטה', icon: '🛡️', end: false },
  { to: '/admin/report',  label: 'דוח יומי AI', icon: '📈', end: false },
  { to: '/admin/handbook', label: 'מדריך',   icon: '📖', end: false },
  { to: '/admin/demo',    label: 'דמו',      icon: '🎭', end: false },
  { to: '/admin/leads',   label: 'לידים',    icon: '📋', end: false },
]

const NAV_EXTERNAL = [
  { href: '/whatsapp-setup.html?key=e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2', label: 'WhatsApp', icon: '💬' },
]

export default function Sidebar({ onLogout }: Props) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Poll pending approvals count every 60s
    const fetchCount = () =>
      api.stats.get().then(s => setPendingCount(s.pending_approvals ?? 0)).catch(() => {})
    fetchCount()
    const t = setInterval(fetchCount, 60_000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>🚕 EasyTaxi</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>לוח ניהול</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.65rem 1rem',
              fontSize: '0.9rem',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(255,215,0,0.07)' : 'transparent',
              borderRight: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.15s',
              position: 'relative',
            })}
          >
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && pendingCount > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: '100px',
                padding: '1px 7px', fontSize: '0.65rem', fontWeight: 800,
                minWidth: '18px', textAlign: 'center',
              }}>{pendingCount}</span>
            )}
          </NavLink>
        ))}

        <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 1rem' }} />

        {NAV_EXTERNAL.map(item => (
          <a
            key={item.label}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.65rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 400,
              color: 'var(--text-secondary)',
              background: 'transparent',
              borderRight: '3px solid transparent',
              transition: 'all 0.15s',
              textDecoration: 'none',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          מנהל מערכת
        </div>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: '0.8rem' }}
          onClick={onLogout}
        >
          התנתק
        </button>
      </div>
    </aside>
  )
}


