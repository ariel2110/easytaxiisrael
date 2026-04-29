import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { AdminUser } from '../types'

const AUTH_STATUS_LABEL: Record<string, string> = {
  pending:              'ממתין',
  whatsapp_verified:    'WA ✓',
  persona_in_progress:  'KYC בתהליך',
  persona_completed:    'KYC הושלם',
  approved:             'מאושר',
}

const AUTH_STATUS_BADGE: Record<string, string> = {
  pending:              'badge-gray',
  whatsapp_verified:    'badge-blue',
  persona_in_progress:  'badge-yellow',
  persona_completed:    'badge-blue',
  approved:             'badge-green',
}

function phoneDisplay(phone: string) {
  // 972546363350 → 0546363350
  return phone.startsWith('972') ? '0' + phone.slice(3) : phone
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await api.users.list(0, 200, roleFilter || undefined)
      setUsers(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [roleFilter])

  async function action(fn: () => Promise<AdminUser>, userId: string) {
    setBusy(userId)
    try {
      const updated = await fn()
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const filtered = users.filter(u =>
    filter === '' ||
    u.phone.includes(filter) ||
    u.full_name?.includes(filter) ||
    u.id.includes(filter)
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>ניהול משתמשים</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input className="input" placeholder="חיפוש..." value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 200 }} />
          <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">כל התפקידים</option>
            <option value="passenger">נוסעים</option>
            <option value="driver">נהגים</option>
            <option value="admin">אדמין</option>
          </select>
          <button className="btn btn-ghost" onClick={load}>↻ רענן</button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>שגיאה: {error}</div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="spin">↻</span> טוען…
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>טלפון</th>
                  <th>שם</th>
                  <th>תפקיד</th>
                  <th>סטטוס אימות</th>
                  <th>סטטוס חשבון</th>
                  <th>נרשם</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>אין משתמשים</td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id} className="fade-in">
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{phoneDisplay(u.phone)}</td>
                    <td>{u.full_name ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-yellow' : u.role === 'driver' ? 'badge-blue' : 'badge-gray'}`}>
                        {u.role === 'admin' ? 'אדמין' : u.role === 'driver' ? 'נהג' : 'נוסע'}
                      </span>
                    </td>
                    <td>
                      {u.auth_status ? (
                        <span className={`badge ${AUTH_STATUS_BADGE[u.auth_status] ?? 'badge-gray'}`}>
                          {AUTH_STATUS_LABEL[u.auth_status] ?? u.auth_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'פעיל' : 'חסום'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(u.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {u.is_active ? (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            disabled={busy === u.id || u.role === 'admin'}
                            onClick={() => action(() => api.users.deactivate(u.id), u.id)}
                          >
                            חסום
                          </button>
                        ) : (
                          <button
                            className="btn btn-success"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            disabled={busy === u.id}
                            onClick={() => action(() => api.users.activate(u.id), u.id)}
                          >
                            שחרר
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {filtered.length} מתוך {users.length} משתמשים
        </div>
      </div>
    </div>
  )
}
