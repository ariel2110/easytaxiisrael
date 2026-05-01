import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { RideWebSocket } from '../services/websocket'
import type { Ride, FareEstimate, LocationPayload } from '../types'
import RideMap from '../components/RideMap'
import RatingModal from '../components/RatingModal'
import SafetyCenterOverlay from '../components/SafetyCenterOverlay'

const STATUS_LABEL: Record<string, string> = {
  pending:     '⏳ Finding a driver…',
  assigned:    '✅ Driver assigned',
  accepted:    '🚗 Driver on the way',
  in_progress: '🏎️ Ride in progress',
  completed:   '🏁 Ride completed',
  cancelled:   '❌ Ride cancelled',
}

export default function ActiveRide() {
  const { rideId } = useParams<{ rideId: string }>()
  const navigate = useNavigate()
  const [ride, setRide] = useState<Ride | null>(null)
  const [fare, setFare] = useState<FareEstimate | null>(null)
  const [driverLoc, setDriverLoc] = useState<LocationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRating, setShowRating] = useState(false)
  const wsRef = useRef<RideWebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!rideId) return
    api.rides.get(rideId).then(r => { setRide(r); if (r.status !== 'pending' && r.status !== 'assigned') api.rides.fare(rideId).then(setFare).catch(() => {}) }).catch(e => setError(e.message))

    // Poll ride status every 5 s
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.rides.get(rideId)
        setRide(r)
        if (r.status === 'completed' || r.status === 'cancelled') {
          clearInterval(pollRef.current!)
          if (r.status === 'completed') {
            api.rides.fare(rideId).then(setFare).catch(() => {})
            // Show rating modal once per ride
            const ratedKey = `rated_${rideId}`
            if (!localStorage.getItem(ratedKey)) setShowRating(true)
          }
        }
      } catch { /* ignore */ }
    }, 5000)

    // WebSocket for driver location
    const ws = new RideWebSocket(rideId)
    wsRef.current = ws
    ws.connect()
    const unsub = ws.onLocation(setDriverLoc)

    return () => {
      clearInterval(pollRef.current!)
      unsub()
      ws.disconnect()
    }
  }, [rideId])

  async function cancelRide() {
    if (!rideId) return
    try { await api.rides.cancel(rideId); navigate('/') } catch (e) { setError((e as Error).message) }
  }

  const statusBadgeClass = ride?.status === 'in_progress' ? 'badge-green' : ride?.status === 'completed' ? 'badge-green' : ride?.status === 'cancelled' ? 'badge-red' : 'badge-yellow'

  return (
    <div className="page">
      {/* Safety overlay — visible during active ride */}
      {rideId && (ride?.status === 'in_progress' || ride?.status === 'assigned' || ride?.status === 'accepted') && (
        <SafetyCenterOverlay
          rideId={rideId}
          driverName={(ride as any)?.driver_name ?? null}
        />
      )}

      {/* Rating modal — shown once on ride completion */}
      {showRating && rideId && (
        <RatingModal
          rideId={rideId}
          target="driver"
          onDone={() => {
            localStorage.setItem(`rated_${rideId}`, '1')
            setShowRating(false)
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <button onClick={() => navigate('/')} style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>←</button>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your Ride</h1>
      </div>

      <div className="page-content slide-in">
        {!ride ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            {error ?? 'Loading…'}
          </div>
        ) : (
          <>
            {/* Live map */}
            <RideMap
              pickupLat={ride.pickup_lat}
              pickupLng={ride.pickup_lng}
              dropoffLat={ride.dropoff_lat}
              dropoffLng={ride.dropoff_lng}
              driverLat={driverLoc?.lat}
              driverLng={driverLoc?.lng}
              height="240px"
            />

            <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>
                {ride.status === 'in_progress' ? '🏎️' : ride.status === 'completed' ? '🏁' : ride.status === 'cancelled' ? '❌' : '🚗'}
              </div>
              <span className={`badge ${statusBadgeClass}`}>{STATUS_LABEL[ride.status] ?? ride.status}</span>

              {driverLoc && (ride.status === 'accepted' || ride.status === 'in_progress') && (
                <div className="fade-in" style={{ marginTop: '1rem', fontSize: '.875rem', color: 'var(--text-secondary)' }}>
                  <span className="pulse" style={{ marginRight: '.5rem' }} />
                  Driver at {driverLoc.lat.toFixed(4)}, {driverLoc.lng.toFixed(4)}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
              <RouteRow label="From" lat={ride.pickup_lat} lng={ride.pickup_lng} icon="📍" />
              <div style={{ borderTop: '1px solid var(--border)', margin: '.75rem 0' }} />
              <RouteRow label="To" lat={ride.dropoff_lat} lng={ride.dropoff_lng} icon="🏁" />
            </div>

            {fare && (
              <div className="card fade-in" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.875rem', marginBottom: '.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Distance</span>
                  <span>{fare.distance_km.toFixed(1)} km</span>
                </div>
                {parseFloat(fare.surge_multiplier) > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.875rem', marginBottom: '.25rem', color: 'var(--warning)' }}>
                    <span>Surge</span>
                    <span>×{fare.surge_multiplier}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '.5rem' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--success)' }}>${fare.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '.875rem' }}>{error}</div>}

            {(ride.status === 'pending' || ride.status === 'assigned') && (
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={cancelRide}>Cancel Ride</button>
            )}
            {(ride.status === 'completed' || ride.status === 'cancelled') && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/')}>Book Another Ride</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RouteRow({ label, lat, lng, icon }: { label: string; lat: number; lng: number; icon: string }) {
  return (
    <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '.875rem' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</div>
      </div>
    </div>
  )
}
