import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import type { PendingApprovalItem } from '../types'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, { color: string; bg: string; priority: number }> = {
  persona_completed:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  priority: 1 }, // highest — needs approval now
  whatsapp_verified:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  priority: 2 },
  persona_in_progress: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', priority: 3 },
  pending:             { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  priority: 4 },
  on_hold:             { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  priority: 3 },
  rejected:            { color: '#f87171', bg: 'rgba(248,113,113,0.12)', priority: 5 },
}

const DRIVER_TYPE_LABEL: Record<string, string> = {
  licensed_taxi: '🚖 מונית מורשית',
  rideshare:     '🚗 הסעה שיתופית',
}

const SUMSUB_STATUS_LABEL: Record<string, string> = {
  init:      '⬜ לא התחיל',
  pending:   '⏳ ממתין לסקירה',
  completed: '✅ אושר',
  rejected:  '❌ נדחה',
  on_hold:   '⏸️ בהמתנה ידנית',
}

const REJECT_LABEL_HE: Record<string, string> = {
  manyAccountDuplicates: 'כפילויות חשבונות',
  docExpired:            'מסמך פג תוקף',
  docUnreadable:         'מסמך לא קריא',
  faceNotMatch:          'פנים לא תואמות',
  selfieAttack:          'ניסיון תקיפת סלפי',
  screenedOut:           'סונן החוצה',
  unknownClient:         'לקוח לא מוכר',
  fraudulent:            'חשד להונאה',
  compromised:           'חשבון נפרץ',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1)  return 'לפני פחות משעה'
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  if (days < 7)   return `לפני ${days} ימים`
  return d.toLocaleDateString('he-IL')
}

function sumsubUrl(applicantId?: string) {
  if (!applicantId) return null
  return `https://cockpit.sumsub.com/applicants/${applicantId}/basicInfo`
}

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'all' | 'persona_completed' | 'whatsapp_verified' | 'persona_in_progress' | 'pending'

