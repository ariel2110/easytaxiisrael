import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

type Step = 'home' | 'auth'

export default function Login() {
  const { requestWaAuth, cancelWaAuth, waSession, error } = useAuth()
  const [step, setStep] = useState<Step>('home')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function handleRequest() {
    if (!phone.trim()) return
    setBusy(true); setLocalErr(null)
    try { await requestWaAuth(phone.trim()) }
    catch (e) { setLocalErr((e as Error).message) }
    finally { setBusy(false) }
  }

  function handleBack() {
    cancelWaAuth()
    setLocalErr(null)
    setPhone('')
    setStep('home')
  }

  /* ────────────────────────────────────────────────────────────
     STEP: home — choose role
  ──────────────────────────────────────────────────────────── */
  if (step === 'home') {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div className="card slide-in" style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '3rem' }}>🚕</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '.5rem', letterSpacing: '-.5px' }}>EasyTaxi</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '.35rem', fontSize: '.95rem' }}>ברוך הבא — בחר כיצד תרצה להתחבר</p>
          </div>

          {/* Role buttons */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 600, marginBottom: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem' }}
            onClick={() => setStep('auth')}
          >
            <span style={{ fontSize: '1.4rem' }}>🙋</span> אני נוסע
          </button>

          <a
            href="https://driver.easytaxiisrael.com"
            className="btn"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textDecoration: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }}
          >
            <span style={{ fontSize: '1.4rem' }}>🚗</span> אני נהג
          </a>
        </div>
      </div>
    )
  }

  /* ────────────────────────────────────────────────────────────
     STEP: auth — WhatsApp link flow
  ──────────────────────────────────────────────────────────── */
  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
      <div className="card slide-in" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🚕</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '.5rem' }}>כניסה לנוסע</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '.25rem' }}>אימות מהיר דרך וואטסאפ</p>
        </div>

        {!waSession ? (
          /* Phone input */
          <>
            <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.875rem', color: 'var(--text-secondary)' }}>
              מספר טלפון
            </label>
            <input
              className="input"
              type="tel"
              placeholder="05X-XXX-XXXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRequest()}
              dir="ltr"
              autoFocus
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
              disabled={busy}
              onClick={handleRequest}
            >
              {busy ? 'שולח…' : <><span>💬</span> קבל קישור לוואטסאפ</>}
            </button>
            <button
              style={{ width: '100%', marginTop: '.75rem', color: 'var(--text-secondary)', fontSize: '.875rem', padding: '.5rem' }}
              onClick={handleBack}
            >
              ← חזור
            </button>
          </>
        ) : (
          /* WhatsApp link + polling */
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.75rem' }}>💬</div>
              <p style={{ fontWeight: 600, marginBottom: '.5rem' }}>פתח את וואטסאפ ושלח את ההודעה</p>
              <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                ההודעה כבר מוכנה לשליחה — לאחר השליחה תיכנס אוטומטית.
              </p>
              <a
                href={waSession.whatsapp_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', textDecoration: 'none', padding: '.75rem 1.5rem', borderRadius: 'var(--radius)' }}
              >
                <span>📲</span> פתח וואטסאפ לאימות
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '.85rem' }}>
              <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              ממתין לאישור…
            </div>
            <button style={{ width: '100%', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '.875rem', padding: '.5rem' }} onClick={handleBack}>
              ← חזור
            </button>
          </>
        )}

        {(localErr ?? error) && (
          <div className="fade-in" style={{ marginTop: '1rem', padding: '.75rem', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.875rem' }}>
            {localErr ?? error}
          </div>
        )}
      </div>
    </div>
  )
}
