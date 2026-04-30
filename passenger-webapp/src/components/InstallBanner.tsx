import { useEffect, useState } from 'react'

// Android/Chrome: captures the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return (
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (isInStandaloneMode()) return
    // Don't show if already dismissed in this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS — show guide after a short delay if not standalone
    if (isIos()) {
      const t = setTimeout(() => setShowIosGuide(true), 3000)
      return () => {
        window.removeEventListener('beforeinstallprompt', handler)
        clearTimeout(t)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null)
      dismiss()
    }
  }

  const dismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('pwa-install-dismissed', '1')
  }

  if (dismissed || isInStandaloneMode()) return null

  // ── Android install banner ──────────────────────────────────────────────
  if (deferredPrompt) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
      }}>
        <img src="/icon-72.png" width={42} height={42} alt="" style={{ borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>הוסף לדף הבית</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>גישה מהירה ל-EasyTaxi ישראל</div>
        </div>
        <button
          onClick={handleAndroidInstall}
          style={{
            background: '#fff', color: '#1d4ed8',
            border: 'none', borderRadius: 20, padding: '8px 18px',
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          התקן
        </button>
        <button
          onClick={dismiss}
          aria-label="סגור"
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
            fontSize: '1.3rem', cursor: 'pointer', flexShrink: 0, padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>
    )
  }

  // ── iOS install guide ───────────────────────────────────────────────────
  if (showIosGuide) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
        onClick={dismiss}
      >
        <div
          style={{
            background: 'linear-gradient(160deg, #0f1e45 0%, #0a0f20 100%)',
            borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '28px 24px 40px',
            width: '100%', maxWidth: 480,
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <img src="/icon-72.png" width={52} height={52} alt="" style={{ borderRadius: 14 }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>EasyTaxi ישראל</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>הוסף לדף הבית לחוויה מלאה</div>
            </div>
            <button
              onClick={dismiss}
              aria-label="סגור"
              style={{
                marginRight: 'auto', background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '50%', width: 30, height: 30,
                color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { num: '1', icon: '⬆️', text: 'לחץ על כפתור השיתוף', sub: 'בתחתית הדפדפן' },
              { num: '2', icon: '📌', text: 'בחר "הוסף למסך הבית"', sub: 'גלול למטה ברשימה' },
              { num: '3', icon: '✅', text: 'אשר עם "הוסף"', sub: 'בפינה הימנית עליונה' },
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(37,99,235,0.35)', border: '1.5px solid rgba(37,99,235,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#93c5fd', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{step.icon}</span> {step.text}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{step.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Triangle pointer pointing down to Safari bottom bar */}
          <div style={{
            marginTop: 20, textAlign: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem',
          }}>
            לחץ על ▼ בתחתית Safari
          </div>
        </div>
      </div>
    )
  }

  return null
}
