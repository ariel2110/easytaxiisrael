import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span style={{ fontSize: '1.25rem' }}>🏠</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/earnings">
        <span style={{ fontSize: '1.25rem' }}>💰</span>
        <span>Earnings</span>
      </NavLink>
      <NavLink to="/compliance">
        <span style={{ fontSize: '1.25rem' }}>📋</span>
        <span>Docs</span>
      </NavLink>
    </nav>
  )
}
