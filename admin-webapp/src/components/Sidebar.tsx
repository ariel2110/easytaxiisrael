import { NavLink } from 'react-router-dom'
import type { AdminUser } from '../types'

interface Props {
  user: AdminUser
  onLogout: () => void
}

const NAV = [
  { to: '/admin/', label: 'סקירה',    icon: '📊', end: true },
  { to: '/admin/drivers', label: 'נהגים',  icon: '🚗', end: false },
  { to: '/admin/users',   label: 'משתמשים', icon: '👥', end: false },
  { to: '/admin/rides',   label: 'נסיעות',  icon: '🛣️', end: false },
  { to: '/admin/audit',   label: 'יומן',    icon: '📋', end: false },
  { to: '/admin/ai-agents', label: 'סוכני AI', icon: '🤖', end: false },
]

export default function Sidebar({ user, onLogout }: Props) {
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
            })}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.phone}
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
