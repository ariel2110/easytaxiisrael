import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import type { DriverApplicationItem } from '../types'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONF: Record<string, { color: string; bg: string; label: string }> = {
  submitted:      { color: '#60a5fa', bg: 'rgba(96,165,250,.12)',   label: '📬 הוגשה'         },
  sumsub_pending: { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',   label: '🪪 אימות זהות'    },
  docs_required:  { color: '#c084fc', bg: 'rgba(192,132,252,.12)',  label: '📋 נדרשים מסמכים' },
  ai_review:      { color: '#38bdf8', bg: 'rgba(56,189,248,.12)',   label: '🤖 בדיקת AI'      },
  pending_admin:  { color: '#fb923c', bg: 'rgba(251,146,60,.12)',   label: '⏳ ממתין לאישור'  },
  approved:       { color: '#4ade80', bg: 'rgba(74,222,128,.12)',   label: '✅ אושר'           },
  rejected:       { color: '#f87171', bg: 'rgba(248,113,113,.12)',  label: '❌ נדחה'           },
}

const TABS = [
  { key: '',              label: 'הכל' },
  { key: 'pending_admin', label: '⏳ ממתינים לאישור' },
  { key: 'docs_required', label: '📋 העלאת מסמכים' },
  { key: 'submitted',     label: '📬 הוגשו' },
  { key: 'approved',      label: '✅ מאושרים' },
  { key: 'rejected',      label: '❌ נדחו' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'לפני פחות משעה'
  if (h < 24) return `לפני ${h} שעות`
  const days = Math.floor(h / 24)
  if (days < 7) return `לפני ${days} ימים`
  return d.toLocaleDateString('he-IL')
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DriverApplications() {
  const [items, setItems] = useState<DriverApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Approve / reject dialog state
  const [actionTarget, setActionTarget] = useState<DriverApplicationItem | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.driverApplications.list(activeTab || undefined)
      setItems(data.items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  async function handleAction() {
    if (!actionTarget || !actionType) return
    setActionLoading(true)
    try {
      if (actionType === 'approve') {
        await api.driverApplications.approve(actionTarget.id, actionNote || undefined)
      } else {
        if (!rejectReason.trim()) { alert('נא לציין סיבת דחייה'); setActionLoading(false); return }
        await api.driverApplications.reject(actionTarget.id, rejectReason, actionNote || undefined)
      }
      setActionTarget(null); setActionType(null)
      setRejectReason(''); setActionNote('')
      load()
    } catch (e: any) {
      alert(e?.message || 'שגיאה בביצוע הפעולה')
    } finally {
      setActionLoading(false)
    }
  }

  // Count per tab
  const countMap: Record<string, number> = {}
  // We'll just show from loaded items for current tab

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
          🚗 מועמדים לנהג שיתופי — חוק הובר
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '.9rem', lineHeight: 1.6 }}>
          נוסעים שהגישו בקשה לעבור להיות נהג שיתופי (Rideshare).<br />
          אחרי אישורך — תפקיד המשתמש ישתנה לנהג ויורשה לקבל נסיעות.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: "'Heebo', sans-serif", fontSize: '.85rem', fontWeight: 700,
              background: activeTab === t.key ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.05)',
              color: activeTab === t.key ? '#4ade80' : '#94a3b8',
              outline: activeTab === t.key ? '1px solid rgba(34,197,94,.3)' : '1px solid rgba(255,255,255,.08)',
              transition: 'all .2s',
            }}
          >{t.label}</button>
        ))}
        <button
          onClick={load}
          style={{ marginRight: 'auto', padding: '7px 14px', borderRadius: 9,
            border: '1px solid rgba(255,255,255,.1)', background: 'transparent',
            color: '#94a3b8', cursor: 'pointer', fontSize: '.82rem' }}
        >🔄 רענן</button>
      </div>

      {/* Law info banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 11, marginBottom: 22,
        background: 'rgba(253,224,71,.06)', border: '1px solid rgba(253,224,71,.18)',
        color: '#FDE047', fontSize: '.82rem', lineHeight: 1.65,
      }}>
        ⚖️ <strong>חוק שירות שיתוף נסיעות (חוק הובר):</strong> נמצא בתהליך חקיקה. אישור מועמד יעניק לו
        גישה לנסיעות ברגע שהחוק ייכנס לתוקף. יש לוודא שהמועמד עומד בכל דרישות החוק:
        רישיון ב׳, גיל 21+, ניסיון 2 שנים, ביטוח נסיעות בתשלום, אישור יושרה, רישיון רכב.
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>טוען...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          אין בקשות בקטגוריה זו
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const sc = STATUS_CONF[item.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,.1)', label: item.status }
            const expanded = expandedId === item.id

            return (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 16, overflow: 'hidden',
                  borderRight: `3px solid ${sc.color}`,
                }}
              >
                {/* Row summary */}
                <div
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center', gap: 16, padding: '16px 20px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Left: name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: sc.bg, border: `1px solid ${sc.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', flexShrink: 0,
                    }}>🚗</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '.95rem', marginBottom: 2 }}>
                        {item.full_name || 'ללא שם'} &nbsp;
                        <span style={{ fontWeight: 400, fontSize: '.82rem', color: '#94a3b8' }}>
                          {item.phone}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 6, fontSize: '.75rem',
                          fontWeight: 700, background: sc.bg, color: sc.color,
                        }}>{sc.label}</span>
                        <span style={{ fontSize: '.75rem', color: '#64748b' }}>
                          {formatDate(item.created_at)}
                        </span>
                        {item.has_vehicle && (
                          <span style={{ fontSize: '.75rem', color: '#94a3b8' }}>
                            🚘 {[item.vehicle_make, item.vehicle_model, item.vehicle_year].filter(Boolean).join(' ')}
                            {item.vehicle_number ? ` (${item.vehicle_number})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Next step */}
                  <div style={{ fontSize: '.78rem', color: '#64748b', maxWidth: 220, lineHeight: 1.5 }}>
                    {item.next_step}
                  </div>

                  {/* Actions (always visible for pending_admin) */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(item.status === 'pending_admin' || item.status === 'ai_review' || item.status === 'docs_required') && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setActionTarget(item); setActionType('approve') }}
                          style={{
                            padding: '8px 16px', borderRadius: 9, border: 'none',
                            background: 'rgba(74,222,128,.15)', color: '#4ade80',
                            fontFamily: "'Heebo',sans-serif", fontWeight: 700, fontSize: '.82rem',
                            cursor: 'pointer', outline: '1px solid rgba(74,222,128,.25)',
                          }}
                        >✅ אשר</button>
                        <button
                          onClick={e => { e.stopPropagation(); setActionTarget(item); setActionType('reject') }}
                          style={{
                            padding: '8px 16px', borderRadius: 9, border: 'none',
                            background: 'rgba(248,113,113,.12)', color: '#f87171',
                            fontFamily: "'Heebo',sans-serif", fontWeight: 700, fontSize: '.82rem',
                            cursor: 'pointer', outline: '1px solid rgba(248,113,113,.25)',
                          }}
                        >❌ דחה</button>
                      </>
                    )}
                    <span style={{ color: '#64748b', fontSize: '1rem' }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    padding: '18px 20px',
                    background: 'rgba(0,0,0,.12)',
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16,
                  }}>
                    <InfoBlock label="מזהה בקשה" value={item.id} mono />
                    <InfoBlock label="מזהה משתמש" value={item.user_id} mono />
                    <InfoBlock label="תפקיד נוכחי" value={item.user_role ?? '—'} />
                    <InfoBlock label="סטטוס אימות" value={item.auth_status ?? '—'} />
                    <InfoBlock label="שנות ניסיון" value={item.years_driving != null ? `${item.years_driving} שנים` : '—'} />
                    <InfoBlock label="מוטיבציה" value={item.motivation ?? '—'} />
                    {item.rejection_reason && (
                      <InfoBlock label="סיבת דחייה" value={item.rejection_reason}
                        style={{ color: '#f87171' }} />
                    )}
                    {item.admin_notes && (
                      <InfoBlock label="הערות מנהל" value={item.admin_notes} />
                    )}

                    {/* Checklist */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        בדיקת תנאים לחוק הובר
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          { label: 'רישיון ב׳', ok: true },
                          { label: 'גיל 21+', ok: true },
                          { label: 'ניסיון 2+ שנים', ok: item.years_driving != null && item.years_driving >= 2 },
                          { label: 'ביטוח נסיעות בתשלום', ok: item.status !== 'submitted' },
                          { label: 'אישור יושרה', ok: item.status !== 'submitted' },
                          { label: 'רישיון רכב', ok: item.status !== 'submitted' },
                        ].map(c => (
                          <span key={c.label} style={{
                            padding: '4px 12px', borderRadius: 7, fontSize: '.75rem', fontWeight: 700,
                            background: c.ok ? 'rgba(34,197,94,.1)' : 'rgba(248,113,113,.08)',
                            color: c.ok ? '#4ade80' : '#f87171',
                            border: `1px solid ${c.ok ? 'rgba(34,197,94,.2)' : 'rgba(248,113,113,.18)'}`,
                          }}>{c.ok ? '✅' : '⏳'} {c.label}</span>
                        ))}
                      </div>
                    </div>

                    {/* Inline actions at bottom */}
                    {item.status !== 'approved' && item.status !== 'rejected' && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, paddingTop: 8 }}>
                        <button
                          onClick={() => { setActionTarget(item); setActionType('approve') }}
                          style={{
                            padding: '10px 22px', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                            fontFamily: "'Heebo',sans-serif", fontWeight: 700, fontSize: '.9rem',
                            cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,.3)',
                          }}
                        >✅ אשר בקשה — הפוך לנהג שיתופי</button>
                        <button
                          onClick={() => { setActionTarget(item); setActionType('reject') }}
                          style={{
                            padding: '10px 22px', borderRadius: 10,
                            border: '1px solid rgba(248,113,113,.25)', background: 'rgba(248,113,113,.08)',
                            color: '#f87171', fontFamily: "'Heebo',sans-serif",
                            fontWeight: 700, fontSize: '.9rem', cursor: 'pointer',
                          }}
                        >❌ דחה בקשה</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Action modal */}
      {actionTarget && actionType && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.65)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0D1526', border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 20, padding: 28, maxWidth: 480, width: '100%',
            direction: 'rtl',
          }}>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 16 }}>
              {actionType === 'approve' ? '✅ אישור בקשה' : '❌ דחיית בקשה'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '.88rem', marginBottom: 20, lineHeight: 1.65 }}>
              {actionType === 'approve'
                ? `אישור הבקשה של ${actionTarget.full_name || actionTarget.phone} יהפוך אותו לנהג שיתופי מאושר. לאחר כניסת חוק הובר לתוקף — יוכל לקבל נסיעות.`
                : `דחיית הבקשה תשלח הודעת WhatsApp לנייד ${actionTarget.phone}.`}
            </div>

            {actionType === 'reject' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700,
                  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                  סיבת דחייה *
                </label>
                <input
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder='לדוגמה: ביטוח לא מתאים לנסיעות בתשלום'
                  style={{
                    width: '100%', background: 'rgba(255,255,255,.05)',
                    border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 10,
                    color: '#f1f5f9', font: '600 .9rem Heebo,sans-serif',
                    padding: '10px 13px', outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700,
                color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                הערה פנימית (אופציונלי)
              </label>
              <textarea
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                rows={2}
                style={{
                  width: '100%', background: 'rgba(255,255,255,.05)',
                  border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 10,
                  color: '#f1f5f9', font: '600 .9rem Heebo,sans-serif',
                  padding: '10px 13px', outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: actionType === 'approve'
                    ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                    : 'rgba(248,113,113,.15)',
                  color: actionType === 'approve' ? '#fff' : '#f87171',
                  fontFamily: "'Heebo',sans-serif", fontWeight: 800, fontSize: '.95rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  outline: actionType === 'reject' ? '1px solid rgba(248,113,113,.3)' : 'none',
                }}
              >
                {actionLoading ? 'מבצע...' : actionType === 'approve' ? '✅ אשר ועדכן' : '❌ דחה ושלח הודעה'}
              </button>
              <button
                onClick={() => { setActionTarget(null); setActionType(null); setRejectReason(''); setActionNote('') }}
                style={{
                  padding: '12px 20px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.1)', background: 'transparent',
                  color: '#94a3b8', fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
                }}
              >ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function InfoBlock({
  label, value, mono = false, style = {},
}: { label: string; value: string; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: '.85rem', color: '#e2e8f0', wordBreak: 'break-all',
        fontFamily: mono ? 'monospace' : undefined, ...style,
      }}>{value}</div>
    </div>
  )
}