export default function PendingApprovals() {
  const [items, setItems]   = useState<PendingApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<Tab>('all')
  const [actionId, setActionId] = useState<string | null>(null)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.pendingApprovals.list()
      setItems(res.items)
    } catch (e: any) {
      showToast(`שגיאה: ${e.message}`, false)
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string, phone: string) {
    setActionId(id)
    try {
      await api.pendingApprovals.approve(id)
      showToast(`✅ ${phone} אושר בהצלחה`)
      await load()
    } catch (e: any) {
      showToast(`שגיאה: ${e.message}`, false)
    }
    setActionId(null)
  }

  async function handleReject(id: string, phone: string) {
    if (!confirm(`לדחות את ${phone}? הוא יושבת.`)) return
    setActionId(id)
    try {
      await api.pendingApprovals.reject(id)
      showToast(`🚫 ${phone} הושבת`)
      await load()
    } catch (e: any) {
      showToast(`שגיאה: ${e.message}`, false)
    }
    setActionId(null)
  }

  // Tabs
  const TABS: { key: Tab; label: string; filter?: string }[] = [
    { key: 'all',                label: `הכל (${items.length})` },
    { key: 'persona_completed',  label: `✅ KYC הושלם (${items.filter(i => i.auth_status === 'persona_completed').length})` },
    { key: 'whatsapp_verified',  label: `📱 WA אומת (${items.filter(i => i.auth_status === 'whatsapp_verified').length})` },
    { key: 'persona_in_progress',label: `🔄 KYC בתהליך (${items.filter(i => i.auth_status === 'persona_in_progress').length})` },
    { key: 'pending',            label: `⏳ ממתין (${items.filter(i => i.auth_status === 'pending').length})` },
  ]

  const displayed = tab === 'all' ? items : items.filter(i => i.auth_status === tab)

  // Sort by priority: persona_completed first
  const sorted = [...displayed].sort((a, b) => {
    const pa = STATUS_COLOR[a.auth_status]?.priority ?? 9
    const pb = STATUS_COLOR[b.auth_status]?.priority ?? 9
    return pa - pb
  })

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '0.65rem 1.4rem', borderRadius: '8px',
          fontWeight: 600, fontSize: '0.88rem', zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>⏳ ממתין לאישור</h1>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {items.length} נהגים ממתינים לאישור
        </span>
        <button className="btn btn-ghost" style={{ marginRight: 'auto', fontSize: '0.8rem' }} onClick={load}>
          ↻ רענן
        </button>
      </div>

      {/* Info box */}
      <div style={{
        background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
        fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#4ade80' }}>✅ KYC הושלם</strong> — נהג סיים את תהליך Sumsub, ממתין לאישורך.<br />
        <strong style={{ color: '#60a5fa' }}>📱 WA אומת</strong> — נרשם דרך WhatsApp, טרם השלים KYC.<br />
        <strong style={{ color: '#f59e0b' }}>🔄 KYC בתהליך</strong> — נמצא בתהליך אימות Sumsub כעת.<br />
        <strong style={{ color: '#94a3b8' }}>⏳ ממתין</strong> — נרשם ועדיין לא פתח תהליך אימות.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '0.5rem 0.85rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent', fontSize: '0.82rem',
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px', transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>↻ טוען...</div>
      ) : sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)',
          background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <div style={{ fontWeight: 700 }}>אין ממתינים לאישור</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>כל הנהגים בסטטוס הנוכחי טופלו</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sorted.map(item => {
            const sc = STATUS_COLOR[item.auth_status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
            const isActing = actionId === item.id
            const canApprove = item.auth_status === 'persona_completed'
            const sumsubLink = sumsubUrl(item.sumsub_id)
            const waitingSince = formatDate(item.created_at)

            return (
              <div key={item.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${sc.color}`,
                borderRadius: '10px', padding: '1rem 1.25rem',
                display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start',
              }}>
                {/* Left: Avatar + name */}
                <div style={{ minWidth: '140px', flex: '1 1 140px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: sc.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', marginBottom: '0.4rem',
                  }}>
                    🧑‍✈️
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    {item.full_name || '—'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', direction: 'ltr' }}>
                    {item.phone}
                  </div>
                  {item.driver_type && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {DRIVER_TYPE_LABEL[item.driver_type] ?? item.driver_type}
                    </div>
                  )}
                </div>

                {/* Middle: Status + wait time */}
                <div style={{ flex: '2 1 200px' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.65rem',
                      borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                      color: sc.color, background: sc.bg,
                    }}>
                      {item.auth_status_label}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    📅 נרשם: <strong style={{ color: 'var(--text-primary)' }}>{waitingSince}</strong>
                  </div>

                  {item.sumsub_status && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      🪪 Sumsub: <strong style={{ color: 'var(--text-primary)' }}>
                        {SUMSUB_STATUS_LABEL[item.sumsub_status] ?? item.sumsub_status}
                      </strong>
                      {item.review_result && (
                        <span style={{
                          marginRight: '0.5rem', fontSize: '0.68rem', fontWeight: 700,
                          color: item.review_result === 'GREEN' ? '#4ade80' : '#f87171',
                        }}>
                          [{item.review_result}]
                        </span>
                      )}
                    </div>
                  )}

                  {item.sumsub_updated_at && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      🔄 עודכן: {formatDate(item.sumsub_updated_at)}
                    </div>
                  )}

                  {/* Reject labels */}
                  {item.reject_labels && item.reject_labels.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {item.reject_labels.map(lbl => (
                        <span key={lbl} style={{
                          background: 'rgba(248,113,113,0.15)', color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.3)',
                          borderRadius: '4px', padding: '2px 7px', fontSize: '0.68rem', fontWeight: 700,
                        }}>
                          ⚠ {REJECT_LABEL_HE[lbl] ?? lbl}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '120px', alignItems: 'flex-end' }}>
                  {/* Sumsub link */}
                  {sumsubLink && (
                    <a href={sumsubLink} target="_blank" rel="noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        fontSize: '0.75rem', color: '#a78bfa', textDecoration: 'none',
                        padding: '0.3rem 0.6rem', border: '1px solid rgba(167,139,250,0.3)',
                        borderRadius: '6px', whiteSpace: 'nowrap',
                        background: 'rgba(167,139,250,0.07)',
                      }}>
                      🪪 פתח Sumsub
                    </a>
                  )}

                  {/* Approve button */}
                  {canApprove && (
                    <button
                      className="btn btn-primary"
                      disabled={isActing}
                      onClick={() => handleApprove(item.id, item.phone)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', background: 'var(--success)', border: 'none' }}
                    >
                      {isActing ? '⏳' : '✅ אשר נהג'}
                    </button>
                  )}

                  {/* Reject / deactivate */}
                  <button
                    className="btn btn-ghost"
                    disabled={isActing}
                    onClick={() => handleReject(item.id, item.phone)}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.3)' }}
                  >
                    {isActing ? '⏳' : '🚫 דחה'}
                  </button>

                  {/* Driver ID copy */}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', color: 'var(--text-secondary)' }}
                    onClick={() => { navigator.clipboard.writeText(item.id); showToast('מזהה הועתק') }}
                    title={`ID: ${item.id}`}
                  >
                    📋 {item.id.slice(0, 8)}…
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
