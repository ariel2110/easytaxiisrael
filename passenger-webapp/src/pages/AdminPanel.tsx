import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { AdminDriverItem, DocumentRead, ComplianceProfile } from '../services/api'

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
.ap,
.ap *, .ap *::before, .ap *::after { box-sizing: border-box; margin: 0; padding: 0; }
.ap {
  --bg: #070B14; --blue: #2563EB; --bluel: #60A5FA;
  --white: #F1F5F9; --muted: #94A3B8; --card: rgba(255,255,255,.05); --cb: rgba(255,255,255,.08);
  --green: #22C55E; --red: #EF4444; --yellow: #F59E0B;
  min-height: 100vh; background: var(--bg); color: var(--white);
  font-family: 'Heebo', 'Segoe UI', Arial, sans-serif; direction: rtl;
}
.ap-hdr {
  position: sticky; top: 0; z-index: 100; display: flex; align-items: center;
  justify-content: space-between; padding: 14px 20px;
  background: rgba(7,11,20,.95); backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.ap-logo { font-weight: 900; font-size: 1.1rem; }
.ap-logout { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); color: var(--muted); font: .85rem 'Heebo',sans-serif;
  cursor: pointer; transition: all .2s; }
.ap-logout:hover { color: var(--white); background: rgba(255,255,255,.08); }
.ap-body { max-width: 900px; margin: 0 auto; padding: 24px 16px 80px; }
.ap-section-title { font-size: .72rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: .7px; margin-bottom: 14px; }
/* Tabs */
.ap-tabs { display: flex; gap: 4px; background: rgba(255,255,255,.04);
  border-radius: 12px; padding: 4px; margin-bottom: 20px; width: fit-content; }
.ap-tab { padding: 9px 18px; border-radius: 9px; border: none; background: transparent;
  color: var(--muted); font: 600 .88rem 'Heebo',sans-serif; cursor: pointer; transition: all .2s; }
