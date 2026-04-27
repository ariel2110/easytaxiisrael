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
import StatusBar from '../components/StatusBar'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { rides, loading, refresh } = useRides()
  const [compliance, setCompliance] = useState<ComplianceProgress | null>(null)

  useEffect(() => {
    api.compliance.progress().then(setCompliance).catch(() => {})
  }, [])

  const pendingRides = rides.filter((r) => r.status === 'assigned' || r.status === 'pending')
  const activeRide = rides.find((r) => r.status === 'accepted' || r.status === 'in_progress')

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="page">
      <StatusBar user={user} onLogout={handleLogout} />
      <div className="page-content" style={{ paddingBottom: '5rem' }}>
        {compliance && <ComplianceBar compliance={compliance} />}
        <EarningsPanel />

        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {activeRide ? 'Active Ride' : 'Pending Requests'}
            </h2>
            {loading && <span className="pulse" />}
          </div>

          {activeRide ? (
            <RideCard ride={activeRide} onAction={() => navigate(`/ride/${activeRide.id}`)} />
          ) : pendingRides.length === 0 ? (
            <div className="card fade-in" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <p>Waiting for ride requests…</p>
              <button className="btn" style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.875rem' }} onClick={refresh}>
                Refresh
              </button>
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
