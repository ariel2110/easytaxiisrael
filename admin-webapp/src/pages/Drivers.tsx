import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { AdminUser } from '../types'

const AUTH_STATUS_BADGE: Record<string, string> = {
  pending:              'badge-gray',
  whatsapp_verified:    'badge-blue',
  persona_in_progress:  'badge-yellow',
  persona_completed:    'badge-blue',
  approved:             'badge-green',
}

const AUTH_STATUS_LABEL: Record<string, string> = {
  pending:              'ממתין',
  whatsapp_verified:    'WA ✓',
  persona_in_progress:  'KYC בתהליך',
  persona_completed:    'KYC הושלם',
  approved:             'מאושר ✓',
}

function phoneDisplay(phone: string) {
  return phone.startsWith('972') ? '0' + phone.slice(3) : phone
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await api.users.list(0, 200, 'driver')
      setDrivers(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function doApprove(id: string) {
    setBusy(id)
    try {
      const updated = await api.users.approve(id)
      setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  async function doSetType(id: string, type: string) {
    setBusy(id + type)
    try {
      const updated = await api.users.setDriverType(id, type)
      setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  async function doToggle(driver: AdminUser) {
    setBusy(driver.id + 'toggle')
    try {
      const updated = driver.is_active
        ? await api.users.deactivate(driver.id)
        : await api.users.activate(driver.id)
      setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  const filtered = drivers.filter(d => {
    const matchSearch = search === '' || d.phone.includes(search) || d.full_name?.includes(search)
    const matchStatus = statusFilter === '' || d.auth_status === statusFilter
    return matchSearch && matchStatus
  })

  const pending = drivers.filter(d => d.auth_status !== 'approved').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>ניהול נהגים</h1>
          {pending > 0 && (
            <span className="badge badge-yellow" style={{ marginTop: '0.3rem', display: 'inline-block' }}>
              {pending} ממתינים לאישור
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">כל הסטטוסים</option>
            <option value="pending">ממתין</option>
            <option value="whatsapp_verified">WA מאומת</option>
            <option value="persona_in_progress">KYC בתהליך</option>
            <option value="persona_completed">KYC הושלם</option>
            <option value="approved">מאושר</option>
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
                  <th>טלפון</th>
                  <th>שם</th>
                  <th>סטטוס אימות</th>
                  <th>סוג נהג</th>
                  <th>חשבון</th>
                  <th>נרשם</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>אין נהגים</td></tr>
                )}
                {filtered.map(d => (
                  <tr key={d.id} className="fade-in">
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{phoneDisplay(d.phone)}</td>
                    <td>{d.full_name ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${AUTH_STATUS_BADGE[d.auth_status ?? ''] ?? 'badge-gray'}`}>
                        {AUTH_STATUS_LABEL[d.auth_status ?? ''] ?? d.auth_status ?? '—'}
                      </span>
                    </td>
                    <td>
                      {d.driver_type ? (
                        <span className={`badge ${d.driver_type === 'licensed_taxi' ? 'badge-yellow' : 'badge-blue'}`}>
                          {d.driver_type === 'licensed_taxi' ? 'מונית מורשה' : 'שיתופי'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>לא הוגדר</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${d.is_active ? 'badge-green' : 'badge-red'}`}>
                        {d.is_active ? 'פעיל' : 'חסום'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(d.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {/* Approve */}
                        {d.auth_status !== 'approved' && (
                          <button
                            className="btn btn-success"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                            disabled={busy === d.id}
                            onClick={() => doApprove(d.id)}
                          >
                            ✓ אשר
                          </button>
                        )}
                        {/* Set driver type */}
                        {d.driver_type !== 'licensed_taxi' && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                            disabled={busy === d.id + 'licensed_taxi'}
                            onClick={() => doSetType(d.id, 'licensed_taxi')}
                          >
                            🚕 מורשה
                          </button>
                        )}
                        {d.driver_type !== 'rideshare' && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                            disabled={busy === d.id + 'rideshare'}
                            onClick={() => doSetType(d.id, 'rideshare')}
                          >
                            🚗 שיתופי
                          </button>
                        )}
                        {/* Block/unblock */}
                        <button
                          className={`btn ${d.is_active ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                          disabled={busy === d.id + 'toggle'}
                          onClick={() => doToggle(d)}
                        >
                          {d.is_active ? 'חסום' : 'שחרר'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {filtered.length} מתוך {drivers.length} נהגים
        </div>
      </div>
    </div>
  )
}