.ap-tab.on { background: var(--blue); color: #fff; box-shadow: 0 2px 12px rgba(37,99,235,.4); }
/* Driver list */
.ap-driver-card {
  background: var(--card); border: 1px solid var(--cb); border-radius: 14px;
  padding: 16px; margin-bottom: 10px; cursor: pointer; transition: border-color .2s;
}
.ap-driver-card:hover { border-color: rgba(96,165,250,.3); }
.ap-driver-card.open { border-color: rgba(96,165,250,.4); background: rgba(37,99,235,.05); }
.ap-driver-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ap-driver-left { display: flex; align-items: center; gap: 12px; }
.ap-driver-avatar { width: 42px; height: 42px; border-radius: 50%; background: rgba(37,99,235,.2);
  display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.ap-driver-name { font-weight: 700; font-size: .95rem; }
.ap-driver-phone { font-size: .8rem; color: var(--muted); margin-top: 2px; }
.ap-driver-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.ap-chip { font-size: .72rem; font-weight: 700; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
.ap-pending-badge { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3);
  color: #FCA5A5; font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
/* Driver detail */
.ap-detail { padding-top: 16px; border-top: 1px solid rgba(255,255,255,.07); margin-top: 16px; }
.ap-detail-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 10px; margin-bottom: 14px; }
.ap-detail-box { background: rgba(255,255,255,.04); border-radius: 10px; padding: 12px; }
.ap-detail-label { font-size: .72rem; color: var(--muted); margin-bottom: 4px; }
.ap-detail-value { font-weight: 700; font-size: .9rem; }
/* Doc review */
.ap-doc { border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.ap-doc.ok { border-color: rgba(34,197,94,.3); }
.ap-doc.pend { border-color: rgba(245,158,11,.25); }
.ap-doc.rej { border-color: rgba(239,68,68,.25); }
.ap-doc-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ap-doc-name { font-weight: 700; font-size: .9rem; }
.ap-doc-meta { font-size: .78rem; color: var(--muted); margin-top: 2px; }
.ap-doc-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
.ap-btn { padding: 8px 16px; border-radius: 9px; border: none; font: 700 .83rem 'Heebo',sans-serif;
  cursor: pointer; transition: all .2s; }
.ap-btn-green { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); color: #4ADE80; }
.ap-btn-green:hover:not(:disabled) { background: rgba(34,197,94,.2); }
.ap-btn-red { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #FCA5A5; }
.ap-btn-red:hover:not(:disabled) { background: rgba(239,68,68,.2); }
.ap-btn-blue { background: var(--blue); color: #fff; }
.ap-btn-blue:hover:not(:disabled) { background: #1D4ED8; }
.ap-btn:disabled { opacity: .45; cursor: not-allowed; }
.ap-reject-input { flex: 1; padding: 8px 12px; border-radius: 9px;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.06);
  color: var(--white); font: .83rem 'Heebo',sans-serif; }
.ap-reject-input:focus { outline: none; border-color: var(--bluel); }
.ap-view-link { color: var(--bluel); font-size: .78rem; text-decoration: none; }
.ap-view-link:hover { text-decoration: underline; }
/* Approve driver button */
.ap-approve-driver { width: 100%; padding: 13px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #16A34A, #15803D); color: #fff;
  font: 700 .95rem 'Heebo',sans-serif; cursor: pointer; transition: all .25s; margin-top: 14px; }
.ap-approve-driver:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(22,163,74,.4); }
.ap-approve-driver:disabled { opacity: .45; cursor: not-allowed; }
.ap-score-bar-bg { height: 6px; background: rgba(255,255,255,.08); border-radius: 100px; overflow: hidden; margin-top: 6px; }
.ap-score-bar { height: 100%; border-radius: 100px; background: linear-gradient(90deg,#2563EB,#60A5FA); }
.ap-empty { text-align: center; padding: 48px; color: var(--muted); font-size: .95rem; }
@keyframes apIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
.ap-ain { animation: apIn .35s ease both; }
`

// ── Helpers ────────────────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  drivers_license: 'רישיון נהיגה',
  vehicle_registration: 'רישיון רכב',
  vehicle_insurance: 'ביטוח רכב',
  background_check: 'אישור יושרה',
  vehicle_inspection: 'טסט רכב',
  profile_photo: 'תמונת פרופיל',
}

function authChip(s: string) {
  const m: Record<string, { c: string; bg: string }> = {
    pending:             { c: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
    whatsapp_verified:   { c: '#60A5FA', bg: 'rgba(96,165,250,.1)' },
    persona_in_progress: { c: '#A78BFA', bg: 'rgba(167,139,250,.1)' },
    persona_completed:   { c: '#FB923C', bg: 'rgba(251,146,60,.1)' },
    approved:            { c: '#22C55E', bg: 'rgba(34,197,94,.12)' },
  }
  return m[s] ?? { c: '#94A3B8', bg: 'rgba(148,163,184,.1)' }
}

function docStatusChip(s: string) {
  const m: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'ממתין לבדיקה', color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
    approved: { label: 'אושר ✓',       color: '#22C55E', bg: 'rgba(34,197,94,.12)' },
    rejected: { label: 'נדחה ✗',       color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
    expired:  { label: 'פג תוקף',      color: '#94A3B8', bg: 'rgba(148,163,184,.1)' },
  }
  return m[s] ?? { label: s, color: '#94A3B8', bg: 'rgba(148,163,184,.1)' }
}

// ── DocReviewRow ─────────────────────────────────────────────────────────
function DocReviewRow({ doc, onRefresh }: { doc: DocumentRead; onRefresh: () => void }) {
  const chip = docStatusChip(doc.status)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)

  const cardCls = doc.status === 'approved' ? 'ap-doc ok' : doc.status === 'pending' ? 'ap-doc pend' : 'ap-doc rej'

  async function approve() {
    setBusy(true)
    try { await api.admin.reviewDoc(doc.id, 'approved'); onRefresh() }
    catch { /* ignore */ }
    finally { setBusy(false) }
  }
  async function reject() {
    if (!rejectReason.trim()) return
    setBusy(true)
    try { await api.admin.reviewDoc(doc.id, 'rejected', rejectReason.trim()); setShowReject(false); onRefresh() }
    catch { /* ignore */ }
    finally { setBusy(false) }
  }

  return (
    <div className={cardCls}>
      <div className="ap-doc-hdr">
        <div>
          <div className="ap-doc-name">{DOC_LABELS[doc.document_type] ?? doc.document_type}</div>
          <div className="ap-doc-meta">
            הועלה: {new Date(doc.uploaded_at).toLocaleDateString('he-IL')}
            {doc.expiry_date && ` · תפוגה: ${new Date(doc.expiry_date).toLocaleDateString('he-IL')}`}
            {doc.rejection_reason && ` · סיבת דחייה: ${doc.rejection_reason}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href={api.compliance.fileUrl(doc.file_key)} target="_blank" rel="noopener noreferrer" className="ap-view-link">👁 הצג קובץ</a>
          <span className="ap-chip" style={{ color: chip.color, background: chip.bg }}>{chip.label}</span>
        </div>
      </div>
      {doc.status === 'pending' && (
        <div className="ap-doc-actions">
          <button className="ap-btn ap-btn-green" onClick={approve} disabled={busy}>✓ אשר</button>
          <button className="ap-btn ap-btn-red" onClick={() => setShowReject(s => !s)} disabled={busy}>✗ דחה</button>
          {showReject && (<>
            <input className="ap-reject-input" placeholder="סיבת דחייה…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <button className="ap-btn ap-btn-red" onClick={reject} disabled={busy || !rejectReason.trim()}>שלח</button>
          </>)}
        </div>
      )}
    </div>
  )
}

// ── DriverDetail ──────────────────────────────────────────────────────────
function DriverDetail({ driver }: { driver: AdminDriverItem }) {
  const [docs, setDocs] = useState<DocumentRead[] | null>(null)
  const [profile, setProfile] = useState<ComplianceProfile | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(driver.auth_status === 'approved')

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      api.admin.getDriverDocs(driver.driver_id),
      api.admin.getDriverProfile(driver.driver_id),
    ])
    setDocs(d); setProfile(p)
  }, [driver.driver_id])

  useEffect(() => { load() }, [load])

  async function handleApprove() {
    setApproving(true)
    try { await api.admin.approveDriver(driver.driver_id); setApproved(true) }
    catch { /* ignore */ }
    finally { setApproving(false) }
  }

  return (
    <div className="ap-detail ap-ain">
      {profile && (
        <div className="ap-detail-grid">
          {[
            ['ציון ציות', `${profile.compliance_score}/100`],
            ['סטטוס ציות', profile.compliance_status],
            ['מסמכים חסרים', String(profile.missing_required.length)],
            ['סיבת חסימה', profile.block_reason ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="ap-detail-box">
              <div className="ap-detail-label">{label}</div>
              <div className="ap-detail-value">{value}</div>
              {label === 'ציון ציות' && (
                <div className="ap-score-bar-bg">
                  <div className="ap-score-bar" style={{ width: `${profile.compliance_score}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {docs === null ? (
        <div style={{ color: 'var(--muted)', fontSize: '.85rem', textAlign: 'center', padding: '20px 0' }}>⏳ טוען מסמכים…</div>
      ) : docs.length === 0 ? (
        <div className="ap-empty">📄 הנהג לא העלה מסמכים עדיין</div>
      ) : (
        docs.map(doc => <DocReviewRow key={doc.id} doc={doc} onRefresh={load} />)
      )}

      {!approved ? (
        <button className="ap-approve-driver" onClick={handleApprove} disabled={approving}>
          {approving ? '⏳ מאשר…' : '✅ אשר נהג — אפשר קבלת נסיעות'}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, fontWeight: 700, color: '#22C55E', marginTop: 14 }}>
          🏆 הנהג אושר — יכול לקבל נסיעות
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState<AdminDriverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'ap-css'; el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.getElementById('ap-css')?.remove() }
  }, [])

  useEffect(() => {
    api.admin.listDrivers().then(d => { setDrivers(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  const filtered = drivers.filter(d =>
    filter === 'all' ? true
    : filter === 'pending' ? d.auth_status !== 'approved'
    : d.auth_status === 'approved'
  )

  const pendingCount = drivers.filter(d => d.pending_docs > 0).length

  return (
    <div className="ap">
      <div className="ap-hdr">
        <div className="ap-logo">🛠️ EasyTaxi — <span style={{ color: '#FDE047' }}>ניהול</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {pendingCount > 0 && (
            <span className="ap-pending-badge">⚠️ {pendingCount} נהגים עם מסמכים ממתינים</span>
          )}
          <button className="ap-logout" onClick={handleLogout}>יציאה</button>
        </div>
      </div>

      <div className="ap-body">
        <div className="ap-section-title">ניהול נהגים — {drivers.length} נהגים רשומים</div>

        <div className="ap-tabs">
          {([['all', 'כולם'], ['pending', 'ממתינים לאישור'], ['approved', 'מאושרים']] as const).map(([v, l]) => (
            <button key={v} className={`ap-tab${filter === v ? ' on' : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="ap-empty">⏳ טוען נהגים…</div>
        ) : filtered.length === 0 ? (
          <div className="ap-empty">אין נהגים בקטגוריה זו</div>
        ) : (
          filtered.map(driver => {
            const ac = authChip(driver.auth_status)
            const isOpen = openId === driver.driver_id
            return (
              <div key={driver.driver_id} className={`ap-driver-card${isOpen ? ' open' : ''}`}>
                <div className="ap-driver-row" onClick={() => setOpenId(isOpen ? null : driver.driver_id)}>
                  <div className="ap-driver-left">
                    <div className="ap-driver-avatar">🚗</div>
                    <div>
                      <div className="ap-driver-name">{driver.full_name ?? 'לא הוזן שם'}</div>
                      <div className="ap-driver-phone">{driver.phone}</div>
                    </div>
                  </div>
                  <div className="ap-driver-right">
                    <span className="ap-chip" style={{ color: ac.c, background: ac.bg }}>{driver.auth_status}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>ציון: {driver.compliance_score}</span>
                      {driver.pending_docs > 0 && (
                        <span className="ap-pending-badge">{driver.pending_docs} ממתינים</span>
                      )}
                    </div>
                  </div>
                </div>
                {isOpen && <DriverDetail driver={driver} />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
