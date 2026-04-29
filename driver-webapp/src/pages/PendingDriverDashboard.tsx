import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../types'

interface Props {
  user: User
  onLogout: () => void
}

const STATUS_STEPS = [
  { key: 'whatsapp_verified',   label: 'אימות WhatsApp',       icon: '✅' },
  { key: 'persona_in_progress', label: 'KYC — בתהליך אימות',   icon: '🔄' },
  { key: 'persona_completed',   label: 'KYC הושלם — ממתין לאישור', icon: '⏳' },
  { key: 'approved',            label: 'חשבון מאושר',           icon: '🎉' },
]

const STATUS_INDEX: Record<string, number> = {
  pending:              0,
  whatsapp_verified:    1,
  persona_in_progress:  2,
  persona_completed:    3,
  approved:             4,
}

const STATUS_MESSAGE: Record<string, { title: string; body: string; color: string }> = {
  pending: {
    title: 'ממתין לאימות',
    body: 'אמת את מספר הטלפון שלך דרך WhatsApp כדי להמשיך.',
    color: 'var(--warning)',
  },
  whatsapp_verified: {
    title: 'WhatsApp מאומת ✓',
    body: 'עלייך להשלים אימות זהות (KYC) — לחץ על הכפתור למטה.',
    color: 'var(--accent)',
  },
  persona_in_progress: {
    title: 'אימות זהות בתהליך',
    body: 'הגשת את המסמכים שלך. הצוות שלנו בוחן אותם — זה לוקח עד 24 שעות.',
    color: 'var(--warning)',
  },
  persona_completed: {
    title: 'KYC הושלם — ממתין לאישור ידני',
    body: 'מסמכיך התקבלו ועוברים בדיקה אחרונה על ידי הצוות. נעדכן אותך ב-WhatsApp.',
    color: 'var(--warning)',
  },
}

export default function PendingDriverDashboard({ user, onLogout }: Props) {
  const navigate = useNavigate()
  const statusIdx = STATUS_INDEX[user.auth_status] ?? 0
  const info = STATUS_MESSAGE[user.auth_status]
  const kycUrl = localStorage.getItem('kyc_url')
  const [kycLoading, setKycLoading] = useState(false)

  function handleLogout() {
    onLogout()
    navigate('/login')
  }

  function handleStartKyc() {
    if (!kycUrl) return
    setKycLoading(true)

    // Parse inquiry-id and session-token from stored KYC URL
    let inquiryId: string | null = null
    let sessionToken: string | null = null
    try {
      const parsed = new URL(kycUrl)
      inquiryId = parsed.searchParams.get('inquiry-id')
      sessionToken = parsed.searchParams.get('session-token')
    } catch {
      window.location.href = kycUrl
      return
    }

    if (!inquiryId) {
      window.location.href = kycUrl
      return
    }

    const capturedInquiryId = inquiryId
    const capturedSessionToken = sessionToken

    function launchPersonaClient() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PersonaLib = (window as any).Persona
      if (!PersonaLib?.Client) {
        window.location.href = kycUrl!
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientOptions: Record<string, any> = {
        inquiryId: capturedInquiryId,
        frameWidth: '100%',
        frameHeight: '100%',
        onReady: () => {
          setKycLoading(false)
          client.open()
        },
        onComplete: () => {
          navigate('/kyc/done')
        },
        onCancel: () => {
          setKycLoading(false)
        },
        onError: () => {
          setKycLoading(false)
          window.location.href = kycUrl!
        },
      }
      if (capturedSessionToken) clientOptions.sessionToken = capturedSessionToken

      const client = new PersonaLib.Client(clientOptions)
    }

    // If SDK already loaded, launch immediately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Persona?.Client) {
      launchPersonaClient()
      return
    }

    // Dynamically load the Persona embedded SDK from CDN
    const script = document.createElement('script')
    script.src = 'https://cdn.withpersona.com/dist/persona-v5-latest.js'
    script.onload = launchPersonaClient
    script.onerror = () => {
      setKycLoading(false)
      // Fallback: direct redirect if CDN unreachable
      window.location.href = kycUrl!
    }
    document.head.appendChild(script)
  }

  // ── KYC Transition overlay ──────────────────────────────────
  if (kycLoading) {
    return (
      <div style={{
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: 'var(--bg-primary)',
        gap: '1.5rem',
        padding: '2rem',
      }}>
        <div style={{ fontSize: '3.5rem' }}>🔐</div>
        <h2 style={{ fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>מעביר אותך לאימות זהות</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
          אנחנו מחברים אותך לשירות אימות מאובטח של <strong>Persona</strong>.<br />
          תועבר עוד רגע…
        </p>
        {/* Spinner */}
        <div style={{
          width: 48,
          height: 48,
          border: '4px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
          תצטרך: תעודת זהות / דרכון • רישיון נהיגה • סלפי
        </p>
      </div>
    )
  }

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
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>🚕 EasyTaxi — נהג</span>
        <button
          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
          onClick={handleLogout}
        >
          התנתק
        </button>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Status card */}
        {info && (
          <div className="card" style={{ borderColor: info.color, background: `${info.color}11` }}>
            <div style={{ fontWeight: 700, color: info.color, marginBottom: '0.4rem', fontSize: '1.05rem' }}>
              {info.title}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {info.body}
            </div>
          </div>
        )}

        {/* Progress stepper */}
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            תהליך ההצטרפות
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {STATUS_STEPS.map((step, i) => {
              const done = statusIdx > i + 1
              const active = statusIdx === i + 1
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Circle indicator */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    flexShrink: 0,
                    background: done
                      ? 'rgba(34,197,94,0.15)'
                      : active
                        ? 'rgba(99,102,241,0.15)'
                        : 'var(--bg-elevated)',
                    border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                    color: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                    {done ? '✓' : active ? step.icon : String(i + 1)}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: active || done ? 600 : 400,
                      color: done ? 'var(--success)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      {step.label}
                    </div>
                    {active && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.15rem' }}>
                        שלב נוכחי
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* KYC action button */}
        {(user.auth_status === 'whatsapp_verified') && kycUrl && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', textAlign: 'center' }}
            onClick={handleStartKyc}
          >
            🔐 התחל אימות זהות (KYC) →
          </button>
        )}

        {/* What to prepare */}
        {(user.auth_status === 'whatsapp_verified' || user.auth_status === 'pending') && (
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              📋 מה תצטרך לאמת
            </h3>
            <ul style={{
              paddingRight: '1.2rem',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              lineHeight: 1.9,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.1rem',
            }}>
              <li>תעודת זהות או דרכון</li>
              <li>רישיון נהיגה בתוקף</li>
              <li>רישיון מונית (אם רלוונטי)</li>
              <li>תמונת סלפי</li>
              <li>תמונות הרכב</li>
            </ul>
          </div>
        )}

        {/* Contact support */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            className="btn"
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            onClick={() => navigate('/profile')}
          >
            👤 עריכת פרופיל אישי
          </button>
          <a
            href={`https://wa.me/972546363350?text=${encodeURIComponent('שלום, אני נהג ב-EasyTaxi ואני זקוק לעזרה עם תהליך ההצטרפות')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ color: '#25D366', fontSize: '0.85rem' }}
          >
            💬 פנה לתמיכה ב-WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
