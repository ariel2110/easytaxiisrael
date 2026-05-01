import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

// ── Types ──────────────────────────────────────────────────────────────────

interface WalletEntry {
  id: string
  entry_type: 'credit' | 'debit'
  amount: string
  balance_after: string
  description: string | null
  ride_id: string | null
  created_at: string
}

interface PaymentMethod {
  id: string
  card_last4: string
  card_brand: string
  card_expiry: string | null
  is_default: boolean
}

interface PaymentProfile {
  payment_profile: 'personal' | 'business'
  business_name: string | null
  business_tax_id: string | null
  business_email: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtAmount(amount: string, type: 'credit' | 'debit') {
  const n = parseFloat(amount).toFixed(2)
  return type === 'credit' ? `+₪${n}` : `-₪${n}`
}

function CardBrandIcon({ brand }: { brand: string }) {
  const map: Record<string, string> = {
    visa: '💳', mastercard: '💳', amex: '💳', default: '💳',
  }
  return <span>{map[brand.toLowerCase()] ?? map.default}</span>
}

const TOPUP_PRESETS = [50, 100, 200, 500]

// ── Main component ─────────────────────────────────────────────────────────

export default function Wallet() {
  const navigate = useNavigate()

  const [balance, setBalance]               = useState<string>('0.00')
  const [entries, setEntries]               = useState<WalletEntry[]>([])
  const [methods, setMethods]               = useState<PaymentMethod[]>([])
  const [profile, setProfile]               = useState<PaymentProfile>({ payment_profile: 'personal', business_name: null, business_tax_id: null, business_email: null })
  const [loading, setLoading]               = useState(true)
  const [_error, setError]                   = useState<string | null>(null)

  // Top-up modal
  const [showTopup, setShowTopup]           = useState(false)
  const [topupAmount, setTopupAmount]       = useState(100)
  const [topupCustom, setTopupCustom]       = useState('')
  const [topupCard, setTopupCard]           = useState<string | null>(null)
  const [topupBusy, setTopupBusy]           = useState(false)
  const [topupError, setTopupError]         = useState<string | null>(null)

  // Business profile edit
  const [showBizEdit, setShowBizEdit]       = useState(false)
  const [bizName, setBizName]               = useState('')
  const [bizTaxId, setBizTaxId]             = useState('')
  const [bizEmail, setBizEmail]             = useState('')
  const [bizBusy, setBizBusy]               = useState(false)

  // Toast
  const [toast, setToast]                   = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      const [walletData, methodsData] = await Promise.all([
        api.wallet.get(),
        api.wallet.listMethods(),
      ])
      setBalance(walletData.wallet.balance)
      setEntries(walletData.entries)
      setProfile(walletData.payment_profile)
      setMethods(methodsData)
      setBizName(walletData.payment_profile.business_name ?? '')
      setBizTaxId(walletData.payment_profile.business_tax_id ?? '')
      setBizEmail(walletData.payment_profile.business_email ?? '')
      if (methodsData.length > 0) {
        const def = methodsData.find(m => m.is_default) ?? methodsData[0]
        setTopupCard(def.id)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleTopup() {
    const amount = topupCustom ? parseFloat(topupCustom) : topupAmount
    if (!amount || amount < 10) { setTopupError('מינימום טעינה ₪10'); return }
    if (!topupCard) { setTopupError('אנא בחר כרטיס'); return }
    setTopupBusy(true); setTopupError(null)
    try {
      const res = await api.wallet.topup(amount, topupCard)
      setBalance((res as any).balance ?? balance)
      setShowTopup(false)
      showToast(`✅ ₪${amount.toFixed(2)} נוסף לארנק`)
      await load()
    } catch (e) {
      setTopupError((e as Error).message)
    } finally {
      setTopupBusy(false)
    }
  }

  async function handleProfileToggle(prof: 'personal' | 'business') {
    try {
      const res = await api.wallet.updateProfile({
        payment_profile: prof,
        business_name: bizName || undefined,
        business_tax_id: bizTaxId || undefined,
        business_email: bizEmail || undefined,
      })
      setProfile(res)
      showToast(prof === 'business' ? '🏢 עברת לפרופיל עסקי' : '💳 עברת לפרופיל אישי')
    } catch (e) {
      showToast('שגיאה בעדכון פרופיל')
    }
  }

  async function handleSaveBiz() {
    setBizBusy(true)
    try {
      const res = await api.wallet.updateProfile({
        payment_profile: 'business',
        business_name: bizName,
        business_tax_id: bizTaxId,
        business_email: bizEmail,
      })
      setProfile(res)
      setShowBizEdit(false)
      showToast('✅ פרטי העסק עודכנו')
    } catch (e) {
      showToast('שגיאה בשמירה')
    } finally {
      setBizBusy(false)
    }
  }

  async function handleRemoveCard(id: string) {
    if (!confirm('האם להסיר כרטיס זה?')) return
    try {
      await api.wallet.removeMethod(id)
      setMethods(prev => prev.filter(m => m.id !== id))
      showToast('🗑️ כרטיס הוסר')
    } catch { showToast('שגיאה בהסרת כרטיס') }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.wallet.setDefault(id)
      setMethods(prev => prev.map(m => ({ ...m, is_default: m.id === id })))
      setTopupCard(id)
    } catch { showToast('שגיאה') }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
.wlt *{box-sizing:border-box;margin:0;padding:0;}
.wlt{
  min-height:100vh;background:#070B14;color:#F1F5F9;
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
  display:flex;flex-direction:column;align-items:center;
  padding:0 16px 80px;
}
.wlt-bg{position:fixed;inset:0;z-index:0;
  background:radial-gradient(ellipse 90% 50% at 50% 0%,rgba(37,99,235,.15) 0%,transparent 65%),
  linear-gradient(180deg,#070B14 0%,#0C1322 100%);pointer-events:none;
}
.wlt-header{
  position:sticky;top:0;z-index:10;
  width:100%;max-width:480px;
  background:rgba(7,11,20,.85);backdrop-filter:blur(12px);
  border-bottom:1px solid rgba(255,255,255,.06);
  display:flex;align-items:center;gap:12px;padding:14px 16px;
}
.wlt-header button{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.3rem;padding:4px;}
.wlt-header h1{font-size:1rem;font-weight:700;flex:1;}
.wlt-content{width:100%;max-width:480px;position:relative;z-index:1;padding-top:16px;}

/* Balance Card */
.balance-card{
  background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 60%,#1a2744 100%);
  border:1px solid rgba(255,215,0,.15);border-radius:20px;
  padding:28px 24px 24px;margin-bottom:20px;position:relative;overflow:hidden;
}
.balance-card::before{
  content:'';position:absolute;top:-40px;left:-40px;
  width:160px;height:160px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,215,0,.08) 0%,transparent 70%);
}
.balance-label{font-size:.78rem;color:#94a3b8;letter-spacing:.05em;margin-bottom:6px;}
.balance-amount{font-size:2.4rem;font-weight:800;color:#fff;letter-spacing:-.02em;margin-bottom:20px;}
.balance-amount span{font-size:1.4rem;color:#FFD700;margin-left:4px;}
.topup-btn{
  display:inline-flex;align-items:center;gap:8px;
  background:#FFD700;color:#000;border:none;border-radius:12px;
  padding:10px 22px;font-size:.9rem;font-weight:700;cursor:pointer;
  font-family:inherit;transition:opacity .15s,transform .1s;
}
.topup-btn:hover{opacity:.9;transform:translateY(-1px);}

/* Profile Toggle */
.profile-toggle{
  display:flex;gap:8px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);border-radius:14px;
  padding:6px;margin-bottom:20px;
}
.toggle-btn{
  flex:1;padding:10px;border-radius:10px;border:none;
  font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer;
  transition:all .2s;
}
.toggle-btn.active{background:#FFD700;color:#000;}
.toggle-btn:not(.active){background:transparent;color:#94a3b8;}
.toggle-btn:not(.active):hover{background:rgba(255,255,255,.05);color:#fff;}

/* Business panel */
.biz-panel{
  background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);
  border-radius:14px;padding:16px;margin-bottom:20px;
}
.biz-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.biz-name{font-size:.95rem;font-weight:700;color:#FFD700;}
.biz-tag{font-size:.7rem;background:rgba(255,215,0,.15);color:#FFD700;border-radius:20px;padding:2px 10px;}
.biz-detail{font-size:.78rem;color:#94a3b8;margin-top:3px;}
.edit-link{font-size:.78rem;color:#FFD700;background:none;border:none;cursor:pointer;font-family:inherit;}

/* Cards section */
.section-title{font-size:.8rem;font-weight:700;color:#64748b;text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:12px;}
.cards-list{margin-bottom:20px;}
.card-row{
  display:flex;align-items:center;gap:12px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
  border-radius:14px;padding:14px 16px;margin-bottom:8px;
}
.card-row.default-card{border-color:rgba(255,215,0,.3);}
.card-info{flex:1;}
.card-number{font-size:.9rem;font-weight:600;}
.card-meta{font-size:.72rem;color:#64748b;margin-top:2px;}
.default-badge{font-size:.65rem;background:rgba(255,215,0,.15);color:#FFD700;
  border-radius:20px;padding:2px 8px;margin-top:4px;display:inline-block;}
.card-actions{display:flex;gap:6px;}
.card-btn{background:none;border:1px solid rgba(255,255,255,.1);color:#94a3b8;
  border-radius:8px;padding:5px 10px;font-size:.72rem;cursor:pointer;font-family:inherit;
  transition:all .15s;}
.card-btn:hover{border-color:rgba(255,215,0,.3);color:#FFD700;}
.card-btn.danger:hover{border-color:rgba(239,68,68,.4);color:#ef4444;}
.add-card-btn{
  width:100%;padding:12px;background:rgba(255,255,255,.03);
  border:1px dashed rgba(255,255,255,.12);border-radius:14px;
  color:#64748b;font-family:inherit;font-size:.85rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:all .15s;margin-bottom:20px;
}
.add-card-btn:hover{border-color:rgba(255,215,0,.3);color:#FFD700;}

/* History */
.history-list{}
.history-item{
  display:flex;align-items:center;gap:12px;padding:12px 0;
  border-bottom:1px solid rgba(255,255,255,.05);
}
.history-item:last-child{border-bottom:none;}
.history-icon{
  width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  font-size:1rem;flex-shrink:0;
}
.history-icon.credit{background:rgba(34,197,94,.12);}
.history-icon.debit{background:rgba(239,68,68,.08);}
.history-desc{flex:1;}
.history-desc p{font-size:.85rem;font-weight:500;}
.history-desc small{font-size:.72rem;color:#64748b;}
.history-amount{font-size:.9rem;font-weight:700;}
.history-amount.credit{color:#22c55e;}
.history-amount.debit{color:#f87171;}
.empty-state{text-align:center;color:#475569;padding:32px 0;font-size:.85rem;}

/* Top-up Modal */
.modal-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(0,0,0,.7);backdrop-filter:blur(6px);
  display:flex;align-items:flex-end;justify-content:center;
}
.modal-sheet{
  width:100%;max-width:480px;
  background:#0f172a;border-top:1px solid rgba(255,255,255,.1);
  border-radius:24px 24px 0 0;padding:28px 20px 40px;
}
.modal-handle{width:40px;height:4px;background:rgba(255,255,255,.15);
  border-radius:2px;margin:0 auto 20px;}
.modal-title{font-size:1rem;font-weight:700;text-align:center;margin-bottom:20px;}
.preset-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
.preset-btn{
  padding:12px 8px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  color:#fff;font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer;
  transition:all .15s;text-align:center;
}
.preset-btn.selected{background:rgba(255,215,0,.15);border-color:#FFD700;color:#FFD700;}
.custom-input{
  width:100%;padding:12px 16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  color:#fff;font-family:inherit;font-size:.95rem;
  margin-bottom:16px;outline:none;text-align:center;direction:ltr;
}
.custom-input:focus{border-color:rgba(255,215,0,.4);}
.modal-card-label{font-size:.78rem;color:#94a3b8;margin-bottom:8px;}
.modal-card-select{
  width:100%;padding:12px 16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  color:#fff;font-family:inherit;font-size:.85rem;margin-bottom:20px;
}
.confirm-btn{
  width:100%;padding:14px;background:#FFD700;color:#000;border:none;
  border-radius:14px;font-family:inherit;font-size:1rem;font-weight:700;
  cursor:pointer;transition:opacity .15s;
}
.confirm-btn:disabled{opacity:.5;cursor:default;}
.modal-error{font-size:.78rem;color:#f87171;text-align:center;margin-top:8px;}

/* Business edit modal */
.biz-modal{background:#0f172a;border-top:1px solid rgba(255,255,255,.1);
  border-radius:24px 24px 0 0;padding:28px 20px 40px;width:100%;max-width:480px;}
.biz-input{
  width:100%;padding:12px 16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  color:#fff;font-family:inherit;font-size:.9rem;margin-bottom:12px;outline:none;
}
.biz-input:focus{border-color:rgba(255,215,0,.4);}
.biz-input::placeholder{color:#475569;}

/* Toast */
.wlt-toast{
  position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
  background:rgba(15,23,42,.95);border:1px solid rgba(255,255,255,.1);
  color:#fff;padding:10px 20px;border-radius:40px;font-size:.85rem;
  white-space:nowrap;z-index:200;pointer-events:none;
  animation:toast-in .25s ease;
}
@keyframes toast-in{from{opacity:0;transform:translate(-50%,12px);}to{opacity:1;transform:translate(-50%,0);}}
`

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#070B14', color: '#94a3b8', fontFamily: 'Heebo,sans-serif' }}>
      <span style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>↻</span>
    </div>
  )

  const balanceNum = parseFloat(balance)
  const isLowBalance = balanceNum < 20

  return (
    <div className="wlt">
      <style>{CSS}</style>
      <div className="wlt-bg" />

      {/* Header */}
      <div className="wlt-header">
        <button onClick={() => navigate(-1)}>←</button>
        <h1>💳 ארנק</h1>
      </div>

      <div className="wlt-content">

        {/* Balance Card */}
        <div className="balance-card">
          <p className="balance-label">יתרה זמינה</p>
          <div className="balance-amount">
            <span>₪</span>{balanceNum.toFixed(2)}
          </div>
          {isLowBalance && (
            <p style={{ fontSize: '.75rem', color: '#fbbf24', marginBottom: 14 }}>
              ⚠️ יתרה נמוכה — מומלץ לטעון
            </p>
          )}
          <button className="topup-btn" onClick={() => setShowTopup(true)}>
            ⚡ טען ארנק
          </button>
        </div>

        {/* Payment Profile Toggle */}
        <p className="section-title">פרופיל תשלום</p>
        <div className="profile-toggle">
          <button
            className={`toggle-btn ${profile.payment_profile === 'personal' ? 'active' : ''}`}
            onClick={() => handleProfileToggle('personal')}
          >
            💳 אישי
          </button>
          <button
            className={`toggle-btn ${profile.payment_profile === 'business' ? 'active' : ''}`}
            onClick={() => handleProfileToggle('business')}
          >
            🏢 עסקי
          </button>
        </div>

        {/* Business Panel (when business selected) */}
        {profile.payment_profile === 'business' && (
          <div className="biz-panel">
            <div className="biz-panel-header">
              <div>
                <p className="biz-name">{profile.business_name || 'שם חברה לא הוגדר'}</p>
                <p className="biz-detail">ח.פ: {profile.business_tax_id || '—'}</p>
                <p className="biz-detail">מייל חשבונית: {profile.business_email || '—'}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="biz-tag">חשבונית אוטומטית</span>
                <button className="edit-link" onClick={() => setShowBizEdit(true)}>✏️ ערוך</button>
              </div>
            </div>
            <p style={{ fontSize: '.72rem', color: '#64748b', marginTop: 4 }}>
              בכל סיום נסיעה תישלח חשבונית מס אוטומטית לכתובת המייל העסקי
            </p>
          </div>
        )}

        {/* Saved Cards */}
        <p className="section-title">אמצעי תשלום שמורים</p>
        <div className="cards-list">
          {methods.length === 0 && (
            <p style={{ fontSize: '.83rem', color: '#475569', marginBottom: 12 }}>אין כרטיסים שמורים</p>
          )}
          {methods.map(m => (
            <div key={m.id} className={`card-row ${m.is_default ? 'default-card' : ''}`}>
              <CardBrandIcon brand={m.card_brand} />
              <div className="card-info">
                <p className="card-number">{m.card_brand} ****{m.card_last4}</p>
                {m.card_expiry && <p className="card-meta">תוקף: {m.card_expiry}</p>}
                {m.is_default && <span className="default-badge">ברירת מחדל</span>}
              </div>
              <div className="card-actions">
                {!m.is_default && (
                  <button className="card-btn" onClick={() => handleSetDefault(m.id)}>ברירת מחדל</button>
                )}
                <button className="card-btn danger" onClick={() => handleRemoveCard(m.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        <button className="add-card-btn" onClick={() => showToast('הוספת כרטיס — בקרוב עם Grow.js')}>
          ＋ הוסף כרטיס אשראי
        </button>

        {/* Family — stub */}
        <p className="section-title">חשבון משפחה</p>
        <div style={{
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 14, padding: '16px', marginBottom: 20, textAlign: 'center',
        }}>
          <p style={{ fontSize: '.85rem', color: '#64748b' }}>👨‍👩‍👧 שיתוף ארנק עם בני משפחה</p>
          <p style={{ fontSize: '.75rem', color: '#475569', marginTop: 6 }}>פיצ'ר זה יהיה זמין בקרוב</p>
        </div>

        {/* Transaction History */}
        <p className="section-title">היסטוריית עסקאות</p>
        {entries.length === 0 ? (
          <p className="empty-state">אין פעולות עדיין</p>
        ) : (
          <div className="history-list">
            {entries.map(e => (
              <div key={e.id} className="history-item">
                <div className={`history-icon ${e.entry_type}`}>
                  {e.entry_type === 'credit' ? '⬆️' : '🚕'}
                </div>
                <div className="history-desc">
                  <p>{e.description ?? (e.entry_type === 'credit' ? 'טעינת ארנק' : 'נסיעה')}</p>
                  <small>{fmt(e.created_at)}</small>
                </div>
                <span className={`history-amount ${e.entry_type}`}>
                  {fmtAmount(e.amount, e.entry_type)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Top-up Modal ── */}
      {showTopup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTopup(false) }}>
          <div className="modal-sheet">
            <div className="modal-handle" />
            <p className="modal-title">⚡ טעינת ארנק</p>

            <div className="preset-grid">
              {TOPUP_PRESETS.map(p => (
                <button
                  key={p}
                  className={`preset-btn ${topupAmount === p && !topupCustom ? 'selected' : ''}`}
                  onClick={() => { setTopupAmount(p); setTopupCustom('') }}
                >
                  ₪{p}
                </button>
              ))}
            </div>

            <input
              className="custom-input"
              type="number"
              placeholder="סכום אחר..."
              value={topupCustom}
              onChange={e => setTopupCustom(e.target.value)}
            />

            {methods.length > 0 && (
              <>
                <p className="modal-card-label">חיוב מ:</p>
                <select
                  className="modal-card-select"
                  value={topupCard ?? ''}
                  onChange={e => setTopupCard(e.target.value)}
                >
                  {methods.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.card_brand} ****{m.card_last4}{m.is_default ? ' (ברירת מחדל)' : ''}
                    </option>
                  ))}
                </select>
              </>
            )}

            {methods.length === 0 && (
              <p style={{ fontSize: '.8rem', color: '#fbbf24', textAlign: 'center', marginBottom: 16 }}>
                אין כרטיסים שמורים — אנא הוסף כרטיס תחילה
              </p>
            )}

            <button
              className="confirm-btn"
              onClick={handleTopup}
              disabled={topupBusy || methods.length === 0}
            >
              {topupBusy ? '⏳ מעבד...' : `אשר טעינה ₪${topupCustom || topupAmount}`}
            </button>
            {topupError && <p className="modal-error">{topupError}</p>}
          </div>
        </div>
      )}

      {/* ── Business Edit Modal ── */}
      {showBizEdit && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBizEdit(false) }}>
          <div className="biz-modal">
            <div className="modal-handle" />
            <p className="modal-title">🏢 פרטי העסק</p>
            <input className="biz-input" placeholder="שם החברה" value={bizName} onChange={e => setBizName(e.target.value)} />
            <input className="biz-input" placeholder="מספר ח.פ / ע.מ" value={bizTaxId} onChange={e => setBizTaxId(e.target.value)} />
            <input className="biz-input" type="email" placeholder="מייל לקבלת חשבוניות" value={bizEmail} onChange={e => setBizEmail(e.target.value)} />
            <button className="confirm-btn" onClick={handleSaveBiz} disabled={bizBusy}>
              {bizBusy ? '⏳ שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="wlt-toast">{toast}</div>}
    </div>
  )
}
