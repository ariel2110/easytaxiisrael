import type { User } from '../types'

interface Props {
  user: User | null
  onLogout: () => void
}

export default function StatusBar({ user, onLogout }: Props) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="pulse" />
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>RideOS Driver</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {user && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {user.phone}
          </span>
        )}
        <button
          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem' }}
          onClick={onLogout}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
