import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { FareEstimate, RideRequest } from '../types'
import SurgeIndicator from '../components/SurgeIndicator'

const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 } // San Francisco default

export default function RequestRide() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [pickup, setPickup] = useState({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
  const [dropoff, setDropoff] = useState({ lat: 37.7850, lng: -122.4090 })
  const [fare, _setFare] = useState<FareEstimate | null>(null)
  const [surge, setSurge] = useState<{ surge_multiplier: string; demand_level: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Detect user location
  useEffect(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false)
    )
  }, [])

  // Load surge info
  useEffect(() => {
    api.ai.intelligence().then(setSurge).catch(() => {})
  }, [])

  async function estimateFare() {
    const req: RideRequest = { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng }
    // We estimate by creating a temp ride — in a production app this would be a separate /fare/estimate endpoint
    setBusy(true); setError(null)
    try {
      const ride = await api.rides.request(req)
      navigate(`/ride/${ride.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.2rem' }}>🚀 RideOS</h1>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{user?.phone}</span>
          <button style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }} onClick={() => { logout(); navigate('/login') }}>Sign out</button>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: '2rem' }}>
        {/* Map placeholder */}
        <div className="map-placeholder slide-in" style={{ height: 200, marginBottom: '1.5rem', marginTop: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.25rem' }}>🗺️</div>
            <div>Map view — pickup marked</div>
            <div style={{ fontSize: '.75rem', marginTop: '.25rem' }}>{pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}</div>
          </div>
        </div>

        {surge && <SurgeIndicator surge={surge} />}

        <div className="card slide-in" style={{ marginTop: '1rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Book a ride</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }}>
              📍 Pickup {locating && <span style={{ color: 'var(--accent)' }}>(detecting…)</span>}
            </label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input className="input" type="number" step="0.0001" value={pickup.lat} onChange={e => setPickup(p => ({ ...p, lat: parseFloat(e.target.value) }))} placeholder="Lat" style={{ flex: 1 }} />
              <input className="input" type="number" step="0.0001" value={pickup.lng} onChange={e => setPickup(p => ({ ...p, lng: parseFloat(e.target.value) }))} placeholder="Lng" style={{ flex: 1 }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }}>🏁 Dropoff</label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input className="input" type="number" step="0.0001" value={dropoff.lat} onChange={e => setDropoff(p => ({ ...p, lat: parseFloat(e.target.value) }))} placeholder="Lat" style={{ flex: 1 }} />
              <input className="input" type="number" step="0.0001" value={dropoff.lng} onChange={e => setDropoff(p => ({ ...p, lng: parseFloat(e.target.value) }))} placeholder="Lng" style={{ flex: 1 }} />
            </div>
          </div>

          {fare && (
            <div className="fade-in" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '.75rem', marginBottom: '1rem', fontSize: '.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
                <span>Total</span>
                <span style={{ color: 'var(--success)' }}>${fare.total.toFixed(2)}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '.25rem' }}>{fare.distance_km.toFixed(1)} km</div>
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '.875rem' }}>{error}</div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={estimateFare}>
            {busy ? 'Finding driver…' : 'Request Ride →'}
          </button>
        </div>
      </div>
    </div>
  )
}
