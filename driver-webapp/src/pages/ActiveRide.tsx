import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { RideWebSocket } from '../services/websocket'
import type { Ride, FareEstimate } from '../types'
import RideMap from '../components/RideMap'
import RatingModal from '../components/RatingModal'

export default function ActiveRide() {
  const { rideId } = useParams<{ rideId: string }>()
  const navigate = useNavigate()
  const [ride, setRide] = useState<Ride | null>(null)
  const [fare, setFare] = useState<FareEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [driverLat, setDriverLat] = useState<number | null>(null)
  const [driverLng, setDriverLng] = useState<number | null>(null)
  const wsRef = useRef<RideWebSocket | null>(null)

  useEffect(() => {
    if (!rideId) return
    api.rides.get(rideId).then(setRide).catch((e) => setError(e.message))
    api.rides.fare(rideId).then(setFare).catch(() => {})

    const ws = new RideWebSocket(rideId, 'driver')
    wsRef.current = ws
    ws.connect()

    // Stream GPS to server every 5 s
    const locInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
        }
        setDriverLat(pos.coords.latitude)
        setDriverLng(pos.coords.longitude)
        ws.send(payload)
        api.tracking.postLocation(rideId, payload.lat, payload.lng).catch(() => {})
      })
    }, 5000)

    return () => {
      clearInterval(locInterval)
      ws.disconnect()
    }
  }, [rideId])

  async function doAction(action: 'accept' | 'reject' | 'start' | 'end') {
    if (!rideId) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.rides[action](rideId)
      setRide(updated as Ride)
      if (action === 'reject') {
        navigate('/')
      }
      if (action === 'end') {
        // Show rating modal; navigate after it's dismissed
        const ratedKey = `driver_rated_${rideId}`
        if (!localStorage.getItem(ratedKey)) {
          setShowRating(true)
        } else {
          navigate('/')
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!ride) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        {error ? (
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Loading ride…</p>
        )}
      </div>
    )
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pending',
    assigned: 'Assigned to you',
    accepted: 'Accepted — head to pickup',
    in_progress: 'Ride in progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }

  return (
    <div className="page">
      {/* Rating modal — shown once when ride ends */}
      {showRating && rideId && (
        <RatingModal
          rideId={rideId}
          onDone={() => {
            localStorage.setItem(`driver_rated_${rideId}`, '1')
            setShowRating(false)
            navigate('/')
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/')} style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>
          ←
        </button>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Ride #{ride.id.slice(0, 8)}</h1>
      </div>

      <div className="page-content slide-in">
        {/* Live map */}
        <RideMap
          pickupLat={ride.pickup_lat}
          pickupLng={ride.pickup_lng}
          dropoffLat={ride.dropoff_lat}
          dropoffLng={ride.dropoff_lng}
          driverLat={driverLat}
          driverLng={driverLng}
          height="220px"
        />

        <div className="card" style={{ marginBottom: '1rem' }}>
          <span className={`badge ${ride.status === 'in_progress' ? 'badge-green' : 'badge-blue'}`}>
            {statusLabel[ride.status] ?? ride.status}
          </span>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <LocationRow icon="📍" label="Pickup" lat={ride.pickup_lat} lng={ride.pickup_lng} />
            <LocationRow icon="🏁" label="Dropoff" lat={ride.dropoff_lat} lng={ride.dropoff_lng} />
          </div>
        </div>

        {fare && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Fare Breakdown</h3>
            <FareRow label="Base fare" value={`$${fare.base_fare.toFixed(2)}`} />
            <FareRow label={`Distance (${fare.distance_km.toFixed(1)} km)`} value={`$${fare.distance_fare.toFixed(2)}`} />
            {parseFloat(fare.surge_multiplier) > 1 && (
              <FareRow label="Surge" value={`×${fare.surge_multiplier}`} highlight />
            )}
            <FareRow label="Platform fee" value={`-$${fare.platform_fee.toFixed(2)}`} />
            <FareRow label="Tax" value={`-$${fare.tax_amount.toFixed(2)}`} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              <FareRow label="Your earnings" value={`$${fare.driver_earnings.toFixed(2)}`} bold />
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {ride.status === 'assigned' && (
            <>
              <button className="btn btn-success" style={{ flex: 1 }} disabled={busy} onClick={() => doAction('accept')}>
                ✓ Accept
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={busy} onClick={() => doAction('reject')}>
                ✗ Reject
              </button>
            </>
          )}
          {ride.status === 'accepted' && (
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => doAction('start')}>
              🚦 Start Ride
            </button>
          )}
          {ride.status === 'in_progress' && (
            <button className="btn btn-success" style={{ flex: 1 }} disabled={busy} onClick={() => doAction('end')}>
              🏁 End Ride
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LocationRow({ icon, label, lat, lng }: { icon: string; label: string; lat: number; lng: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <span>{icon}</span>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '0.875rem' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</div>
      </div>
    </div>
  )
}

function FareRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: bold ? '1rem' : '0.875rem',
      fontWeight: bold ? 700 : 400,
      color: highlight ? 'var(--warning)' : 'inherit',
      marginBottom: '0.25rem',
    }}>
      <span style={{ color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
