import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { ComplianceProfile, DocumentRead } from '../services/api'

interface KycData { kyc_status: string; inquiry_id: string | null; kyc_url: string | null; auth_status: string }

type DocType = 'drivers_license' | 'vehicle_registration' | 'vehicle_insurance' | 'background_check' | 'vehicle_inspection'
interface DocMeta { label: string; icon: string; desc: string; needsExpiry: boolean }
const DOC_META: Record<DocType, DocMeta> = {
  drivers_license:      { label: 'רישיון נהיגה',   icon: '🪪', desc: 'רישיון נהיגה בתוקף (קדמי + אחורי)', needsExpiry: true },
  vehicle_registration: { label: 'רישיון רכב',      icon: '📄', desc: 'רישיון הרכב (טופס 102)',             needsExpiry: true },
  vehicle_insurance:    { label: 'ביטוח רכב',       icon: '🛡️', desc: 'פוליסת ביטוח חובה + מקיף',          needsExpiry: true },
  background_check:     { label: 'אישור יושרה',     icon: '✅', desc: 'אישור משטרה / יושרה עדכני',          needsExpiry: true },
  vehicle_inspection:   { label: 'טסט רכב',         icon: '🔧', desc: 'תעודת טסט (רשיון רכב) בתוקף',       needsExpiry: true },
}
const DOC_ORDER: DocType[] = ['vehicle_registration','vehicle_insurance','background_check','vehicle_inspection']

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
.dd,.dd *,.dd *::before,.dd *::after{box-sizing:border-box;margin:0;padding:0;}
.dd{
  --bg:#070B14;--blue:#2563EB;--bluel:#60A5FA;
  --white:#F1F5F9;--muted:#94A3B8;--card:rgba(255,255,255,.05);--cb:rgba(255,255,255,.09);
  --green:#22C55E;--red:#EF4444;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
}
.dd-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(37,99,235,.14) 0%,transparent 60%),
    linear-gradient(180deg,#070B14 0%,#0C1322 100%);}
.dd-hdr{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;background:rgba(7,11,20,.92);backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(255,255,255,.07);}
.dd-logo{font-weight:900;font-size:1.05rem;}
.dd-logout{padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);color:var(--muted);font:.85rem 'Heebo',sans-serif;
  cursor:pointer;transition:all .2s;}
.dd-logout:hover{color:var(--white);background:rgba(255,255,255,.08);}
.dd-body{position:relative;z-index:1;max-width:560px;margin:0 auto;padding:24px 16px 80px;}
.dd-tabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border-radius:12px;padding:4px;margin-bottom:20px;}
.dd-tab{flex:1;padding:10px;border-radius:9px;border:none;background:transparent;color:var(--muted);
  font:600 .88rem 'Heebo',sans-serif;cursor:pointer;transition:all .2s;}
.dd-tab.on{background:var(--blue);color:#fff;box-shadow:0 2px 12px rgba(37,99,235,.4);}
.dd-hero{background:linear-gradient(135deg,rgba(37,99,235,.15),rgba(37,99,235,.05));
  border:1px solid rgba(96,165,250,.15);border-radius:20px;padding:24px;margin-bottom:16px;text-align:center;}
.dd-phone{font-size:.85rem;color:var(--muted);margin-bottom:6px;}
.dd-name{font-size:1.45rem;font-weight:900;margin-bottom:16px;line-height:1.2;}
.dd-badge{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:100px;font-size:.88rem;font-weight:700;}
.dd-prog-wrap{background:var(--card);border:1px solid var(--cb);border-radius:16px;padding:20px;margin-bottom:14px;}
.dd-prog-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.dd-prog-title{font-weight:700;font-size:.95rem;}
.dd-prog-pct{font-weight:900;font-size:1.1rem;color:var(--bluel);}
.dd-prog-bar-bg{height:8px;background:rgba(255,255,255,.08);border-radius:100px;overflow:hidden;}
.dd-prog-bar{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--blue),var(--bluel));transition:width .6s ease;}
.dd-sec{background:var(--card);border:1px solid var(--cb);border-radius:16px;padding:20px;margin-bottom:14px;}
.dd-sec-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:14px;}
.dd-doc{border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:14px 16px;margin-bottom:10px;transition:border-color .2s;}
.dd-doc:last-child{margin-bottom:0;}
.dd-doc.ok{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.05);}
.dd-doc.pend{border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.04);}
.dd-doc.rej{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.05);}
.dd-doc-hdr{display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:10px;}
.dd-doc-left{display:flex;align-items:center;gap:10px;}
.dd-doc-icon{font-size:1.3rem;}
.dd-doc-name{font-weight:700;font-size:.92rem;}
.dd-doc-desc{font-size:.75rem;color:var(--muted);margin-top:2px;}
.dd-doc-status{font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:100px;white-space:nowrap;}
.dd-doc-body{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);}
.dd-upload-zone{border:2px dashed rgba(96,165,250,.3);border-radius:12px;padding:20px;text-align:center;
  cursor:pointer;transition:all .2s;margin-bottom:12px;}
