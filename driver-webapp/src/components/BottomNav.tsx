import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span style={{ fontSize: '1.25rem' }}>🏠</span>
        <span>בית</span>
      </NavLink>
      <NavLink to="/earnings">
        <span style={{ fontSize: '1.25rem' }}>💰</span>
        <span>הכנסות</span>
      </NavLink>
      <NavLink to="/compliance">
        <span style={{ fontSize: '1.25rem' }}>📋</span>
        <span>מסמכים</span>
      </NavLink>
      <NavLink to="/profile">
        <span style={{ fontSize: '1.25rem' }}>👤</span>
        <span>פרופיל</span>
      </NavLink>
    </nav>
  )
}
