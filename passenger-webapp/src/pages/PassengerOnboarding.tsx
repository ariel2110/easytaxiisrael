import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { User } from '../types'

interface Props {
  user: User
  onComplete: (updated: User) => void
}

type Step = 'name' | 'email' | 'tos'

export default function PassengerOnboarding({ user, onComplete }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('name')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [tosChecked, setTosChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const steps: Step[] = ['name', 'email', 'tos']
  const stepIndex = steps.indexOf(step)
  const progress = ((stepIndex + 1) / steps.length) * 100

  async function handleFinish() {
    if (!tosChecked) { setError('יש לאשר את תנאי השימוש'); return }
    setBusy(true); setError(null)
    try {
      const updated = await api.auth.updateProfile({
        full_name: fullName.trim() || undefined,
        email: email.trim() || undefined,
      })
      onComplete(updated)
      navigate('/app', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function nextStep() {
    setError(null)
    if (step === 'name') {
      if (fullName.trim().length < 2) { setError('נא להזין שם מלא (לפחות 2 תווים)'); return }
      setStep('email')
    } else if (step === 'email') {
      // email is optional — skip validation if empty
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('כתובת אימייל לא תקינה'); return
      }
      setStep('tos')
    }
  }

  return (
    <div style={{
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      padding: '1.5rem',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚕</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
          ברוך הבא ל-EasyTaxi
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.9rem' }}>
          נשאל אותך כמה שאלות קצרות לפני שתתחיל
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 999,
        height: 6,
        marginBottom: '2rem',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--accent)',
          borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Steps */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Step 1: Name */}
        {step === 'name' && (
          <>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                שלב 1 מתוך 3
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>מה השם שלך?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
                הנהג יראה את שמך כשיגיע לאסוף אותך
              </p>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                שם מלא
              </label>
              <input
                className="input"
                type="text"
                placeholder="ישראל ישראלי"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                autoFocus
                maxLength={120}
              />
            </div>
          </>
        )}

        {/* Step 2: Email */}
        {step === 'email' && (
          <>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                שלב 2 מתוך 3
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>כתובת אימייל</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
                לקבלת קבלות על נסיעות (אופציונלי)
              </p>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                אימייל <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(לא חובה)</span>
              </label>
              <input
                className="input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                autoFocus
                maxLength={254}
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>
          </>
        )}

        {/* Step 3: Terms of Service */}
        {step === 'tos' && (
          <>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                שלב 3 מתוך 3
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>תנאי שימוש</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
                קרא ואשר לפני שתתחיל להשתמש בשירות
              </p>
            </div>

            {/* Summary box */}
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxHeight: 180,
              overflowY: 'auto',
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                עיקרי תנאי השימוש:
              </strong>
              <ul style={{ paddingRight: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>הפלטפורמה מחברת בין נוסעים לנהגים מורשים בלבד</li>
                <li>תשלום מתבצע באפליקציה — אין תשלום מזומן לנהג</li>
                <li>דמי ביטול חלים על נסיעה שבוטלה לאחר 3 דקות מאישורה</li>
                <li>המידע האישי שלך שמור בהצפנה ולא יועבר לצדדים שלישיים</li>
                <li>שימוש לרעה בפלטפורמה יגרור חסימת חשבון</li>
              </ul>
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              padding: '0.75rem',
              background: tosChecked ? 'rgba(255,215,0,0.08)' : 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${tosChecked ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.2s',
            }}>
              <input
                type="checkbox"
                checked={tosChecked}
                onChange={e => setTosChecked(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem' }}>
                קראתי ואני מסכים/ה ל
                <a
                  href="/faq"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', marginRight: '0.25rem' }}
                >
                  תנאי השימוש
                </a>
              </span>
            </label>
          </>
        )}

        {/* Summary: show entered data on last step */}
        {step === 'tos' && (
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}>
            <div>📱 {user.phone}</div>
            {fullName && <div>👤 {fullName}</div>}
            {email && <div>📧 {email}</div>}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            color: 'var(--danger)',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {step !== 'tos' ? (
            <>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={nextStep}>
                המשך ←
              </button>
              {step === 'email' && (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => { setEmail(''); nextStep() }}
                >
                  דלג
                </button>
              )}
            </>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleFinish}
              disabled={busy || !tosChecked}
            >
              {busy ? 'שומר…' : 'בואו נתחיל 🚕'}
            </button>
          )}

          {/* Back */}
          {stepIndex > 0 && (
            <button
              className="btn"
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}
              onClick={() => { setError(null); setStep(steps[stepIndex - 1]) }}
            >
              ← חזור
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