.dd-upload-zone:hover,.dd-upload-zone.drag{border-color:var(--bluel);background:rgba(96,165,250,.05);}
.dd-upload-icon{font-size:2rem;margin-bottom:8px;}
.dd-upload-hint{font-size:.8rem;color:var(--muted);margin-top:4px;}
.dd-expiry-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.dd-expiry-label{font-size:.82rem;color:var(--muted);white-space:nowrap;}
.dd-expiry-input{flex:1;padding:9px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);color:var(--white);font:.88rem 'Heebo',sans-serif;}
.dd-expiry-input:focus{outline:none;border-color:var(--bluel);}
.dd-btn{width:100%;padding:13px;border-radius:12px;border:none;
  font:700 .95rem 'Heebo',sans-serif;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;transition:all .25s;}
.dd-btn-blue{background:linear-gradient(135deg,var(--blue),#1D4ED8);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35);}
.dd-btn-blue:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 20px rgba(37,99,235,.5);}
.dd-btn-purple{background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;box-shadow:0 4px 14px rgba(124,58,237,.35);}
.dd-btn-purple:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 20px rgba(124,58,237,.5);}
.dd-btn:disabled{opacity:.45;cursor:not-allowed;}
.dd-info{padding:11px 14px;background:rgba(37,99,235,.07);border:1px solid rgba(96,165,250,.12);
  border-radius:10px;font-size:.78rem;color:var(--muted);line-height:1.65;margin-top:10px;}
.dd-err{padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);
  border-radius:10px;font-size:.82rem;color:#FCA5A5;margin-top:8px;}
.dd-field-row{margin-bottom:14px;}
.dd-field-label{font-size:.8rem;color:var(--muted);margin-bottom:6px;display:block;}
.dd-field-input{width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);color:var(--white);font:.92rem 'Heebo',sans-serif;}
.dd-field-input:focus{outline:none;border-color:var(--bluel);}
.dd-wa-btn{display:flex;align-items:center;gap:9px;padding:12px 16px;border-radius:12px;
  background:#25D366;color:#fff;font-weight:700;font-size:.9rem;text-decoration:none;
  justify-content:center;transition:all .25s;}
