import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'

interface WaStatus {
  state: string
  owner_phone: string | null
  profile_name: string | null
  configured_webhook: string | null
  correct_webhook: string
  platform_phone: string
  platform_phone_source: string
  instance: string
}

interface QrData {
  base64?: string
  code?: string
  qr?: { base64?: string }
}

export default function WhatsApp() {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [status, setStatus] = useState<WaStatus | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrLoading, setQrLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  /* Fetch config (needs JWT) to get the admin key, then load status */
  const loadStatus = useCallback(async (key: string) => {
    try {
      const s = await api.whatsapp.status(key)
      setStatus(s)
      return s
    } catch { return null }
  }, [])

  const loadQr = useCallback(async (key: string) => {
    setQrLoading(true)
    try {
      const data: QrData = await api.whatsapp.qr(key)
      const b64 = data?.base64 || data?.qr?.base64 || null
      setQr(b64)
    } catch {
      setQr(null)
    } finally {
      setQrLoading(false)
    }
  }, [])

  useEffect(() => {
    api.whatsapp.config()
      .then(async cfg => {
        setAdminKey(cfg.api_key)
        const s = await loadStatus(cfg.api_key)
        if (s?.state !== 'open') loadQr(cfg.api_key)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [loadStatus, loadQr])

  /* Auto-refresh status every 5s when waiting for scan */
  useEffect(() => {
    if (!autoRefresh || !adminKey) return
    const id = setInterval(async () => {
      const s = await loadStatus(adminKey)
      if (s?.state === 'open') {
        setAutoRefresh(false)
        setQr(null)
        setActionMsg({ text: '✅ WhatsApp מחובר בהצלחה!', ok: true })
      }
    }, 5000)
    return () => clearInterval(id)
  }, [autoRefresh, adminKey, loadStatus])

  async function handleRefreshQr() {
    if (!adminKey) return
    await loadQr(adminKey)
    setAutoRefresh(true)
  }

  async function handleReconnect() {
    if (!adminKey) return
    setQrLoading(true); setActionMsg(null)
    try {
      const res = await api.whatsapp.reconnect(adminKey)
      const b64 = res?.qr?.base64 || res?.base64 || null
      setQr(b64)
      setStatus(prev => prev ? { ...prev, state: 'close' } : prev)
      setAutoRefresh(true)
      setActionMsg({ text: '🔄 התנתק בהצלחה — סרוק QR חדש לחיבור', ok: true })
    } catch (e: unknown) {
      setActionMsg({ text: `שגיאה: ${(e as Error).message}`, ok: false })
    } finally {
      setQrLoading(false)
    }
  }

  async function handleFixWebhook() {
    if (!adminKey) return
    setActionMsg(null)
    try {
      const res = await api.whatsapp.fixWebhook(adminKey)
      setActionMsg({ text: res.status === 'ok' ? `✅ Webhook עודכן: ${res.webhook_url}` : '❌ עדכון נכשל', ok: res.status === 'ok' })
    } catch (e: unknown) {
      setActionMsg({ text: `שגיאה: ${(e as Error).message}`, ok: false })
    }
  }

  async function handleTestSend() {
    if (!adminKey || !testPhone.trim()) return
    setActionMsg(null)
    try {
      const res = await api.whatsapp.testSend(adminKey, testPhone.trim())
      setActionMsg({ text: res.status === 'ok' ? `✅ הודעת בדיקה נשלחה ל-${testPhone}` : `❌ שליחה נכשלה: ${res.detail || ''}`, ok: res.status === 'ok' })
    } catch (e: unknown) {
      setActionMsg({ text: `שגיאה: ${(e as Error).message}`, ok: false })
    }
  }

  const isConnected = status?.state === 'open'
  const webhookOk = status?.configured_webhook === status?.correct_webhook

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)', gap: 10, fontSize: '1rem' }}>
      <span className="spin" style={{ fontSize: '1.3rem' }}>↻</span> טוען…
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="page-header fade-in">
        <div>
          <h1 className="page-title">💬 חיבור WhatsApp</h1>
          <p className="page-subtitle">ניהול חיבור Evolution API — סטטוס, QR, Webhook</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>סטטוס חיבור</h3>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '5px 12px' }}
            onClick={() => adminKey && loadStatus(adminKey)}>↻ רענן</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatusRow label="מצב" value={
            <span style={{ color: isConnected ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
              {isConnected ? '🟢 מחובר' : '🔴 מנותק'}
            </span>
          } />
          <StatusRow label="מספר מחובר" value={status?.owner_phone ? `+${status.owner_phone}` : '—'} />
          <StatusRow label="שם פרופיל" value={status?.profile_name || '—'} />
          <StatusRow label="מספר פלטפורמה" value={`+${status?.platform_phone}`} />
          <StatusRow label="Webhook" value={
            webhookOk
              ? <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✅ תקין</span>
              : <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>⚠️ לא מוגדר נכון</span>
          } />
          <StatusRow label="אינסטנס" value={status?.instance || '—'} />
        </div>

        {!webhookOk && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--warning)' }}>
            ⚠️ ה-Webhook לא מצביע לנקודה הנכונה — הודעות WA לא יתקבלו. לחץ "תקן Webhook" למטה.
          </div>
        )}
      </div>

      {/* QR Section — show when disconnected */}
      {!isConnected && (
        <div className="card fade-in" style={{ marginBottom: 16, textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>סריקת QR לחיבור מחדש</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', marginBottom: 22 }}>
            פתח WhatsApp → ⋮ → מכשירים מקושרים → קשר מכשיר → סרוק
          </p>

          {qrLoading ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <span className="spin" style={{ fontSize: '2rem' }}>↻</span>
            </div>
          ) : qr ? (
            <>
              <div style={{ display: 'inline-block', background: '#fff', padding: 14, borderRadius: 14, marginBottom: 18 }}>
                <img src={qr} alt="WhatsApp QR Code" style={{ display: 'block', width: 240, height: 240 }} />
              </div>
              <br />
              {autoRefresh && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 12 }}>
                  <span className="spin">↻</span> מחכה לסריקה… (בודק כל 5 שניות)
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              לחץ "QR חדש" לקבלת קוד סריקה
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleRefreshQr} disabled={qrLoading}>
              📷 QR חדש
            </button>
            <button className="btn btn-ghost" onClick={handleReconnect} disabled={qrLoading}
              style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,.3)' }}>
              🔄 נתק והתחבר מחדש
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 14 }}>
            הקוד תקף כ-60 שניות. לחץ "QR חדש" אם פג תוקפו.
          </p>
        </div>
      )}

      {/* Webhook Fix */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>⚙️ פעולות תחזוקה</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button className="btn btn-ghost" onClick={handleFixWebhook} style={{ fontSize: '0.85rem' }}>
            🔧 תקן Webhook
          </button>
          {isConnected && (
            <button className="btn btn-ghost" onClick={handleReconnect}
              style={{ fontSize: '0.85rem', color: 'var(--warning)', borderColor: 'rgba(245,158,11,.3)' }}>
              🔄 נתק (QR חדש)
            </button>
          )}
        </div>
      </div>

      {/* Test Send */}
      <div className="card fade-in" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '1rem' }}>📤 שלח הודעת בדיקה</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="tel"
            placeholder="972501234567"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '8px 12px',
              fontSize: '0.88rem', direction: 'ltr',
            }}
          />
          <button className="btn btn-primary" style={{ fontSize: '0.85rem' }}
            onClick={handleTestSend} disabled={!testPhone.trim() || !isConnected}>
            שלח
          </button>
        </div>
        {!isConnected && (
          <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 8 }}>⚠️ WhatsApp לא מחובר — לא ניתן לשלוח הודעות</p>
        )}
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className="fade-in" style={{
          padding: '12px 16px', borderRadius: 10, fontSize: '0.88rem',
          background: actionMsg.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${actionMsg.ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
          color: actionMsg.ok ? 'var(--success)' : 'var(--danger)',
        }}>
          {actionMsg.text}
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-2, rgba(255,255,255,.03))', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
