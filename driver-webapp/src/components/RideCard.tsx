import { useNavigate } from 'react-router-dom'
import type { Ride } from '../types'

interface Props {
  ride: Ride
  onAction: () => void
}

const statusBadge: Record<string, string> = {
  pending:     'badge-yellow',
  assigned:    'badge-blue',
  accepted:    'badge-blue',
  in_progress: 'badge-green',
  completed:   'badge-green',
  cancelled:   'badge-red',
}

const statusLabel: Record<string, string> = {
  pending:     'Pending',
  assigned:    'New Request',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

export default function RideCard({ ride, onAction }: Props) {
  return (
    <div className="card slide-in" style={{ cursor: 'pointer' }} onClick={onAction}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          #{ride.id.slice(0, 8)}
        </span>
        <span className={`badge ${statusBadge[ride.status] ?? 'badge-blue'}`}>
          {statusLabel[ride.status] ?? ride.status}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.875rem', display: 'flex', gap: '0.5rem' }}>
          <span>📍</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {ride.pickup_lat.toFixed(4)}, {ride.pickup_lng.toFixed(4)}
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', display: 'flex', gap: '0.5rem' }}>
          <span>🏁</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {ride.dropoff_lat.toFixed(4)}, {ride.dropoff_lng.toFixed(4)}
          </span>
        </div>
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Tap to view details →
      </div>
    </div>
  )
}
