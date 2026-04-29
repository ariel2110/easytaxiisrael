import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Shown after Persona redirects the driver back to the app.
 * URL: /kyc/done?inquiry-id=inq_xxx&status=completed
 */
export default function KycReturn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [countdown, setCountdown] = useState(5)

  const inquiryStatus = params.get('status') ?? 'completed'
  const isDeclined = inquiryStatus === 'declined' || inquiryStatus === 'failed'

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          navigate('/', { replace: true })
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [navigate])

  return (
    <div style={{
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      gap: '1.25rem',
      padding: '2rem',
      textAlign: 'center',
    }}>

      <div style={{ fontSize: '4rem' }}>
        {isDeclined ? '❌' : '✅'}
      </div>

      <h1 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0 }}>
        {isDeclined ? 'האימות לא הושלם' : 'הבקשה התקבלה!'}
      </h1>

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        maxWidth: 340,
        lineHeight: 1.65,
        margin: 0,
      }}>
        {isDeclined
          ? 'אירעה בעיה בתהליך האימות. אנא חזור לדשבורד ונסה שנית, או פנה לתמיכה.'
          : 'קיבלנו את המסמכים שלך ונבחן אותם בהקדם. תוצאות יישלחו אליך ב-WhatsApp תוך עד 24 שעות.'}
      </p>

      {!isDeclined && (
        <div className="card" style={{ maxWidth: 320, width: '100%', background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div>📋 מה קורה עכשיו?</div>
            <ul style={{ paddingRight: '1.2rem', margin: '0.5rem 0 0' }}>
              <li>צוות EasyTaxi בוחן את המסמכים</li>
              <li>תקבל עדכון ב-WhatsApp</li>
              <li>לאחר האישור תוכל להתחיל לנסוע</li>
            </ul>
          </div>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ marginTop: '0.5rem' }}
        onClick={() => navigate('/', { replace: true })}
      >
        חזור לדשבורד
      </button>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
        עובר אוטומטית בעוד {countdown} שניות…
      </p>
    </div>
  )
}