.dd-wa-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(37,211,102,.4);}
.dd-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.dd-stat{text-align:center;padding:12px 8px;background:rgba(255,255,255,.04);border-radius:12px;}
.dd-stat-n{font-size:1.4rem;font-weight:900;color:var(--bluel);}
.dd-stat-l{font-size:.68rem;color:var(--muted);margin-top:3px;}
.dd-id-card{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);border-radius:14px;padding:16px;margin-top:12px;}
.dd-id-card-title{font-size:.78rem;font-weight:700;color:#22C55E;letter-spacing:.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px;}
.dd-id-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.dd-id-field{background:rgba(255,255,255,.04);border-radius:10px;padding:10px 12px;}
.dd-id-label{font-size:.68rem;color:var(--muted);margin-bottom:3px;}
.dd-id-value{font-size:.88rem;font-weight:700;color:var(--white);}
.dd-step-done{display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(34,197,94,.08);
  border:1px solid rgba(34,197,94,.25);border-radius:12px;margin-bottom:10px;
  font-size:.88rem;font-weight:700;color:#22C55E;}
.dd-step-pending{display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(245,158,11,.07);
  border:1px solid rgba(245,158,11,.2);border-radius:12px;margin-bottom:10px;
  font-size:.88rem;font-weight:700;color:#F59E0B;}
.dd-btn-red{background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;box-shadow:0 4px 14px rgba(220,38,38,.3);}
.dd-btn-red:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 20px rgba(220,38,38,.5);}
.dd-modal-overlay{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;padding:20px;}
.dd-modal{background:#0F172A;border:1px solid rgba(239,68,68,.3);border-radius:20px;padding:28px;max-width:400px;width:100%;}
.dd-modal-title{font-size:1.1rem;font-weight:900;color:#EF4444;margin-bottom:10px;text-align:center;}
.dd-modal-body{font-size:.88rem;color:var(--muted);line-height:1.7;text-align:center;margin-bottom:20px;}
.dd-modal-actions{display:flex;gap:10px;flex-direction:column;}
@keyframes ddIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.dd-ain{animation:ddIn .4s ease both;}
.dd-d1{animation-delay:.08s}.dd-d2{animation-delay:.15s}.dd-d3{animation-delay:.23s}
@keyframes ddSpin{to{transform:rotate(360deg)}}
`

// ── Helpers ────────────────────────────────────────────────────────────────
function authStatusInfo(s: string) {
  const map: Record<string,{label:string;color:string;bg:string;icon:string}> = {
    pending:             {label:'לא מאומת',    color:'#F59E0B',bg:'rgba(245,158,11,.12)',icon:'⚠️'},
    whatsapp_verified:   {label:'WA אומת',      color:'#60A5FA',bg:'rgba(96,165,250,.10)',icon:'✅'},
    persona_in_progress: {label:'Sumsub בתהליך', color:'#A78BFA',bg:'rgba(167,139,250,.10)',icon:'🔄'},
    persona_completed:   {label:'ממתין לאישור',  color:'#FB923C',bg:'rgba(251,146,60,.10)',icon:'⏳'},
    approved:            {label:'מאושר ✓',      color:'#22C55E',bg:'rgba(34,197,94,.12)',icon:'🏆'},
  }
  return map[s] ?? {label:s,color:'#94A3B8',bg:'rgba(148,163,184,.1)',icon:'❓'}
}
function docChip(s: string) {
  const m: Record<string,{label:string;color:string;bg:string}> = {
    pending:  {label:'ממתין לבדיקה',color:'#F59E0B',bg:'rgba(245,158,11,.12)'},
    approved: {label:'אושר ✓',      color:'#22C55E',bg:'rgba(34,197,94,.12)'},
    rejected: {label:'נדחה ✗',      color:'#EF4444',bg:'rgba(239,68,68,.12)'},
    expired:  {label:'פג תוקף',     color:'#94A3B8',bg:'rgba(148,163,184,.1)'},
    missing:  {label:'חסר',         color:'#94A3B8',bg:'rgba(148,163,184,.1)'},
  }
  return m[s] ?? m['missing']
}

// ── DocCard ────────────────────────────────────────────────────────────────
function DocCard({ type, doc, onUploaded }: { type: DocType; doc: DocumentRead|undefined; onUploaded: ()=>void }) {
  const meta = DOC_META[type]
  const status = doc?.status ?? 'missing'
  const chip = docChip(status)
  const [open, setOpen] = useState(status === 'rejected' || status === 'missing')
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState<File|null>(null)
  const [expiry, setExpiry] = useState(doc?.expiry_date?.slice(0,10) ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cardCls = status==='approved' ? 'dd-doc ok' : status==='pending' ? 'dd-doc pend' : status==='rejected' ? 'dd-doc rej' : 'dd-doc'

  async function submit() {
    if (!file) { setErr('נא לבחור קובץ'); return }
    if (meta.needsExpiry && !expiry) { setErr('נא להזין תאריך תפוגה'); return }
    setBusy(true); setErr(null)
    try {
      const { file_key } = await api.compliance.uploadFile(file)
      await api.compliance.submitDoc(type, file_key, expiry || undefined)
      setFile(null); onUploaded()
    } catch(e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className={cardCls}>
      <div className="dd-doc-hdr" onClick={() => setOpen(o => !o)}>
        <div className="dd-doc-left">
          <span className="dd-doc-icon">{meta.icon}</span>
          <div><div className="dd-doc-name">{meta.label}</div><div className="dd-doc-desc">{meta.desc}</div></div>
        </div>
        <div className="dd-doc-status" style={{color:chip.color,background:chip.bg}}>{chip.label}</div>
      </div>
      {open && (
        <div className="dd-doc-body">
          {doc?.rejection_reason && <div className="dd-err">❌ סיבת דחייה: {doc.rejection_reason}</div>}
          <div
            className={`dd-upload-zone${drag ? ' drag' : ''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)setFile(f)}}
            onClick={()=>inputRef.current?.click()}
          >
            <div className="dd-upload-icon">{file ? '📎' : '📤'}</div>
            <div style={{fontWeight:700,fontSize:'.88rem'}}>{file ? file.name : 'לחץ או גרור קובץ'}</div>
            <div className="dd-upload-hint">JPEG, PNG, WEBP, HEIC, PDF — עד 10 MB</div>
          </div>
          <input ref={inputRef} type="file" style={{display:'none'}}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}} />
          {meta.needsExpiry && (
            <div className="dd-expiry-row">
              <label className="dd-expiry-label">תאריך תפוגה:</label>
              <input type="date" className="dd-expiry-input" value={expiry} onChange={e=>setExpiry(e.target.value)} />
            </div>
          )}
          {err && <div className="dd-err">{err}</div>}
          <button className="dd-btn dd-btn-blue" onClick={submit} disabled={busy||!file}>
            {busy ? '⏳ מעלה…' : '📤 העלה מסמך'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
type Tab = 'home' | 'verify'

type SumsubMyData = { status: string; review_result: string|null; level_name: string|null; auth_status: string; full_name: string|null; extracted: { first_name: string|null; last_name: string|null; date_of_birth: string|null; id_number: string|null; id_expiry: string|null; issuing_country: string|null; license_number: string|null; license_class: string|null; gov_id_passed: boolean; selfie_passed: boolean } }

export default function DriverDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'verify' ? 'verify' : 'home')
  const [authStatus, setAuthStatus] = useState<string>(user?.auth_status ?? 'pending')
  const [kycStatus, setKycStatus] = useState<string>('not_started')
  const [profile, setProfile] = useState<ComplianceProfile|null>(null)
  const [docs, setDocs] = useState<DocumentRead[]>([])
  const [sumsubData, setSumsubData] = useState<SumsubMyData|null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicleResult, setVehicleResult] = useState<null | { found: boolean; is_active: boolean; is_removed: boolean; is_taxi: boolean; manufacturer?: string; model?: string; color?: string; year?: string; test_expiry?: string; warnings: string[] }>(null)
  const [vehicleBusy, setVehicleBusy] = useState(false)
  const [vehicleErr, setVehicleErr] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'dd-css'; el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.getElementById('dd-css')?.remove() }
  }, [])

  const loadCompliance = useCallback(async () => {
    try {
      const [p,d] = await Promise.all([api.compliance.getProfile(), api.compliance.listDocs()])
      setProfile(p); setDocs(d)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('access_token')) return
    const poll = async () => {
      try {
        const d: KycData = await api.auth.driverKycStatus()
        const s = d.auth_status || d.kyc_status
        setAuthStatus(s)
        const ks = d.kyc_status
        setKycStatus(ks)
        // Once we get a real status from server, clear the submitted flag
        if (ks !== 'init' && ks !== 'not_started') {
          localStorage.removeItem('sumsub_submitted')
        }
        if (s === 'approved') { if (pollRef.current) clearInterval(pollRef.current) }
      } catch { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    if (tab === 'verify') {
      loadCompliance()
      api.sumsub.getMyData().then(setSumsubData).catch(() => null)
    }
  }, [tab, loadCompliance])

  // If user just returned from Sumsub and flag is set, treat as pending locally
  const effectiveKycStatus =
    (kycStatus === 'init' || kycStatus === 'not_started') && localStorage.getItem('sumsub_submitted')
      ? 'pending'
      : kycStatus

  const st = authStatusInfo(authStatus)
  const isApproved = authStatus === 'approved'
  const progPct = profile?.progress_pct ?? 0
  const pendingBadge = profile ? profile.missing_required.length + docs.filter(d=>d.status==='pending').length : null

  function latestDoc(type: DocType): DocumentRead|undefined {
    return docs.filter(d=>d.document_type===type).sort((a,b)=>new Date(b.uploaded_at).getTime()-new Date(a.uploaded_at).getTime())[0]
  }

  async function handleDeleteRequest() {
    setDeleteLoading(true)
    try {
      const r = await api.auth.deleteRequest()
      setDeleteMsg(r.message)
      setTimeout(() => { logout(); navigate('/login?role=driver', {replace:true}) }, 4000)
    } catch { setDeleteMsg('שגיאה בשליחת הבקשה. נסה שוב.') }
    finally { setDeleteLoading(false) }
  }

  function handleLogout() { logout(); navigate('/login?role=driver', {replace:true}) }

  return (
    <div className="dd">

      <div className="dd-bg" />
      <div className="dd-hdr">
        <div className="dd-logo">🚕 Easy<span style={{color:'#FDE047'}}>Taxi</span> — נהגים</div>
        <button className="dd-logout" onClick={handleLogout}>יציאה</button>
      </div>
      <div className="dd-body">
        {/* Tabs */}
        <div className="dd-tabs">
          <button className={`dd-tab${tab==='home'?' on':''}`} onClick={()=>setTab('home')}>🏠 ראשי</button>
          <button className={`dd-tab${tab==='verify'?' on':''}`} onClick={()=>setTab('verify')}>
            📋 אימות {pendingBadge !== null && pendingBadge > 0 && (
              <span style={{marginRight:4,background:'#EF4444',borderRadius:'100px',padding:'1px 7px',fontSize:'.7rem',color:'#fff'}}>{pendingBadge}</span>
            )}
          </button>
        </div>

        {/* ── HOME ── */}
        {tab === 'home' && (<>
          <div className="dd-hero dd-ain">
            <div className="dd-phone">{user?.phone}</div>
            <div className="dd-name">{user?.full_name ?? 'נהג EasyTaxi'}</div>
            <div className="dd-badge" style={{background:st.bg,color:st.color,border:`1px solid ${st.color}40`}}>
              <span>{st.icon}</span>{st.label}
            </div>
          </div>
          <div className="dd-sec dd-ain dd-d1">
            <div className="dd-sec-title">סטטיסטיקות</div>
            <div className="dd-stats">
              {(['נסיעות','דירוג','השבוע'] as const).map((l,i) => (
                <div className="dd-stat" key={l}>
                  <div className="dd-stat-n">{i===2?'₪0':i===1?'—':'0'}</div>
                  <div className="dd-stat-l">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dd-sec dd-ain dd-d2">
            <div className="dd-sec-title">סטטוס אימות</div>
            {isApproved ? (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:14,background:'rgba(34,197,94,.1)',border:'1.5px solid rgba(34,197,94,.3)',borderRadius:12,fontWeight:700,color:'#22C55E'}}>
                🏆 הזהות אומתה — אתה מוכן לקבל נסיעות!
              </div>
            ) : (<>
              <div className="dd-info" style={{marginTop:0}}>כדי לקבל נסיעות, עליך להשלים את תהליך האימות. עבור ללשונית <strong>אימות</strong>.</div>
              <button className="dd-btn dd-btn-purple" style={{marginTop:12}} onClick={()=>setTab('verify')}>📋 השלם אימות ← לחץ כאן</button>
            </>)}
          </div>
          <div className="dd-sec dd-ain dd-d3">
            <div className="dd-sec-title">עזרה ותמיכה</div>
            <a href="https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A0%D7%94%D7%92%20%D7%91-EasyTaxi%20%D7%95%D7%A6%D7%A8%D7%99%D7%9A%20%D7%A2%D7%96%D7%A8%D7%94"
              target="_blank" rel="noopener noreferrer" className="dd-wa-btn">
              💬 שאל את התמיכה בוואטסאפ
            </a>
          </div>
        </>)}

        {/* ── VERIFY ── */}
        {tab === 'verify' && (<>
          {/* Progress */}
          <div className="dd-prog-wrap dd-ain">
            <div className="dd-prog-label">
              <span className="dd-prog-title">התקדמות אימות</span>
              <span className="dd-prog-pct">{progPct}%</span>
            </div>
            <div className="dd-prog-bar-bg"><div className="dd-prog-bar" style={{width:`${progPct}%`}} /></div>
            {profile && (
              <div style={{marginTop:10,fontSize:'.78rem',color:'var(--muted)'}}>
                ציון ציות: <strong style={{color:'#60A5FA'}}>{profile.compliance_score}/100</strong>
                {profile.block_reason && <span style={{color:'#FCA5A5',marginRight:8}}>⚠️ {profile.block_reason}</span>}
              </div>
            )}
          </div>

          {/* Step 1: Sumsub */}
          <div className="dd-sec dd-ain dd-d1">
            <div className="dd-sec-title">שלב 1 — אימות זהות (Sumsub)</div>

            {/* Status indicator */}
            {(effectiveKycStatus === 'completed' || authStatus === 'persona_completed' || authStatus === 'approved') ? (
              <div className="dd-step-done">✅ אימות זהות הושלם בהצלחה</div>
            ) : effectiveKycStatus === 'pending' ? (
              <div className="dd-step-pending">
                ⏳ המסמכים הוגשו — ממתינים לאישור Sumsub
                <span style={{display:'block',fontSize:'.78rem',fontWeight:400,marginTop:4,color:'#FDE68A'}}>
                  בדרך כלל לוקח עד מספר דקות. הדף יתרענן אוטומטית.
                </span>
              </div>
            ) : effectiveKycStatus === 'rejected' ? (
              <div className="dd-err" style={{marginBottom:10}}>❌ אימות נדחה — {sumsubData?.review_result === 'RED' ? 'בעיה במסמכים. ניתן לנסות שוב.' : 'פנה לתמיכה'}</div>
            ) : effectiveKycStatus === 'on_hold' ? (
              <div className="dd-step-pending">🔒 האימות הועבר לבדיקה ידנית — נחזור אליך בקרוב</div>
            ) : null}

            {/* Start / retry button — always visible unless fully approved */}
            {authStatus !== 'approved' && (
              <>
                {(effectiveKycStatus === 'not_started' || effectiveKycStatus === 'init') && (
                  <p style={{fontSize:'.88rem',color:'var(--muted)',marginBottom:14,lineHeight:1.6}}>
                    אמת את זהותך עם תעודת זהות / דרכון + סלפי חי. לוקחת כ-3 דקות.
                  </p>
                )}
                <button
                  className={`dd-btn ${effectiveKycStatus === 'rejected' ? 'dd-btn-blue' : 'dd-btn-purple'}`}
                  style={{marginTop: effectiveKycStatus === 'pending' || effectiveKycStatus === 'on_hold' ? 12 : 0}}
                  onClick={() => navigate('/verify')}
                >
                  {effectiveKycStatus === 'rejected'
                    ? '🔄 נסה שוב — פתח אימות מחדש'
                    : effectiveKycStatus === 'pending'
                    ? '🔍 פתח את תהליך האימות שוב'
                    : effectiveKycStatus === 'on_hold'
                    ? '📋 פתח תהליך האימות לבדיקה'
                    : effectiveKycStatus === 'init'
                    ? '🪪 המשך אימות Sumsub'
                    : '🪪 התחל אימות Sumsub'}
                </button>
              </>
            )}

            {/* Verified data card */}
            {sumsubData && sumsubData.extracted && (sumsubData.extracted.first_name || sumsubData.extracted.id_number) && (
              <div className="dd-id-card">
                <div className="dd-id-card-title">🪪 פרטים שנאספו מ-Sumsub</div>
                <div className="dd-id-grid">
                  {sumsubData.extracted.first_name && (
                    <div className="dd-id-field"><div className="dd-id-label">שם פרטי</div><div className="dd-id-value">{sumsubData.extracted.first_name}</div></div>
                  )}
                  {sumsubData.extracted.last_name && (
                    <div className="dd-id-field"><div className="dd-id-label">שם משפחה</div><div className="dd-id-value">{sumsubData.extracted.last_name}</div></div>
                  )}
                  {sumsubData.extracted.date_of_birth && (
                    <div className="dd-id-field"><div className="dd-id-label">תאריך לידה</div><div className="dd-id-value">{sumsubData.extracted.date_of_birth}</div></div>
                  )}
                  {sumsubData.extracted.id_number && (
                    <div className="dd-id-field"><div className="dd-id-label">מספר רישיון נהיגה</div><div className="dd-id-value">{sumsubData.extracted.id_number}</div></div>
                  )}
                  {sumsubData.extracted.id_expiry && (
                    <div className="dd-id-field"><div className="dd-id-label">תוקף תעודה</div><div className="dd-id-value">{sumsubData.extracted.id_expiry}</div></div>
                  )}
                  {sumsubData.extracted.issuing_country && (
                    <div className="dd-id-field"><div className="dd-id-label">מדינה מנפיקה</div><div className="dd-id-value">{sumsubData.extracted.issuing_country}</div></div>
                  )}
                </div>
              </div>
            )}

            <div className="dd-info">🛡️ Sumsub · ISO 27001 · SOC 2 Type II — הנתונים מועברים ישירות ל-Sumsub.</div>
          </div>

          {/* Step 1.5: Vehicle Number */}
          <div className="dd-sec dd-ain" style={{animationDelay:'.12s'}}>
            <div className="dd-sec-title">רישום רכב — אימות מול מאגר הממשלה</div>
            <div className="dd-field-row">
              <label className="dd-field-label">מספר לוחית רישוי (לדוגמה: 12-345-67)</label>
              <div style={{display:'flex',gap:8}}>
                <input
                  className="dd-field-input"
                  placeholder="12-345-67"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  style={{flex:1}}
                  maxLength={10}
                  dir="ltr"
                />
                <button
                  className="dd-btn dd-btn-blue"
                  style={{width:'auto',padding:'0 18px',minWidth:90}}
                  disabled={vehicleBusy || vehicleNumber.length < 5}
                  onClick={async () => {
                    setVehicleBusy(true); setVehicleErr(null); setVehicleResult(null)
                    try {
                      const r = await api.vehicle.check(vehicleNumber.replace(/-/g,''))
                      setVehicleResult(r)
                    } catch(e) { setVehicleErr((e as Error).message) }
                    finally { setVehicleBusy(false) }
                  }}
                >
                  {vehicleBusy ? '⏳' : '🔍 בדוק'}
                </button>
              </div>
            </div>
            {vehicleErr && <div className="dd-err">{vehicleErr}</div>}
            {vehicleResult && (
              vehicleResult.found ? (
                <div style={{background:'rgba(34,197,94,.07)',border:'1px solid rgba(34,197,94,.25)',borderRadius:12,padding:'14px 16px',marginTop:10}}>
                  <div style={{fontWeight:700,color:'#22C55E',marginBottom:8,fontSize:'.88rem'}}>
                    ✅ הרכב נמצא במאגר{vehicleResult.is_taxi ? ' — מונית/תחב"צ' : ''}
                    {vehicleResult.is_removed && <span style={{color:'#EF4444',marginRight:8}}>⚠ הוסר מהכביש</span>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:'.82rem',color:'var(--muted)'}}>
                    {vehicleResult.manufacturer && <div><strong>יצרן:</strong> {vehicleResult.manufacturer}</div>}
                    {vehicleResult.model && <div><strong>דגם:</strong> {vehicleResult.model}</div>}
                    {vehicleResult.color && <div><strong>צבע:</strong> {vehicleResult.color}</div>}
                    {vehicleResult.year && <div><strong>שנה:</strong> {vehicleResult.year}</div>}
                    {vehicleResult.test_expiry && <div><strong>טסט עד:</strong> {vehicleResult.test_expiry}</div>}
                  </div>
                  {vehicleResult.warnings && vehicleResult.warnings.length > 0 && (
                    <div style={{marginTop:10,fontSize:'.8rem',color:'#FCA5A5'}}>
                      {vehicleResult.warnings.map((w,i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="dd-err">🔍 הרכב לא נמצא במאגר. בדוק את מספר הלוחית.</div>
              )
            )}
          </div>

          {/* Step 2: Documents */}
          <div className="dd-sec dd-ain dd-d2">
            <div className="dd-sec-title">שלב 2 — מסמכים נדרשים</div>
            {DOC_ORDER.map(type => (
              <DocCard key={type} type={type} doc={latestDoc(type)} onUploaded={loadCompliance} />
            ))}
          </div>

          <div className="dd-info dd-ain" style={{marginBottom:14}}>
            📌 לאחר העלאת המסמכים, הם ייבדקו על ידי צוות EasyTaxi תוך 1-2 ימי עסקים.
            תקבל הודעה בוואטסאפ עם תוצאת הבדיקה.
          </div>

          {/* Data deletion */}
          <div className="dd-sec dd-ain" style={{animationDelay:'.3s',borderColor:'rgba(239,68,68,.15)'}}>
            <div className="dd-sec-title" style={{color:'#FCA5A5'}}>פרטיות ומחיקת נתונים</div>
            <p style={{fontSize:'.83rem',color:'var(--muted)',lineHeight:1.65,marginBottom:14}}>
              בהתאם לחוק הגנת הפרטיות, יש לך זכות לבקש מחיקת כל הנתונים שלך מהפלטפורמה.
              הבקשה תטופל תוך 30 יום. לאחר מחיקת הנתונים, החשבון שלך יוסר לצמיתות.
            </p>
            <button className="dd-btn dd-btn-red" onClick={() => setShowDeleteModal(true)}>
              🗑️ בקשת מחיקת נתונים ויציאה מהפלטפורמה
            </button>
          </div>
        </>)}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="dd-modal-overlay" onClick={() => { if (!deleteLoading) setShowDeleteModal(false) }}>
          <div className="dd-modal" onClick={e => e.stopPropagation()}>
            {deleteMsg ? (
              <>
                <div className="dd-modal-title">✅ הבקשה התקבלה</div>
                <div className="dd-modal-body">{deleteMsg}<br/>מעביר אותך להתחברות...</div>
              </>
            ) : (
              <>
                <div className="dd-modal-title">🗑️ מחיקת נתונים</div>
                <div className="dd-modal-body">
                  האם אתה בטוח שברצונך למחוק את כל הנתונים שלך ולעזוב את הפלטפורמה?<br/>
                  <strong style={{color:'#EF4444'}}>פעולה זו בלתי הפיכה.</strong>
                </div>
                <div className="dd-modal-actions">
                  <button className="dd-btn dd-btn-red" onClick={handleDeleteRequest} disabled={deleteLoading}>
                    {deleteLoading ? '⏳ שולח בקשה...' : '✅ כן, מחק את הנתונים שלי'}
                  </button>
                  <button className="dd-btn" style={{background:'rgba(255,255,255,.06)',color:'var(--muted)'}}
                    onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    ← ביטול
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
