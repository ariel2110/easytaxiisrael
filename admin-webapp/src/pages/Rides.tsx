import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { AdminRide } from '../types'

const STATUS_BADGE: Record<string, string> = {
  pending:     'badge-yellow',
  assigned:    'badge-blue',
  accepted:    'badge-blue',
  in_progress: 'badge-blue',
  completed:   'badge-green',
  cancelled:   'badge-red',
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'ממתין',
  assigned:    'שובץ',
  accepted:    'אושר',
  in_progress: 'בנסיעה',
  completed:   'הושלם',
  cancelled:   'בוטל',
}

export default function Rides() {
  const [rides, setRides] = useState<AdminRide[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await api.rides.list(0, 200, statusFilter || undefined)
      setRides(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = rides.filter(r =>
    search === '' ||
    r.id.includes(search) ||
    r.passenger_id.includes(search) ||
    (r.driver_id ?? '').includes(search) ||
    (r.pickup_address ?? '').includes(search) ||
    (r.dropoff_address ?? '').includes(search)
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>כל הנסיעות</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150 }}>
            <option value="">כל הסטטוסים</option>
            <option value="pending">ממתין</option>
            <option value="assigned">שובץ</option>
            <option value="accepted">אושר</option>
            <option value="in_progress">בנסיעה</option>
            <option value="completed">הושלם</option>
            <option value="cancelled">בוטל</option>
          </select>
          <button className="btn btn-ghost" onClick={load}>↻</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>שגיאה: {error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}><span className="spin">↻</span></div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>מזהה</th>
                  <th>סטטוס</th>
                  <th>איסוף</th>
                  <th>יעד</th>
                  <th>נוצר</th>
                  <th>הושלם</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>אין נסיעות</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id} className="fade-in">
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {r.id.slice(0, 8)}…
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {r.pickup_address ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {r.dropoff_address ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('he-IL') : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {r.completed_at ? new Date(r.completed_at).toLocaleString('he-IL') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {filtered.length} נסיעות
        </div>
      </div>
    </div>
  )
}
