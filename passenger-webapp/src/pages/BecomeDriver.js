import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const API = import.meta.env?.VITE_API_URL ?? '';
const CSS = `
.bd *,.bd *::before,.bd *::after{box-sizing:border-box;margin:0;padding:0;}
.bd{
  --bg:#04080D;--bg2:#050D0A;--green:#22C55E;--grn2:#16A34A;--grn3:#86EFAC;
  --greeng:rgba(34,197,94,.22);--greengd:rgba(34,197,94,.07);
  --white:#F1F5F9;--muted:#94A3B8;--card:rgba(255,255,255,.04);
  --cb:rgba(255,255,255,.08);--r:16px;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;overflow-x:hidden;
}
/* ── NAV ─────────────────────────────────────────────────────────────── */
.bd-nav{position:fixed;top:0;left:0;right:0;z-index:300;
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 28px;background:rgba(4,8,13,.8);
  backdrop-filter:blur(20px);border-bottom:1px solid rgba(34,197,94,.08);transition:.3s;}
.bd-nav.sc{padding:10px 28px;background:rgba(4,8,13,.97);}
.bd-logo{font-size:1.1rem;font-weight:800;letter-spacing:-.02em;cursor:pointer;}
.bd-logo .ac{color:var(--green);}
.bd-back{padding:7px 16px;border-radius:9px;border:1px solid rgba(34,197,94,.25);
  color:var(--green);background:transparent;font:.88rem 'Heebo',sans-serif;
  cursor:pointer;text-decoration:none;transition:all .2s;}
.bd-back:hover{background:rgba(34,197,94,.1);}

/* ── HERO ────────────────────────────────────────────────────────────── */
.bd-hero{min-height:100vh;display:flex;align-items:center;justify-content:center;
  position:relative;padding:120px 24px 90px;text-align:center;overflow:hidden;}
.bd-hbg{position:absolute;inset:0;
  background:radial-gradient(ellipse 80% 55% at 50% 10%,rgba(34,197,94,.2) 0%,transparent 60%),
             radial-gradient(ellipse 60% 40% at 85% 90%,rgba(22,163,74,.1) 0%,transparent 50%),
             linear-gradient(180deg,#04080D 0%,#040E07 100%);}
.bd-hgrid{position:absolute;inset:0;
  background-image:linear-gradient(rgba(34,197,94,.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(34,197,94,.025) 1px,transparent 1px);
  background-size:60px 60px;
  -webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);
  mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);}
.bd-hi{position:relative;z-index:1;max-width:780px;margin:0 auto;}
.bd-badge{display:inline-flex;align-items:center;gap:8px;
  background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);
  border-radius:100px;padding:6px 18px;font-size:.78rem;color:var(--green);
  margin-bottom:24px;font-weight:700;letter-spacing:.3px;}
.bd-law-dot{width:7px;height:7px;border-radius:50%;background:var(--green);
  box-shadow:0 0 8px var(--green);animation:bdPulse 2s ease-in-out infinite;}
@keyframes bdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}
.bd-h1{font-size:clamp(2.5rem,6.5vw,5rem);font-weight:900;line-height:1.06;
  letter-spacing:-.03em;margin-bottom:18px;}
.bd-h1 .gr{background:linear-gradient(135deg,#86EFAC 0%,#22C55E 50%,#16A34A 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.bd-hs{font-size:clamp(1rem,2.5vw,1.2rem);color:var(--muted);
  margin-bottom:16px;line-height:1.7;}
.bd-law-note{display:inline-flex;align-items:center;gap:8px;
  background:rgba(253,224,71,.07);border:1px solid rgba(253,224,71,.2);
  border-radius:10px;padding:10px 18px;font-size:.82rem;color:#FDE047;
  margin-bottom:36px;font-weight:600;}
.bd-hbtns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.bd-btn{padding:16px 32px;border-radius:13px;font:700 1rem 'Heebo',sans-serif;
  cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;
  gap:9px;transition:all .25s;border:none;}
.bd-btn.primary{background:linear-gradient(135deg,var(--green),var(--grn2));color:#fff;
  box-shadow:0 4px 24px rgba(34,197,94,.4);}
.bd-btn.primary:hover{transform:translateY(-3px);box-shadow:0 10px 36px rgba(34,197,94,.55);}
.bd-btn.secondary{background:rgba(34,197,94,.09);border:1px solid rgba(34,197,94,.25);
  color:var(--green);}
.bd-btn.secondary:hover{background:rgba(34,197,94,.16);transform:translateY(-2px);}
.bd-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;}

/* ── NUMBERS ─────────────────────────────────────────────────────────── */
.bd-stats{background:linear-gradient(135deg,#050E07 0%,#030A05 100%);
  border-top:1px solid rgba(34,197,94,.1);border-bottom:1px solid rgba(34,197,94,.1);
  padding:52px 24px;}
.bd-stats-row{max-width:900px;margin:0 auto;
  display:grid;grid-template-columns:repeat(4,1fr);gap:28px;text-align:center;}
.bd-stat{padding:20px 12px;}
.bd-stat-n{font-size:2.4rem;font-weight:900;color:var(--green);line-height:1;}
.bd-stat-l{font-size:.78rem;color:var(--muted);margin-top:5px;line-height:1.4;}

/* ── SECTION ────────────────────────────────────────────────────────── */
.bd-section{padding:72px 24px;max-width:1060px;margin:0 auto;}
.bd-eyebrow{font-size:.7rem;text-transform:uppercase;letter-spacing:3px;
  color:var(--green);text-align:center;margin-bottom:10px;font-weight:700;}
.bd-t2{font-size:clamp(1.8rem,4vw,2.7rem);font-weight:800;
  text-align:center;margin-bottom:12px;line-height:1.15;}
.bd-sub{text-align:center;color:var(--muted);font-size:.97rem;
  max-width:520px;margin:0 auto 48px;line-height:1.7;}

/* ── HOW IT WORKS ────────────────────────────────────────────────────── */
.bd-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:48px;}
.bd-step-card{background:var(--card);border:1px solid var(--cb);
  border-radius:20px;padding:28px 22px;position:relative;overflow:hidden;}
.bd-step-card::before{content:'';position:absolute;top:0;left:0;right:0;
  height:3px;background:linear-gradient(90deg,var(--green),var(--grn2));}
.bd-step-num{font-size:2.5rem;font-weight:900;color:rgba(34,197,94,.15);
  margin-bottom:10px;line-height:1;}
.bd-step-ico{font-size:1.8rem;margin-bottom:12px;}
.bd-step-title{font-size:1rem;font-weight:800;margin-bottom:6px;}
.bd-step-desc{font-size:.82rem;color:var(--muted);line-height:1.65;}

/* ── REQUIREMENTS ────────────────────────────────────────────────────── */
.bd-reqs{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.bd-req{background:var(--card);border:1px solid var(--cb);
  border-radius:14px;padding:18px 16px;display:flex;gap:14px;align-items:flex-start;}
.bd-req.critical{border-color:rgba(239,68,68,.22);background:rgba(239,68,68,.04);}
.bd-req-ico{font-size:1.6rem;flex-shrink:0;margin-top:2px;}
.bd-req-body h4{font-size:.9rem;font-weight:700;margin-bottom:4px;}
.bd-req-body p{font-size:.78rem;color:var(--muted);line-height:1.55;}
.bd-req-crit{display:inline-block;margin-top:5px;padding:2px 8px;
  border-radius:5px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.2);
  font-size:.7rem;color:#F87171;font-weight:700;}

/* ── TIMELINE ────────────────────────────────────────────────────────── */
.bd-timeline{max-width:560px;margin:0 auto;position:relative;padding-right:30px;}
.bd-timeline::before{content:'';position:absolute;right:12px;top:0;bottom:0;
  width:2px;background:linear-gradient(180deg,var(--green) 0%,rgba(34,197,94,.15) 100%);}
.bd-tl-item{margin-bottom:28px;position:relative;}
.bd-tl-dot{position:absolute;right:-24px;top:4px;width:14px;height:14px;
  border-radius:50%;background:var(--green);
  box-shadow:0 0 12px rgba(34,197,94,.5);border:2px solid var(--bg);}
.bd-tl-item.future .bd-tl-dot{background:rgba(34,197,94,.25);box-shadow:none;
  border:2px solid rgba(34,197,94,.35);}
.bd-tl-year{font-size:.72rem;color:var(--green);font-weight:700;
  letter-spacing:.5px;margin-bottom:4px;}
.bd-tl-text{font-size:.88rem;line-height:1.6;color:var(--muted);}
.bd-tl-text strong{color:var(--white);}

/* ── APPLICATION FORM ─────────────────────────────────────────────────── */
.bd-form-section{background:linear-gradient(135deg,#050E07 0%,#030A05 100%);
  border-top:1px solid rgba(34,197,94,.1);padding:80px 24px;}
.bd-form-wrap{max-width:600px;margin:0 auto;}
.bd-form-card{background:var(--card);border:1px solid var(--cb);
  border-radius:24px;padding:36px;position:relative;overflow:hidden;}
.bd-form-card::before{content:'';position:absolute;top:0;left:0;right:0;
  height:4px;background:linear-gradient(90deg,var(--green),var(--grn2));}
.bd-form-title{font-size:1.5rem;font-weight:900;margin-bottom:6px;}
.bd-form-sub{color:var(--muted);font-size:.88rem;line-height:1.65;margin-bottom:28px;}
.bd-frow{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.bd-frow.full{grid-template-columns:1fr;}
.bd-fg{display:flex;flex-direction:column;gap:7px;}
.bd-lbl{font-size:.76rem;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.5px;}
.bd-inp{width:100%;background:rgba(255,255,255,.05);
  border:1.5px solid rgba(255,255,255,.1);border-radius:11px;
  color:var(--white);font:600 .95rem 'Heebo',sans-serif;
  padding:11px 14px;outline:none;transition:all .2s;}
.bd-inp::placeholder{color:rgba(148,163,184,.4);font-weight:400;}
.bd-inp:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(34,197,94,.14);}
.bd-inp.sel{appearance:none;cursor:pointer;}
.bd-checkbox-wrap{display:flex;align-items:center;gap:10px;
  padding:12px 14px;background:rgba(255,255,255,.03);
  border:1.5px solid rgba(255,255,255,.1);border-radius:11px;cursor:pointer;transition:.2s;}
.bd-checkbox-wrap:hover{border-color:rgba(34,197,94,.25);}
.bd-checkbox-wrap input{width:18px;height:18px;accent-color:var(--green);cursor:pointer;}
.bd-checkbox-wrap span{font-size:.9rem;font-weight:600;}
.bd-infobox{background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.18);
  border-radius:11px;padding:12px 15px;font-size:.82rem;color:var(--muted);
  line-height:1.65;margin-bottom:18px;}
.bd-infobox.warn{background:rgba(253,224,71,.06);border-color:rgba(253,224,71,.18);color:#FDE047;}
.bd-submit{width:100%;padding:16px;border-radius:13px;margin-top:8px;
  background:linear-gradient(135deg,var(--green),var(--grn2));color:#fff;border:none;
  font:700 1.05rem 'Heebo',sans-serif;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:10px;
  box-shadow:0 4px 20px rgba(34,197,94,.35);transition:all .25s;}
.bd-submit:hover:not(:disabled){transform:translateY(-2px);
  box-shadow:0 8px 28px rgba(34,197,94,.5);}
.bd-submit:disabled{opacity:.55;cursor:not-allowed;}
.bd-spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff;border-radius:50%;animation:bdSpin .7s linear infinite;}
@keyframes bdSpin{to{transform:rotate(360deg)}}
.bd-success-banner{text-align:center;padding:36px 24px;
  background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
  border-radius:20px;}
.bd-success-ico{font-size:3.5rem;margin-bottom:14px;}
.bd-success-title{font-size:1.5rem;font-weight:900;margin-bottom:8px;}
.bd-success-desc{color:var(--muted);font-size:.9rem;line-height:1.7;}
.bd-status-pill{display:inline-flex;align-items:center;gap:8px;
  padding:8px 18px;border-radius:100px;font-size:.82rem;font-weight:700;margin:14px 0;}
.bd-status-pill.submitted{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);color:#60A5FA;}
.bd-status-pill.approved{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:var(--green);}
.bd-status-pill.rejected{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#F87171;}
.bd-status-pill.pending_admin{background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.25);color:#FB923C;}

/* ── RESPONSIVE ──────────────────────────────────────────────────────── */
@media(max-width:680px){
  .bd-stats-row{grid-template-columns:repeat(2,1fr);}
  .bd-steps{grid-template-columns:1fr;}
  .bd-reqs{grid-template-columns:1fr;}
  .bd-frow{grid-template-columns:1fr;}
}
`;
const STATS = [
    { n: '₪9,500', l: 'הכנסה ממוצעת\nלחודש' },
    { n: '2.4M', l: 'נסיעות שיתופיות\nצפויות/שנה' },
    { n: '21+', l: 'גיל מינימום\nלנהיגה' },
    { n: '100%', l: 'חופש לבחור\nמתי לעבוד' },
];
const STEPS = [
    {
        num: '01', ico: '📝', title: 'הגש בקשה עכשיו',
        desc: 'מלא טופס קצר עם פרטי הרכב וניסיון הנהיגה שלך. לוקח 2 דקות.'
    },
    {
        num: '02', ico: '🪪', title: 'אימות זהות ומסמכים',
        desc: 'אימות רישיון + סלפי דרך Sumsub, ואז העלאת מסמכי רכב דרך WhatsApp.'
    },
    {
        num: '03', ico: '🚗', title: 'נהג! ברגע שהחוק עובר',
        desc: 'אחרי אישור הצוות — תתחיל לקבל נסיעות ברגע שחוק שיתוף הנסיעות ייכנס לתוקף.'
    },
];
const REQUIREMENTS = [
    {
        ico: '🪪', title: 'רישיון נהיגה ב\'', critical: false,
        desc: 'רישיון ישראלי תקף, לפחות 2 שנים ניסיון נהיגה, גיל 21 ומעלה.'
    },
    {
        ico: '🛡️', title: 'ביטוח נסיעות שיתופיות', critical: true,
        desc: 'חובה! ביטוח רכב המכסה נסיעה בתשלום (Rideshare/Commercial). ביטוח רגיל אינו מספיק.'
    },
    {
        ico: '📋', title: 'אישור יושרה (אישור משטרה)', critical: false,
        desc: 'אישור ממשרד הפנים/משטרה שאינו ישן יותר מ-3 שנים.'
    },
    {
        ico: '📄', title: 'רישיון רכב', critical: false,
        desc: 'רישיון רכב בתוקף ועדכני.'
    },
    {
        ico: '🪪', title: 'תעודת זהות ישראלית', critical: false,
        desc: 'תעודת זהות ישראלית בתוקף.'
    },
    {
        ico: '📸', title: 'סלפי לאימות זהות', critical: false,
        desc: 'צילום עצמי מזהה דרך מערכת Sumsub — מהיר ואוטומטי.'
    },
];
const TIMELINE = [
    { year: '2024', future: false, text: _jsxs(_Fragment, { children: [_jsx("strong", { children: "\u05D4\u05E6\u05E2\u05EA \u05D7\u05D5\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E3 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA" }), " \u05D4\u05D5\u05D2\u05E9\u05D4 \u05DC\u05DB\u05E0\u05E1\u05EA \u05D5\u05E2\u05D1\u05E8\u05D4 \u05E7\u05E8\u05D9\u05D0\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4."] }) },
    { year: '2025', future: false, text: _jsxs(_Fragment, { children: [_jsx("strong", { children: "\u05D4\u05D5\u05D5\u05E2\u05D3\u05D4 \u05D4\u05DB\u05DC\u05DB\u05DC\u05D9\u05EA" }), " \u05D0\u05D9\u05E9\u05E8\u05D4 \u05E2\u05E7\u05E8\u05D5\u05E0\u05D5\u05EA \u05D4\u05E6\u05E2\u05EA \u05D4\u05D7\u05D5\u05E7 \u05D1\u05E0\u05D5\u05D2\u05E2 \u05DC\u05D3\u05E8\u05D9\u05E9\u05D5\u05EA \u05D4\u05E0\u05D4\u05D2\u05D9\u05DD."] }) },
    { year: 'ספטמבר 2025', future: false, text: _jsxs(_Fragment, { children: ["\u05D4\u05E6\u05E2\u05EA \u05D4\u05D7\u05D5\u05E7 \u05E2\u05D1\u05E8\u05D4 ", _jsx("strong", { children: "\u05E7\u05E8\u05D9\u05D0\u05D4 \u05E9\u05E0\u05D9\u05D9\u05D4" }), " \u05D5\u05E0\u05DE\u05E6\u05D0\u05EA \u05DC\u05E4\u05E0\u05D9 \u05D4\u05E6\u05D1\u05E2\u05D4 \u05E1\u05D5\u05E4\u05D9\u05EA."] }) },
    { year: 'ציפייה: 2026', future: true, text: _jsxs(_Fragment, { children: [_jsx("strong", { children: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05EA\u05D5\u05E7\u05E3" }), " \u2014 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9\u05D5\u05EA \u05D9\u05D4\u05D9\u05D5 \u05D7\u05D5\u05E7\u05D9\u05D5\u05EA! \u05E0\u05D4\u05D2\u05D9\u05DD \u05DE\u05D0\u05D5\u05E9\u05E8\u05D9\u05DD \u05D9\u05EA\u05D7\u05D9\u05DC\u05D5 \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA."] }) },
];
// ── Main component ──────────────────────────────────────────────────────────
export default function BecomeDriver() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [existingApp, setExistingApp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        has_vehicle: false,
        vehicle_number: '',
        vehicle_make: '',
        vehicle_model: '',
        vehicle_year: '',
        years_driving: '',
        motivation: '',
    });
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    useEffect(() => {
        fetchStatus();
    }, []);
    async function fetchStatus() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                setLoading(false);
                return;
            }
            const res = await fetch(`${API}/passenger/become-driver/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.has_application)
                    setExistingApp(data.application);
            }
        }
        catch { /* silent */ }
        finally {
            setLoading(false);
        }
    }
    function setField(name, value) {
        setForm(f => ({ ...f, [name]: value }));
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem('access_token');
            const body = {
                has_vehicle: form.has_vehicle,
                vehicle_number: form.vehicle_number || null,
                vehicle_make: form.vehicle_make || null,
                vehicle_model: form.vehicle_model || null,
                vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year) : null,
                years_driving: form.years_driving ? parseInt(form.years_driving) : null,
                motivation: form.motivation || null,
            };
            const res = await fetch(`${API}/passenger/become-driver`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                setExistingApp(data.application);
            }
            else {
                alert(data.detail || 'שגיאה בשליחת הבקשה');
            }
        }
        catch {
            alert('שגיאת רשת. נסה שוב.');
        }
        finally {
            setSubmitting(false);
        }
    }
    const pillClass = (s) => {
        if (s === 'approved')
            return 'approved';
        if (s === 'rejected')
            return 'rejected';
        if (s === 'pending_admin' || s === 'ai_review')
            return 'pending_admin';
        return 'submitted';
    };
    return (_jsxs("div", { className: "bd", children: [_jsx("style", { children: CSS }), _jsxs("nav", { className: `bd-nav${scrolled ? ' sc' : ''}`, children: [_jsxs("div", { className: "bd-logo", onClick: () => navigate('/'), children: ["Easy", _jsx("span", { className: "ac", children: "Taxi" })] }), _jsx("a", { href: "#apply", className: "bd-back", children: "\uD83D\uDE97 \u05D4\u05E6\u05D8\u05E8\u05E3 \u05E2\u05DB\u05E9\u05D9\u05D5" })] }), _jsxs("section", { className: "bd-hero", children: [_jsx("div", { className: "bd-hbg" }), _jsx("div", { className: "bd-hgrid" }), _jsxs("div", { className: "bd-hi", children: [_jsxs("div", { className: "bd-badge", children: [_jsx("div", { className: "bd-law-dot" }), "\u05D7\u05D5\u05E7 \u05D4\u05D5\u05D1\u05E8 \u2014 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9\u05D5\u05EA \u05D1\u05D9\u05E9\u05E8\u05D0\u05DC \uD83C\uDDEE\uD83C\uDDF1"] }), _jsxs("h1", { className: "bd-h1", children: [_jsx("span", { className: "gr", children: "\u05E0\u05D4\u05D2 \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9" }), _jsx("br", {}), "\u05E2\u05DD EasyTaxi"] }), _jsxs("p", { className: "bd-hs", children: ["\u05D4\u05E6\u05D8\u05E8\u05E3 \u05DC\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D4\u05D2\u05D3\u05D5\u05DC\u05D4 \u05D1\u05D9\u05D5\u05EA\u05E8 \u05E9\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9\u05D5\u05EA \u05D1\u05D9\u05E9\u05E8\u05D0\u05DC.", _jsx("br", {}), "\u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05E2\u05DB\u05E9\u05D9\u05D5 \u2014 \u05D5\u05D4\u05EA\u05D7\u05DC \u05DC\u05E0\u05D4\u05D5\u05D2 \u05D1\u05E8\u05D2\u05E2 \u05E9\u05D4\u05D7\u05D5\u05E7 \u05D9\u05D0\u05D5\u05E9\u05E8."] }), _jsx("div", { className: "bd-law-note", children: "\u2696\uFE0F \u05D7\u05D5\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E3 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u2014 \u05D1\u05EA\u05D4\u05DC\u05D9\u05DA \u05D7\u05E7\u05D9\u05E7\u05D4 \u05E1\u05D5\u05E4\u05D9 | \u05D4\u05D9\u05E8\u05E9\u05DD \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D5\u05E7\u05D1\u05DC \u05E2\u05D3\u05D9\u05E4\u05D5\u05EA \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4" }), _jsxs("div", { className: "bd-hbtns", children: [_jsx("a", { href: "#apply", className: "bd-btn primary", children: "\u05D4\u05E6\u05D8\u05E8\u05E3 \u05DB\u05E0\u05D4\u05D2 \u2190 " }), _jsx("a", { href: "#requirements", className: "bd-btn secondary", children: "\uD83D\uDCCB \u05D3\u05E8\u05D9\u05E9\u05D5\u05EA \u05D4\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF" })] })] })] }), _jsx("section", { className: "bd-stats", children: _jsx("div", { className: "bd-stats-row", children: STATS.map(s => (_jsxs("div", { className: "bd-stat", children: [_jsx("div", { className: "bd-stat-n", children: s.n }), _jsx("div", { className: "bd-stat-l", style: { whiteSpace: 'pre-line' }, children: s.l })] }, s.n))) }) }), _jsxs("section", { className: "bd-section", children: [_jsx("p", { className: "bd-eyebrow", children: "\u05D0\u05D9\u05DA \u05D6\u05D4 \u05E2\u05D5\u05D1\u05D3?" }), _jsx("h2", { className: "bd-t2", children: "3 \u05E9\u05DC\u05D1\u05D9\u05DD \u05E4\u05E9\u05D5\u05D8\u05D9\u05DD" }), _jsx("p", { className: "bd-sub", children: "\u05DE\u05D2\u05D9\u05E9\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4 \u05D5\u05E2\u05D3 \u05E0\u05D4\u05D9\u05D2\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u2014 \u05DB\u05DC \u05D4\u05EA\u05D4\u05DC\u05D9\u05DA \u05D3\u05E8\u05DA \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D5-WhatsApp." }), _jsx("div", { className: "bd-steps", children: STEPS.map(s => (_jsxs("div", { className: "bd-step-card", children: [_jsx("div", { className: "bd-step-num", children: s.num }), _jsx("div", { className: "bd-step-ico", children: s.ico }), _jsx("h3", { className: "bd-step-title", children: s.title }), _jsx("p", { className: "bd-step-desc", children: s.desc })] }, s.num))) })] }), _jsx("div", { style: { background: 'rgba(255,255,255,.02)', borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)' }, children: _jsxs("section", { id: "requirements", className: "bd-section", children: [_jsx("p", { className: "bd-eyebrow", children: "\u05D3\u05E8\u05D9\u05E9\u05D5\u05EA" }), _jsx("h2", { className: "bd-t2", children: "\u05DE\u05D4 \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA \u05E0\u05D4\u05D2 \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9?" }), _jsx("p", { className: "bd-sub", children: "\u05DC\u05E4\u05D9 \u05D7\u05D5\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E3 \u05D4\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05D4\u05D9\u05E9\u05E8\u05D0\u05DC\u05D9 (\u05D8\u05D9\u05D5\u05D8\u05EA \u05D7\u05D5\u05E7 \u05D4\u05D5\u05D1\u05E8) \u2014 \u05D0\u05DC\u05D5 \u05D4\u05D3\u05E8\u05D9\u05E9\u05D5\u05EA \u05D4\u05DE\u05DC\u05D0\u05D5\u05EA:" }), _jsx("div", { className: "bd-reqs", children: REQUIREMENTS.map(r => (_jsxs("div", { className: `bd-req${r.critical ? ' critical' : ''}`, children: [_jsx("div", { className: "bd-req-ico", children: r.ico }), _jsxs("div", { className: "bd-req-body", children: [_jsx("h4", { children: r.title }), _jsx("p", { children: r.desc }), r.critical && _jsx("span", { className: "bd-req-crit", children: "\u26A0\uFE0F \u05E7\u05E8\u05D9\u05D8\u05D9 \u2014 \u05E0\u05D3\u05E8\u05E9 \u05E1\u05E4\u05E6\u05D9\u05E4\u05D9\u05EA \u05DC\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05D1\u05EA\u05E9\u05DC\u05D5\u05DD" })] })] }, r.title))) })] }) }), _jsxs("section", { className: "bd-section", children: [_jsx("p", { className: "bd-eyebrow", children: "\u05E6\u05D9\u05E8 \u05D6\u05DE\u05DF \u05D7\u05E7\u05D9\u05E7\u05D4" }), _jsx("h2", { className: "bd-t2", children: "\u05DE\u05D4 \u05E7\u05D5\u05E8\u05D4 \u05E2\u05DD \u05D4\u05D7\u05D5\u05E7?" }), _jsx("p", { className: "bd-sub", children: "\u05DE\u05E6\u05D1 \u05D4\u05D7\u05E7\u05D9\u05E7\u05D4 \u05E2\u05D3\u05DB\u05E0\u05D9 \u2014 \u05D4\u05DB\u05E0\u05E1 \u05DC\u05EA\u05D4\u05DC\u05D9\u05DA \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D5\u05EA\u05D4\u05D9\u05D4 \u05DE\u05D5\u05DB\u05DF \u05DC\u05D4\u05E8\u05D5\u05D5\u05D9\u05D7 \u05DE\u05D4\u05D9\u05D5\u05DD \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF." }), _jsx("div", { className: "bd-timeline", children: TIMELINE.map((t, i) => (_jsxs("div", { className: `bd-tl-item${t.future ? ' future' : ''}`, children: [_jsx("div", { className: "bd-tl-dot" }), _jsx("div", { className: "bd-tl-year", children: t.year }), _jsx("div", { className: "bd-tl-text", children: t.text })] }, i))) })] }), _jsx("div", { id: "apply", className: "bd-form-section", children: _jsxs("div", { className: "bd-form-wrap", children: [_jsx("p", { className: "bd-eyebrow", children: "\u05D4\u05D2\u05E9 \u05D1\u05E7\u05E9\u05D4" }), _jsx("h2", { className: "bd-t2", style: { textAlign: 'center', marginBottom: 36 }, children: existingApp ? 'סטטוס הבקשה שלך' : 'הצטרף כנהג שיתופי' }), loading ? (_jsx("div", { style: { textAlign: 'center', padding: 40 }, children: _jsx("div", { className: "bd-spinner", style: { margin: '0 auto' } }) })) : existingApp ? (
                        /* ── EXISTING APPLICATION STATUS ── */
                        _jsxs("div", { className: "bd-form-card", children: [_jsxs("div", { className: "bd-success-banner", children: [_jsx("div", { className: "bd-success-ico", children: existingApp.status === 'approved' ? '🎉' :
                                                existingApp.status === 'rejected' ? '😔' : '⏳' }), _jsx("div", { className: "bd-success-title", children: existingApp.status_label }), _jsx("div", { className: `bd-status-pill ${pillClass(existingApp.status)}`, style: { margin: '12px auto', display: 'inline-flex' }, children: existingApp.status_label }), _jsx("div", { className: "bd-success-desc", children: existingApp.next_step }), existingApp.rejection_reason && (_jsxs("div", { style: { marginTop: 16, padding: '12px 16px', borderRadius: 10,
                                                background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)',
                                                color: '#F87171', fontSize: '.82rem' }, children: ["\u05E1\u05D9\u05D1\u05EA \u05D3\u05D7\u05D9\u05D9\u05D4: ", existingApp.rejection_reason] }))] }), _jsx("div", { style: { marginTop: 28 }, children: [
                                        { key: 'submitted', label: 'בקשה הוגשה', ico: '📬' },
                                        { key: 'sumsub_pending', label: 'אימות זהות', ico: '🪪' },
                                        { key: 'docs_required', label: 'מסמכי רכב', ico: '📋' },
                                        { key: 'ai_review', label: 'בדיקת AI', ico: '🤖' },
                                        { key: 'pending_admin', label: 'אישור אנושי', ico: '👤' },
                                        { key: 'approved', label: 'מאושר לנהיגה', ico: '✅' },
                                    ].map((s, i, arr) => {
                                        const statuses = arr.map(x => x.key);
                                        const curIdx = statuses.indexOf(existingApp.status);
                                        const stepIdx = i;
                                        const isDone = stepIdx <= curIdx;
                                        const isActive = stepIdx === curIdx && existingApp.status !== 'approved';
                                        return (_jsxs("div", { style: {
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '11px 14px', borderRadius: 11, marginBottom: 8,
                                                background: isDone ? 'rgba(34,197,94,.07)' : 'rgba(255,255,255,.03)',
                                                border: `1px solid ${isDone ? 'rgba(34,197,94,.22)' : 'rgba(255,255,255,.07)'}`,
                                                opacity: isDone ? 1 : 0.5,
                                            }, children: [_jsx("span", { style: { fontSize: '1.2rem' }, children: isDone ? (isActive ? s.ico : '✅') : s.ico }), _jsx("span", { style: {
                                                        fontSize: '.88rem', fontWeight: isActive ? 800 : 600,
                                                        color: isDone ? 'var(--white)' : 'var(--muted)',
                                                    }, children: s.label }), isActive && (_jsx("span", { style: { marginRight: 'auto', fontSize: '.72rem',
                                                        color: 'var(--green)', fontWeight: 700 }, children: "\u25B6 \u05DB\u05D0\u05DF \u05E2\u05DB\u05E9\u05D9\u05D5" }))] }, s.key));
                                    }) }), existingApp.status === 'docs_required' && (_jsx("div", { className: "bd-infobox", style: { marginTop: 20 }, children: "\uD83D\uDCF1 \u05D1\u05D3\u05D5\u05E7/\u05D9 \u05D0\u05EA WhatsApp \u2014 \u05E9\u05DC\u05D7\u05E0\u05D5 \u05D4\u05D5\u05E8\u05D0\u05D5\u05EA \u05DC\u05D4\u05E2\u05DC\u05D0\u05EA \u05DE\u05E1\u05DE\u05DB\u05D9 \u05D4\u05E8\u05DB\u05D1 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05E6'\u05D0\u05D8!" })), existingApp.status !== 'approved' && existingApp.status !== 'rejected' && (_jsx("div", { style: { textAlign: 'center', marginTop: 20 }, children: _jsx("button", { className: "bd-btn secondary", onClick: fetchStatus, style: { margin: '0 auto' }, children: "\uD83D\uDD04 \u05E8\u05E2\u05E0\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1" }) }))] })) : (
                        /* ── APPLICATION FORM ── */
                        _jsxs("div", { className: "bd-form-card", children: [_jsx("div", { className: "bd-form-title", children: "\uD83D\uDE97 \u05D8\u05D5\u05E4\u05E1 \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA \u05DC\u05E0\u05D4\u05D2\u05D9\u05DD" }), _jsxs("div", { className: "bd-form-sub", children: ["\u05DE\u05DC\u05D0 \u05D0\u05EA \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u2014 \u05D0\u05E0\u05D5 \u05E0\u05D1\u05D3\u05D5\u05E7 \u05D5\u05E0\u05E9\u05D9\u05D1 \u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA.", _jsx("br", {}), "\u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05E0\u05E2\u05E9\u05D4 \u05D3\u05E8\u05DA WhatsApp \u2014 \u05E0\u05D5\u05D7 \u05D5\u05DE\u05D4\u05D9\u05E8."] }), _jsxs("div", { className: "bd-infobox warn", children: ["\u2696\uFE0F ", _jsx("strong", { children: "\u05E9\u05D9\u05DD \u05DC\u05D1:" }), " \u05D7\u05D5\u05E7 \u05D4\u05D5\u05D1\u05E8 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05EA\u05D4\u05DC\u05D9\u05DA \u05D7\u05E7\u05D9\u05E7\u05D4. \u05D1\u05E8\u05D2\u05E2 \u05E9\u05D9\u05D0\u05D5\u05E9\u05E8 \u2014 \u05E0\u05D4\u05D2\u05D9\u05DD \u05E9\u05D4\u05E9\u05DC\u05D9\u05DE\u05D5 \u05D0\u05EA \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05D9\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05DE\u05D9\u05D3."] }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "bd-frow", children: [_jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05E9\u05E0\u05D5\u05EA \u05E0\u05D9\u05E1\u05D9\u05D5\u05DF \u05D1\u05E0\u05D4\u05D9\u05D2\u05D4" }), _jsx("input", { className: "bd-inp", type: "number", min: "0", max: "50", placeholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: 5", value: form.years_driving, onChange: e => setField('years_driving', e.target.value) })] }), _jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05D4\u05D0\u05DD \u05D9\u05E9 \u05DC\u05DA \u05E8\u05DB\u05D1 \u05DB\u05D1\u05E8?" }), _jsxs("label", { className: "bd-checkbox-wrap", children: [_jsx("input", { type: "checkbox", checked: form.has_vehicle, onChange: e => setField('has_vehicle', e.target.checked) }), _jsx("span", { children: "\u05DB\u05DF, \u05D9\u05E9 \u05DC\u05D9 \u05E8\u05DB\u05D1" })] })] })] }), form.has_vehicle && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bd-frow", children: [_jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05DE\u05E1\u05E4\u05E8 \u05DC\u05D5\u05D7\u05D9\u05EA \u05E8\u05D9\u05E9\u05D5\u05D9" }), _jsx("input", { className: "bd-inp", placeholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: 12-345-67", value: form.vehicle_number, onChange: e => setField('vehicle_number', e.target.value) })] }), _jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05E9\u05E0\u05EA \u05D9\u05D9\u05E6\u05D5\u05E8" }), _jsx("input", { className: "bd-inp", type: "number", min: "2010", max: "2027", placeholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: 2022", value: form.vehicle_year, onChange: e => setField('vehicle_year', e.target.value) })] })] }), _jsxs("div", { className: "bd-frow", children: [_jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05D9\u05E6\u05E8\u05DF" }), _jsx("input", { className: "bd-inp", placeholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: Toyota", value: form.vehicle_make, onChange: e => setField('vehicle_make', e.target.value) })] }), _jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05D3\u05D2\u05DD" }), _jsx("input", { className: "bd-inp", placeholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: Corolla", value: form.vehicle_model, onChange: e => setField('vehicle_model', e.target.value) })] })] })] })), _jsx("div", { className: "bd-frow full", children: _jsxs("div", { className: "bd-fg", children: [_jsx("label", { className: "bd-lbl", children: "\u05DE\u05D3\u05D5\u05E2 \u05D0\u05EA\u05D4 \u05E8\u05D5\u05E6\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \u05E0\u05D4\u05D2 \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9? (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)" }), _jsx("textarea", { className: "bd-inp", rows: 3, placeholder: "\u05E1\u05E4\u05E8 \u05DC\u05E0\u05D5 \u05E7\u05E6\u05EA...", value: form.motivation, onChange: e => setField('motivation', e.target.value), style: { resize: 'vertical' } })] }) }), _jsxs("div", { className: "bd-infobox", children: ["\uD83D\uDCCB ", _jsx("strong", { children: "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E9\u05D9\u05D9\u05D3\u05E8\u05E9\u05D5 (\u05D3\u05E8\u05DA WhatsApp \u05DC\u05D0\u05D7\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8):" }), _jsx("br", {}), "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05D4\u05D9\u05D2\u05D4 \u2022 \u05D1\u05D9\u05D8\u05D5\u05D7 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9\u05D5\u05EA \u2022 \u05D0\u05D9\u05E9\u05D5\u05E8 \u05D9\u05D5\u05E9\u05E8\u05D4 \u2022 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E8\u05DB\u05D1"] }), _jsx("button", { type: "submit", className: "bd-submit", disabled: submitting, children: submitting
                                                ? _jsxs(_Fragment, { children: [_jsx("div", { className: "bd-spinner" }), " \u05E9\u05D5\u05DC\u05D7 \u05D1\u05E7\u05E9\u05D4..."] })
                                                : _jsx(_Fragment, { children: "\uD83D\uDCEC \u05E9\u05DC\u05D7 \u05D1\u05E7\u05E9\u05D4 \u05DC\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA" }) })] })] }))] }) }), _jsxs("div", { style: {
                    textAlign: 'center', padding: '28px 24px',
                    borderTop: '1px solid rgba(255,255,255,.05)',
                    color: 'rgba(148,163,184,.5)', fontSize: '.78rem', lineHeight: 1.7,
                }, children: ["\u2696\uFE0F \u05D4\u05DE\u05D9\u05D3\u05E2 \u05DE\u05D1\u05D5\u05E1\u05E1 \u05E2\u05DC \u05D4\u05E6\u05E2\u05EA \u05D7\u05D5\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E3 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA, \u05EA\u05E9\u05E4\"\u05D3-2024.", _jsx("br", {}), "EasyTaxi \u05D0\u05D9\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D0\u05D9\u05EA \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05D1\u05D7\u05E7\u05D9\u05E7\u05D4. \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9\u05D5\u05EA \u05D9\u05D7\u05DC\u05D5 \u05E8\u05E7 \u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D7\u05D5\u05E7 \u05D4\u05E8\u05E9\u05DE\u05D9."] })] }));
}
