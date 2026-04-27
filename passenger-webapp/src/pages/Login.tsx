import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { requestOtp, verifyOtp, error } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function sendOtp() {
    if (!phone.trim()) return
    setBusy(true); setLocalErr(null)
    try { await requestOtp(phone.trim()); setStep('otp') }
    catch (e) { setLocalErr((e as Error).message) }
    finally { setBusy(false) }
  }

  async function verify() {
    if (!otp.trim()) return
    setBusy(true); setLocalErr(null)
    try { await verifyOtp(phone.trim(), otp.trim()) }
    catch (e) { setLocalErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
      <div className="card slide-in" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🚀</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '.5rem' }}>RideOS</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '.25rem' }}>הכנס את מספר הוואטסאפ שלך</p>
        </div>

        {step === 'phone' ? (
          <>
            <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.875rem', color: 'var(--text-secondary)' }}>מספר וואטסאפ</label>
            <input className="input" type="tel" placeholder="+972 50 000 0000" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOtp()} />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy} onClick={sendOtp}>
              {busy ? 'שולח…' : 'שלח קוד בוואטסאפ →'}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '.875rem' }}>
              📱 קוד אימות נשלח לוואטסאפ של <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
            </p>
            <input className="input" type="text" inputMode="numeric" placeholder="123456" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()} style={{ letterSpacing: '.3em', textAlign: 'center', fontSize: '1.5rem' }} />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy} onClick={verify}>
              {busy ? 'מאמת…' : 'אמת והתחבר →'}
            </button>
            <button style={{ width: '100%', marginTop: '.5rem', color: 'var(--text-secondary)', fontSize: '.875rem', padding: '.5rem' }} onClick={() => setStep('phone')}>
              ← שנה מספר
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
