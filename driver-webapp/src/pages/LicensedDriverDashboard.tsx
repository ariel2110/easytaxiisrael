import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRides } from '../hooks/useRides'
import { api } from '../services/api'
import type { ComplianceProgress } from '../types'
import RideCard from '../components/RideCard'
import EarningsPanel from '../components/EarningsPanel'
import ComplianceBar from '../components/ComplianceBar'
import BottomNav from '../components/BottomNav'

export default function LicensedDriverDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { rides, loading, refresh } = useRides()
  const [compliance, setCompliance] = useState<ComplianceProgress | null>(null)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    api.compliance.progress().then(setCompliance).catch(() => {})
  }, [])

  const pendingRides = rides.filter((r) => r.status === 'assigned' || r.status === 'pending')
  const activeRide = rides.find((r) => r.status === 'accepted' || r.status === 'in_progress')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isLicensed = user?.driver_type === 'licensed_taxi'

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.875rem 1rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        direction: 'rtl',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🚕</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1 }}>
              {user?.full_name ?? user?.phone}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              {isLicensed && (
                <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>
                  מונית מורשה
                </span>
              )}
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                מאושר ✓
              </span>
            </div>
          </div>
        </div>

        {/* Online toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setOnline(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 999,
              background: online ? 'rgba(34,197,94,0.15)' : 'var(--bg-elevated)',
              border: `1px solid ${online ? 'var(--success)' : 'var(--border)'}`,
              color: online ? 'var(--success)' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: online ? 'var(--success)' : 'var(--text-secondary)',
            }} />
            {online ? 'מחובר' : 'מנותק'}
          </button>
          <button
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            onClick={handleLogout}
          >
            יציאה
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="page-content" style={{ paddingBottom: '5rem', direction: 'rtl' }}>
        {compliance && <ComplianceBar compliance={compliance} />}

        {/* Offline notice */}
        {!online && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warning)', background: 'rgba(245,158,11,0.08)', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '0.25rem' }}>⏸ אתה במצב לא מחובר</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>לא תקבל בקשות נסיעה חדשות</div>
          </div>
        )}

        <EarningsPanel />

        {/* Rides section */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
              {activeRide ? 'נסיעה פעילה' : 'בקשות ממתינות'}
            </h2>
            <button
              onClick={refresh}
              style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {loading ? <span className="pulse" /> : '↻'} רענן
            </button>
          </div>

          {activeRide ? (
            <RideCard ride={activeRide} onAction={() => navigate(`/ride/${activeRide.id}`)} />
          ) : !online ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏸</div>
              <p>התחבר כדי לקבל נסיעות</p>
            </div>
          ) : pendingRides.length === 0 ? (
            <div className="card fade-in" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <p>מחכה לבקשות נסיעה…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} onAction={() => navigate(`/ride/${ride.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
