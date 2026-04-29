import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail]       = useState((user as any)?.email ?? '')
  const [busy, setBusy]         = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!fullName.trim()) { setError('נא להזין שם מלא'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('כתובת אימייל לא תקינה'); return
    }
    setBusy(true); setError(null); setSaved(false)
    try {
      await api.auth.updateProfile({
        full_name: fullName.trim() || undefined,
        email: email.trim() || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <div style={{
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.875rem 1rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
          onClick={() => navigate(-1)}
        >
          ← חזור
        </button>
        <span style={{ fontWeight: 700 }}>הפרופיל שלי</span>
        <div style={{ width: 48 }} />
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Avatar placeholder */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(99,102,241,0.15)',
            border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', margin: '0 auto 0.5rem',
          }}>
            🚗
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user.full_name ?? 'נהג'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {user.driver_type === 'licensed_taxi' ? '🚕 נהג מונית' : '🚗 נהג עצמאי'}
          </div>
        </div>

        {/* Phone — read only */}
        <div className="card">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            מספר טלפון
          </label>
          <div style={{
            padding: '0.7rem 0.875rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            direction: 'ltr',
            textAlign: 'right',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>🔒</span>
            <span>+{user.phone}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            מספר הטלפון משמש לאימות ולא ניתן לשינוי
          </div>
        </div>

        {/* Editable fields */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              שם מלא
            </label>
            <input
              className="input"
              type="text"
              placeholder="ישראל ישראלי"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              אימייל <span style={{ fontWeight: 400, textTransform: 'none' }}>(אופציונלי)</span>
            </label>
            <input
              className="input"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.6rem 0.75rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          {saved && (
            <div style={{
              padding: '0.6rem 0.75rem',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--success)',
              fontSize: '0.85rem',
            }}>
              ✅ הפרטים נשמרו בהצלחה
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={handleSave}
          >
            {busy ? 'שומר…' : 'שמור שינויים'}
          </button>
        </div>

        {/* Account status */}
        <div className="card" style={{ fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.9rem' }}>
            סטטוס חשבון
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>סטטוס</span>
            <span>{
              user.auth_status === 'approved' ? '✅ מאושר' :
              user.auth_status === 'persona_completed' ? '⏳ ממתין לאישור' :
              user.auth_status === 'persona_in_progress' ? '🔄 KYC בתהליך' :
              '⚠️ ממתין לאימות'
            }</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>סוג נהג</span>
            <span>{user.driver_type === 'licensed_taxi' ? 'מונית מורשית' : user.driver_type === 'rideshare' ? 'שיתוף נסיעות' : 'לא הוגדר'}</span>
          </div>
        </div>

        {/* Support + logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
          <a
            href="https://wa.me/447474775344"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ textAlign: 'center', color: '#25D366', fontSize: '0.85rem' }}
          >
            💬 פנה לתמיכה ב-WhatsApp
          </a>
          <button
            className="btn"
            style={{ color: 'var(--danger)', fontSize: '0.85rem' }}
            onClick={handleLogout}
          >
            התנתק
          </button>
        </div>
      </div>
    </div>
  )
}
