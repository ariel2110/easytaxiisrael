import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { AuditLog } from '../types'

const ACTION_BADGE: Record<string, string> = {
  ride_requested:        'badge-blue',
  ride_cancelled:        'badge-red',
  ride_completed:        'badge-green',
  admin_evaluate_driver: 'badge-yellow',
  payment_created:       'badge-green',
  user_login:            'badge-gray',
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await api.audit.list(0, 200)
      setLogs(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l =>
    search === '' ||
    l.action.includes(search) ||
    (l.detail ?? '').includes(search) ||
    (l.resource_type ?? '').includes(search) ||
    (l.actor_id ?? '').includes(search)
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>יומן ביקורת</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" placeholder="חיפוש פעולה..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
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
                  <th>זמן</th>
                  <th>פעולה</th>
                  <th>משאב</th>
                  <th>פרטים</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>אין רשומות</td></tr>
                )}
                {filtered.map(l => (
                  <tr key={l.id} className="fade-in">
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleString('he-IL')}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_BADGE[l.action] ?? 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {l.resource_type && <span>{l.resource_type}</span>}
                      {l.resource_id && <span style={{ marginRight: '0.3rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{l.resource_id.slice(0, 8)}…</span>}
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.detail ?? '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {l.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {filtered.length} רשומות
        </div>
      </div>
    </div>
  )
}
