import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../services/api'
import type { Lead, LeadsListResponse } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────
const REGIONS = [
  { value: 'all',       label: '🇮🇱 כל הארץ' },
  { value: 'center',    label: '🏙️ מרכז / גוש דן' },
  { value: 'sharon',    label: '🌳 שרון / נתניה' },
  { value: 'haifa',     label: '⚓ חיפה והצפון' },
  { value: 'jerusalem', label: '🕍 ירושלים' },
  { value: 'south',     label: '🏜️ דרום / באר שבע' },
  { value: 'coastal',   label: '🌊 שפלה / אשדוד' },
  { value: 'galilee',   label: '🌄 גליל / נצרת' },
]

const COUNT_OPTIONS = [20, 50, 100, 200]
const PAGE_SIZES    = [20, 50, 100]

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'חדש',            color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  contacted: { label: 'נוצר קשר',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  qualified: { label: 'מוסמך',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  approved:  { label: '✅ מאושר',       color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  sent:      { label: '📤 נשלח',       color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  converted: { label: '🎉 הצטרף',     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  rejected:  { label: '✗ נדחה',       color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: 'var(--text-secondary)', bg: 'var(--background)' }
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '10px',
      color: s.color, background: s.bg, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

// ── Contact priority display ──────────────────────────────────────────────────
function ContactCell({ lead }: { lead: Lead }) {
  const rawPhone = lead.phone?.startsWith('NOPHONE_') ? null : lead.phone
  if (lead.whatsapp_capable && rawPhone) {
    return (
      <a href={`https://wa.me/${rawPhone}`} target="_blank" rel="noreferrer"
        style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '0.75rem', textDecoration: 'none' }}>
        📱 {rawPhone}
      </a>
    )
  }
  if (rawPhone) {
    return <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', direction: 'ltr' }}>📞 {rawPhone}</span>
  }
  if (lead.email) {
    return (
      <a href={`mailto:${lead.email}`} style={{ color: '#60a5fa', fontSize: '0.75rem', textDecoration: 'none' }}>
        📧 {lead.email}
      </a>
    )
  }
  return <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>⚠️ אין</span>
}

// ── Message Edit Modal ────────────────────────────────────────────────────────
function MessageModal({
  lead, onSave, onClose,
}: { lead: Lead; onSave: (id: string, text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(lead.message_text || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    await onSave(lead.id, text.trim())
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '580px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>✏️ עריכת הודעה — {lead.name || lead.phone}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          📍 {lead.area} · {lead.whatsapp_capable ? '📱 WhatsApp' : lead.email ? `📧 ${lead.email}` : '📞 ללא WA'}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={9}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'inherit', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', direction: 'rtl' }} />
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.4rem 0' }}>תצוגה מקדימה (WhatsApp):</div>
        <div style={{ background: '#0a4f1f', borderRadius: '8px', padding: '0.65rem 1rem', fontSize: '0.8rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', direction: 'rtl', textAlign: 'right' }}
          dangerouslySetInnerHTML={{ __html: text.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>') }} />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !text.trim()}>
            {saving ? '⏳' : '💾 שמור'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Send Confirm ──────────────────────────────────────────────────────────────
function SendConfirmDialog({ count, onConfirm, onClose }: { count: number; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  async function go() { setSending(true); await onConfirm(); setSending(false); onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '2rem', maxWidth: '420px', width: '90%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📤</div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>שליחת הודעות WhatsApp</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          עומד לשלוח <strong style={{ color: 'var(--accent)' }}>{count}</strong> הודעות לנהגים מאושרים.<br />לא ניתן לבטל לאחר השליחה.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          אני מאשר שליחת {count} הודעות
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
          <button className="btn btn-primary" onClick={go} disabled={!confirmed || sending}
            style={{ background: confirmed ? 'var(--success)' : undefined }}>
            {sending ? '⏳ שולח...' : `📤 שלח ${count} הודעות`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads() {
  // Data state
  const [data, setData]         = useState<LeadsListResponse>({ total: 0, page: 1, page_size: 20, total_pages: 1, items: [] })
  const [loading, setLoading]   = useState(true)
  const [finding, setFinding]   = useState(false)
  const [genAll, setGenAll]     = useState(false)

  // Pagination + filters (server-side)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(20)
  const [statusFilter, setStatusF]  = useState('')
  const [waFilter, setWaFilter]     = useState(false)
  const [areaFilter, setAreaFilter] = useState('')
  const [search, setSearch]         = useState('')
  const [tab, setTab]               = useState<'all' | 'approved'>('all')

  // Find-leads panel
  const [region, setRegion]         = useState('all')
  const [cityFilter, setCityFilter] = useState('')
  const [findCount, setFindCount]   = useState(50)
  const [scrapeWeb, setScrapeWeb]   = useState(true)

  // UI state
  const [editLead, setEditLead]     = useState<Lead | null>(null)
  const [sendDialog, setSendDialog] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string, ok = true) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }

  const loadLeads = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const res = await api.leads.list({
        status: tab === 'approved' ? 'approved' : (statusFilter || undefined),
        whatsapp_only: waFilter,
        area: areaFilter || undefined,
        search: search || undefined,
        page: p,
        page_size: pageSize,
      })
      setData(res)
    } catch (e: any) {
      showToast(`שגיאה: ${e.message}`, false)
    }
    setLoading(false)
  }, [page, pageSize, statusFilter, waFilter, areaFilter, search, tab])

  // Reload when filters/pagination change
  useEffect(() => { loadLeads(page) }, [page, pageSize, statusFilter, waFilter, areaFilter, tab])
  // Debounce text search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); loadLeads(1) }, 320)
  }, [search])

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function handleFind() {
    setFinding(true)
    try {
      const res = await api.leads.find({
        region,
        city: cityFilter || undefined,
        max_results: findCount,
        scrape_websites: scrapeWeb,
      })
      showToast(`נמצאו ${res.found} | נוספו ${res.inserted} | 📱 ${res.whatsapp_capable} | 📧 ${res.with_email}`)
      setPage(1); await loadLeads(1)
    } catch (e: any) {
      showToast(`שגיאה בחיפוש: ${e.message}`, false)
    }
    setFinding(false)
  }

  async function handleGenerateAll() {
    setGenAll(true)
    try {
      const res = await api.leads.generateMessages()
      showToast(`✨ נוצרו ${res.generated} הודעות AI`)
      await loadLeads(page)
    } catch (e: any) {
      showToast(`שגיאה: ${e.message}`, false)
    }
    setGenAll(false)
  }

  async function handleGenerateOne(id: string) {
    try {
      await api.leads.generateMessage(id)
      showToast('✨ הודעה נוצרה'); await loadLeads(page)
    } catch (e: any) { showToast(`שגיאה: ${e.message}`, false) }
  }

  async function handleSaveMessage(id: string, text: string) {
    await api.leads.updateMessage(id, text)
    showToast('💾 נשמר'); await loadLeads(page)
  }

  async function handleApprove(id: string) {
    try {
      await api.leads.approve(id)
      showToast('✅ אושר'); await loadLeads(page)
    } catch (e: any) { showToast(`שגיאה: ${e.message}`, false) }
  }

  async function handleReject(id: string) {
    try {
      await api.leads.reject(id)
      showToast('✗ נדחה'); await loadLeads(page)
    } catch (e: any) { showToast(`שגיאה: ${e.message}`, false) }
  }

  async function handleSendAll() {
    try {
      const res = await api.leads.sendApproved()
      showToast(`📤 נשלחו ${res.sent} | נכשלו ${res.failed}`)
      await loadLeads(page)
    } catch (e: any) { showToast(`שגיאה: ${e.message}`, false) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const items = data.items
  const approvedCount = items.filter(l => l.status === 'approved' && l.whatsapp_capable).length

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: toast.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem', zIndex: 2000, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {toast.msg}
        </div>
      )}

      {editLead && <MessageModal lead={editLead} onSave={handleSaveMessage} onClose={() => setEditLead(null)} />}
      {sendDialog && <SendConfirmDialog count={approvedCount} onConfirm={handleSendAll} onClose={() => setSendDialog(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📋 לוח לידים — גיוס נהגים</h1>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>סה״כ: <strong>{data.total}</strong></span>
      </div>

      {/* ── Find-Leads Panel ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>🔍 חיפוש לידים חדשים</div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Region */}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>אזור</div>
            <select value={region} onChange={e => setRegion(e.target.value)}
              style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem 0.6rem', color: 'inherit', fontSize: '0.82rem' }}>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {/* City */}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>עיר ספציפית (אופציונלי)</div>
            <input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="למשל: חיפה"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem 0.6rem', color: 'inherit', fontSize: '0.82rem', width: '130px' }} />
          </div>
          {/* Count */}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>כמות</div>
            <select value={findCount} onChange={e => setFindCount(Number(e.target.value))}
              style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem 0.6rem', color: 'inherit', fontSize: '0.82rem' }}>
              {COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {/* Scrape toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '2px' }}>
            <input type="checkbox" checked={scrapeWeb} onChange={e => setScrapeWeb(e.target.checked)} />
            🌐 סרוק אתרים למייל
          </label>
          {/* Search button */}
          <button className="btn btn-primary" onClick={handleFind} disabled={finding}
            style={{ fontSize: '0.82rem', marginBottom: '2px' }}>
            {finding ? '⏳ מחפש...' : '🔍 מצא לידים'}
          </button>
          <button className="btn btn-ghost" onClick={handleGenerateAll} disabled={genAll}
            style={{ fontSize: '0.82rem', marginBottom: '2px' }}>
            {genAll ? '⏳ יוצר...' : '✨ צור הודעות AI'}
          </button>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          💡 חיפוש יכלול נהגי מונית ושירותי הסעה. לידים קיימים (כולל נדחים) לא יתווספו שוב.
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'סה״כ', value: data.total, color: 'var(--text-primary)' },
          { label: '📱 WhatsApp', value: items.filter(l => l.whatsapp_capable).length, color: '#4ade80' },
          { label: '📧 מייל', value: items.filter(l => l.email).length, color: '#60a5fa' },
          { label: '📞 קווי', value: items.filter(l => !l.whatsapp_capable && l.phone && !l.phone.startsWith('NOPHONE_')).length, color: '#f59e0b' },
          { label: '✅ מאושרים', value: approvedCount, color: 'var(--accent)' },
          { label: '📤 נשלחו', value: items.filter(l => l.status === 'sent').length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.85rem', textAlign: 'center', minWidth: '70px' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'all', label: '📋 כל הלידים' },
          { key: 'approved', label: `✅ מוכן לשליחה (${approvedCount})` },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setPage(1) }}
            style={{ padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)', background: 'transparent', fontSize: '0.88rem', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, marginBottom: '-1px', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      {tab === 'all' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="🔍 שם / טלפון / עיר / מייל" value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.32rem 0.65rem', color: 'inherit', fontSize: '0.8rem', width: '180px' }} />
          <select value={statusFilter} onChange={e => { setStatusF(e.target.value); setPage(1) }}
            style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.32rem 0.65rem', color: 'inherit', fontSize: '0.8rem' }}>
            <option value="">כל הסטטוסים</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input placeholder="📍 עיר" value={areaFilter} onChange={e => { setAreaFilter(e.target.value); setPage(1) }}
            style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.32rem 0.65rem', color: 'inherit', fontSize: '0.8rem', width: '110px' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={waFilter} onChange={e => { setWaFilter(e.target.checked); setPage(1) }} />
            📱 WA בלבד
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>
            {data.total} תוצאות
          </span>
        </div>
      )}

      {/* Send button (approved tab) */}
      {tab === 'approved' && approvedCount > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={() => setSendDialog(true)}
            style={{ background: 'var(--success)', fontSize: '0.88rem', padding: '0.6rem 1.25rem' }}>
            📤 שלח ל-{approvedCount} מאושרים
          </button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>↻ טוען...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                <th>שם / עסק</th>
                <th>פרטי קשר</th>
                <th>עיר</th>
                <th style={{ width: '36px' }}>אתר</th>
                <th>סטטוס</th>
                <th style={{ minWidth: '160px' }}>הודעה</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>
                    {tab === 'approved' ? 'אין לידים מאושרים.' : 'אין לידים. לחץ "מצא לידים" למעלה.'}
                  </td>
                </tr>
              )}
              {items.map((lead, i) => {
                const isRejected = lead.status === 'rejected'
                const isHot = lead.whatsapp_capable && lead.status !== 'rejected'
                return (
                  <tr key={lead.id} style={{
                    opacity: isRejected ? 0.45 : 1,
                    borderLeft: isHot ? '3px solid #4ade80' : isRejected ? '3px solid #374151' : '3px solid transparent',
                    background: lead.status === 'approved' ? 'rgba(74,222,128,0.04)' :
                                lead.status === 'sent' ? 'rgba(167,139,250,0.04)' : undefined,
                  }}>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, textDecoration: isRejected ? 'line-through' : undefined }}>{lead.name || '—'}</div>
                      {lead.business_type && <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{lead.business_type}</div>}
                    </td>
                    <td><ContactCell lead={lead} /></td>
                    <td style={{ fontSize: '0.75rem' }}>{lead.area || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noreferrer" title={lead.website}
                          style={{ fontSize: '0.85rem', textDecoration: 'none' }}>🌐</a>
                      ) : ''}
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td>
                      {lead.message_text ? (
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}
                          onClick={() => setEditLead(lead)} title="לחץ לעריכה">
                          {lead.message_text}
                        </div>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.12rem 0.35rem' }}
                          onClick={() => handleGenerateOne(lead.id)}>✨ צור AI</button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.2rem' }}>
                        <button className="btn btn-ghost" title="ערוך הודעה" style={{ fontSize: '0.72rem', padding: '0.12rem 0.3rem' }}
                          onClick={() => setEditLead(lead)}>✏️</button>
                        {lead.status !== 'approved' && lead.status !== 'sent' && lead.message_text && lead.whatsapp_capable && (
                          <button className="btn btn-ghost" title="אשר לשליחה" style={{ fontSize: '0.72rem', padding: '0.12rem 0.3rem', color: '#4ade80' }}
                            onClick={() => handleApprove(lead.id)}>✅</button>
                        )}
                        {lead.status !== 'rejected' && lead.status !== 'sent' && (
                          <button className="btn btn-ghost" title="דחה" style={{ fontSize: '0.72rem', padding: '0.12rem 0.3rem', color: '#f87171' }}
                            onClick={() => handleReject(lead.id)}>✗</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {data.total_pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            → הקודם
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            עמוד <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> מתוך <strong style={{ color: 'var(--text-primary)' }}>{data.total_pages}</strong>
          </span>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>
            הבא ←
          </button>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.28rem 0.5rem', color: 'inherit', fontSize: '0.78rem' }}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} בעמוד</option>)}
          </select>
        </div>
      )}

      {/* Non-WA leads note */}
      {tab === 'all' && items.some(l => !l.whatsapp_capable && !l.email && !l.phone?.startsWith('NOPHONE_')) && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.8rem' }}>
          <strong style={{ color: '#f59e0b' }}>📞 טלפון קווי</strong>
          <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>— לידים עם קו קווי בלבד: ניתן לייצא לרשימת חיוג ידני.</span>
        </div>
      )}
    </div>
  )
}

