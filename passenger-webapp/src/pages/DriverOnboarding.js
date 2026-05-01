import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
const CSS = `
.do,.do *,.do *::before,.do *::after{box-sizing:border-box;margin:0;padding:0;}
.do{
  --bg:#070B14;--bg2:#0D1526;--blue:#2563EB;--blue2:#1D4ED8;
  --bluel:#60A5FA;--white:#F1F5F9;--muted:#94A3B8;
  --card:rgba(255,255,255,.04);--cb:rgba(255,255,255,.09);
  --green:#22C55E;--red:#EF4444;--gold:#FDE047;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;overflow-x:hidden;
}
.do-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(37,99,235,.14) 0%,transparent 60%),linear-gradient(180deg,#070B14 0%,#0C1322 100%);}
/* Header */
.do-hdr{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;padding:14px 24px;background:rgba(7,11,20,.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07);}
.do-back{padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--muted);font:.9rem 'Heebo',sans-serif;cursor:pointer;transition:all .2s;}
.do-back:hover{color:var(--bluel);border-color:rgba(96,165,250,.3);}
.do-hdrt{font-weight:800;font-size:1rem;}
.do-hdrs{font-size:.75rem;color:var(--muted);}
/* Main */
.do-main{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:32px 20px 80px;}
/* Stepper */
.do-stepper{display:flex;gap:0;margin-bottom:36px;}
.do-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;}
.do-step-line{position:absolute;top:18px;right:-50%;width:100%;height:2px;background:rgba(255,255,255,.1);transition:background .3s;}
.do-step-line.done{background:var(--blue);}
.do-step-circle{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:800;z-index:1;position:relative;transition:all .3s;}
.do-step-circle.active{background:var(--blue);color:#fff;box-shadow:0 0 16px rgba(37,99,235,.45);}
.do-step-circle.done{background:rgba(37,99,235,.25);color:var(--bluel);border:2px solid rgba(37,99,235,.4);}
.do-step-circle.idle{background:rgba(255,255,255,.06);color:var(--muted);border:2px solid rgba(255,255,255,.1);}
.do-step-label{font-size:.65rem;margin-top:.4rem;color:var(--muted);text-align:center;font-weight:600;transition:color .3s;}
.do-step-label.active{color:var(--bluel);}
/* Card */
.do-card{background:var(--card);border:1px solid var(--cb);border-radius:20px;padding:28px;animation:doIn .4s ease both;}
@keyframes doIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.do-card-title{font-size:1.3rem;font-weight:900;margin-bottom:6px;}
.do-card-sub{color:var(--muted);font-size:.9rem;line-height:1.65;margin-bottom:24px;}
/* Label + input */
.do-lbl{display:block;font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px;}
.do-inp{width:100%;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.1);border-radius:12px;color:var(--white);font:600 1rem 'Heebo',sans-serif;padding:12px 16px;outline:none;transition:border-color .2s,box-shadow .2s;}
.do-inp::placeholder{color:rgba(148,163,184,.45);font-weight:400;}
.do-inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.18);}
.do-fgroup{margin-bottom:16px;}
/* Infobox */
.do-infobox{padding:14px 16px;border-radius:12px;background:rgba(37,99,235,.09);border:1px solid rgba(96,165,250,.15);font-size:.83rem;color:var(--muted);line-height:1.65;margin-top:14px;}
.do-infobox.warn{background:rgba(253,224,71,.07);border-color:rgba(253,224,71,.18);color:var(--gold);}
/* Doc grid */
.do-docgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:18px;}
.do-doc{padding:16px 12px;border-radius:14px;cursor:pointer;text-align:center;transition:all .2s;border:2px solid;}
.do-doc.idle{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.09);}
.do-doc.idle:hover{background:rgba(37,99,235,.07);border-color:rgba(96,165,250,.3);}
.do-doc.uploading{background:rgba(96,165,250,.06);border-color:rgba(96,165,250,.25);}
.do-doc.scanning{background:rgba(253,224,71,.06);border-color:rgba(253,224,71,.3);}
.do-doc.verified{background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.3);cursor:default;}
.do-doc.failed{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.3);}
.do-doc-ico{font-size:1.9rem;margin-bottom:8px;}
.do-doc-name{font-size:.82rem;font-weight:700;margin-bottom:3px;}
.do-doc-name.verified{color:var(--green);}
.do-doc-name.failed{color:var(--red);}
.do-doc-hint{font-size:.7rem;color:var(--muted);}
/* Scan progress */
.do-scanbar{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--gold) 0%,#FFE44D 50%,var(--gold) 100%);background-size:200% 100%;animation:doScan 1.5s ease-in-out infinite;margin-top:8px;}
@keyframes doScan{from{background-position:-200% 0}to{background-position:200% 0}}
/* Progress bar */
.do-progress-wrap{margin-bottom:20px;}
.do-progress-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;}
.do-progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--blue),var(--bluel));transition:width .4s ease;}
.do-progress-info{display:flex;justify-content:space-between;margin-top:5px;font-size:.75rem;color:var(--muted);}
/* Persona badge */
.do-persona{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);font-size:.8rem;color:var(--green);font-weight:700;margin-top:16px;}
/* Persona iframe */
.do-kyc-wrap{border-radius:16px;overflow:hidden;background:rgba(255,255,255,.03);border:1px solid rgba(96,165,250,.2);margin-bottom:18px;}
.do-kyc-frame{width:100%;height:640px;border:none;display:block;}
.do-kyc-open{width:100%;padding:15px;border-radius:13px;background:linear-gradient(135deg,#25D366,#1ebe5d);color:#fff;border:none;font:700 1rem 'Heebo',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 4px 18px rgba(34,197,94,.3);transition:all .25s;margin-bottom:14px;}
.do-kyc-open:hover{transform:translateY(-2px);box-shadow:0 7px 24px rgba(34,197,94,.45);}
.do-kyc-done-btn{width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;font:700 .95rem 'Heebo',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(37,99,235,.3);transition:all .25s;margin-top:10px;}
.do-kyc-done-btn:hover{transform:translateY(-2px);box-shadow:0 7px 22px rgba(37,99,235,.45);}
/* Success screen */
.do-success{text-align:center;padding:24px 0;}
.do-success-ico{font-size:4rem;margin-bottom:16px;animation:doIn .5s .1s ease both,gdBounce 2s 1s ease-in-out infinite;}
@keyframes gdBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
/* Nav buttons */
.do-navbtns{display:flex;gap:10px;margin-top:24px;}
.do-btn-back{padding:12px 18px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--muted);font:.9rem 'Heebo',sans-serif;cursor:pointer;transition:all .2s;}
.do-btn-back:hover{background:rgba(255,255,255,.08);color:var(--white);}
.do-btn-next{flex:1;padding:14px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;font:700 1rem 'Heebo',sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(37,99,235,.3);transition:all .25s;display:flex;align-items:center;justify-content:center;gap:8px;}
.do-btn-next:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 24px rgba(37,99,235,.45);}
.do-btn-next:disabled{opacity:.45;cursor:not-allowed;transform:none;}
.do-btn-done{flex:1;padding:14px;border-radius:12px;background:linear-gradient(135deg,var(--green),#16a34a);color:#fff;border:none;font:700 1rem 'Heebo',sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(34,197,94,.3);transition:all .25s;display:flex;align-items:center;justify-content:center;gap:8px;}
.do-btn-done:hover{transform:translateY(-2px);box-shadow:0 7px 24px rgba(34,197,94,.45);}
/* Error */
.do-err{margin-top:14px;padding:12px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.28);border-radius:10px;color:#FCA5A5;font-size:.85rem;}
/* Fleet type selector */
.do-fleet-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;}
.do-fleet-card{
  padding:24px 16px;border-radius:18px;cursor:pointer;
  border:2px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);
  text-align:center;transition:all .22s;outline:none;font-family:inherit;
  color:var(--white);
}
.do-fleet-card:hover{background:rgba(37,99,235,.08);border-color:rgba(96,165,250,.25);}
.do-fleet-card.selected{
  background:rgba(253,224,71,.08);border-color:var(--gold);
  box-shadow:0 4px 18px rgba(253,224,71,.12);
}
.do-fleet-ico{font-size:2.2rem;margin-bottom:10px;}
.do-fleet-name{font-size:.95rem;font-weight:800;margin-bottom:5px;}
.do-fleet-sub{font-size:.72rem;color:var(--muted);line-height:1.5;}
.do-fleet-card.selected .do-fleet-name{color:var(--gold);}
/* AI scan badge */
.do-ai-scan{
  display:flex;align-items:center;gap:6px;
  background:rgba(253,224,71,.07);border:1px solid rgba(253,224,71,.2);
  border-radius:20px;padding:3px 10px;font-size:.68rem;color:var(--gold);
  animation:doAiPulse 1.4s ease-in-out infinite;
}
@keyframes doAiPulse{0%,100%{opacity:1;}50%{opacity:.55;}}
.do-ai-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:doAiPulse 1.4s ease-in-out infinite;}
`;
const DOCS = [
    { id: 'license', label: 'רישיון נהיגה', icon: '🪪' },
    { id: 'taxi_license', label: 'רישיון מונית', icon: '🚕', taxiOnly: true },
    { id: 'insurance', label: 'ביטוח רכב', icon: '🛡️' },
    { id: 'identity', label: 'תעודת זהות / דרכון', icon: '📄' },
    { id: 'selfie', label: 'סלפי אימות', icon: '🤳' },
    { id: 'vehicle_reg', label: 'רישיון רכב', icon: '🚗' },
];
const STEPS = [
    { step: 0, label: 'סוג', icon: '🚕' },
    { step: 1, label: 'פרטים', icon: '👤' },
    { step: 2, label: 'מסמכים', icon: '📋' },
    { step: 3, label: 'רכב', icon: '🚗' },
    { step: 4, label: 'סיום', icon: '✅' },
];
export default function DriverOnboarding() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [step, setStep] = useState(0);
    const [driverType, setDriverType] = useState((params.get('role') === 'taxi') ? 'taxi' : 'rideshare');
    const [docStatus, setDocStatus] = useState({});
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [vehicleModel, setVehicle] = useState('');
    const [vehicleYear, setYear] = useState('');
    const [error, setError] = useState(null);
    // Real Persona KYC URL — set by useAuth after WA auth completes for drivers
    const [kycUrl] = useState(() => localStorage.getItem('kyc_url'));
    const [kycOpened, setKycOpened] = useState(false);
    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'do-css';
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { document.getElementById('do-css')?.remove(); };
    }, []);
    const visibleDocs = DOCS.filter(d => !d.taxiOnly || driverType === 'taxi');
    const verifiedCount = visibleDocs.filter(d => docStatus[d.id] === 'verified').length;
    const scanningCount = Object.values(docStatus).filter(s => s === 'scanning').length;
    const allVerified = visibleDocs.every(d => docStatus[d.id] === 'verified');
    function simulateScan(id) {
        const cur = docStatus[id];
        if (cur === 'uploading' || cur === 'scanning' || cur === 'verified')
            return;
        setDocStatus(p => ({ ...p, [id]: 'uploading' }));
        setTimeout(() => {
            setDocStatus(p => ({ ...p, [id]: 'scanning' }));
            setTimeout(() => {
                setDocStatus(p => ({ ...p, [id]: Math.random() > 0.08 ? 'verified' : 'failed' }));
            }, 2000 + Math.random() * 1500);
        }, 600);
    }
    function canProceed() {
        if (step === 0)
            return true; // fleet type always selected
        if (step === 1)
            return phone.trim().length >= 9 && name.trim().length >= 2;
        if (step === 2)
            return kycUrl ? kycOpened : allVerified;
        if (step === 3)
            return vehicleModel.trim().length >= 2 && vehicleYear.trim().length === 4;
        return true;
    }
    function handleNext() {
        if (!canProceed()) {
            setError('נא למלא את כל השדות הנדרשים');
            return;
        }
        setError(null);
        setStep(s => Math.min(s + 1, 4));
    }
    const docStatusClass = (id) => docStatus[id] ?? 'idle';
    return (_jsxs("div", { className: "do", children: [_jsx("div", { className: "do-bg" }), _jsxs("div", { className: "do-hdr", children: [_jsx("button", { className: "do-back", onClick: () => navigate('/'), children: "\u2190 \u05D7\u05D6\u05D5\u05E8" }), _jsxs("div", { children: [_jsxs("div", { className: "do-hdrt", children: [driverType === 'taxi' ? '🚕 נהג מונית מורשה' : '🚗 נהג עצמאי', " \u2014 \u05D4\u05E8\u05E9\u05DE\u05D4"] }), _jsx("div", { className: "do-hdrs", children: driverType === 'taxi' ? 'נדרש רישיון מונית + Persona KYC' : 'חוק הסעות 2026 — ללא רישיון מונית' })] })] }), _jsxs("div", { className: "do-main", children: [_jsx("div", { className: "do-stepper", children: STEPS.map((s, i) => (_jsxs("div", { className: "do-step", children: [i < STEPS.length - 1 && (_jsx("div", { className: `do-step-line ${step > s.step ? 'done' : ''}` })), _jsx("div", { className: `do-step-circle ${step === s.step ? 'active' : step > s.step ? 'done' : 'idle'}`, children: step > s.step ? '✓' : s.icon }), _jsx("div", { className: `do-step-label ${step === s.step ? 'active' : ''}`, children: s.label })] }, s.step))) }), step === 0 && (_jsxs("div", { className: "do-card", children: [_jsx("div", { className: "do-card-title", children: "\uD83D\uDE95 \u05D1\u05D7\u05E8 \u05E1\u05D5\u05D2 \u05E0\u05D4\u05D9\u05D2\u05D4" }), _jsx("div", { className: "do-card-sub", children: "\u05D1\u05D7\u05E8 \u05D0\u05EA \u05E1\u05D5\u05D2 \u05D4\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E9\u05D1\u05E8\u05E9\u05D5\u05EA\u05DA. \u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05E0\u05D5\u05EA \u05DC\u05D0\u05D7\u05E8 \u05D4\u05D4\u05E8\u05E9\u05DE\u05D4." }), _jsxs("div", { className: "do-fleet-grid", children: [_jsxs("button", { className: `do-fleet-card${driverType === 'taxi' ? ' selected' : ''}`, onClick: () => setDriverType('taxi'), children: [_jsx("div", { className: "do-fleet-ico", children: "\uD83D\uDE95" }), _jsx("div", { className: "do-fleet-name", children: "\u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05EA" }), _jsx("div", { className: "do-fleet-sub", children: "\u05DB\u05D5\u05D1\u05E2 \u05E6\u05D4\u05D5\u05D1 \u00B7 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA \u00B7 \u05DE\u05D3-\u05DE\u05E8\u05D7\u05E7 \u00B7 \u05D2\u05D1\u05D9\u05D9\u05EA \u05EA\u05E9\u05DC\u05D5\u05DD" })] }), _jsxs("button", { className: `do-fleet-card${driverType === 'rideshare' ? ' selected' : ''}`, onClick: () => setDriverType('rideshare'), children: [_jsx("div", { className: "do-fleet-ico", children: "\uD83D\uDE97" }), _jsx("div", { className: "do-fleet-name", children: "\u05E8\u05DB\u05D1 \u05E4\u05E8\u05D8\u05D9" }), _jsx("div", { className: "do-fleet-sub", children: "\u05EA\u05D9\u05E7\u05D5\u05DF 142 \u00B7 \u05DC\u05DC\u05D0 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA \u00B7 \u05D4\u05E2\u05D1\u05E8\u05D4 \u05E4\u05E8\u05D8\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D4" })] })] }), _jsxs("div", { className: "do-infobox", children: ["\u2139\uFE0F ", _jsx("strong", { style: { color: '#F1F5F9' }, children: "\u05D4\u05D4\u05D1\u05D3\u05DC:" }), " \u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05EA \u05E0\u05D3\u05E8\u05E9\u05EA \u05DC\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05D9\u05D9\u05E2\u05D5\u05D3\u05D9 \u05D5\u05DE\u05D3-\u05DE\u05E8\u05D7\u05E7 \u05DE\u05D0\u05D5\u05E9\u05E8. \u05E8\u05DB\u05D1 \u05E4\u05E8\u05D8\u05D9 (\u05EA\u05D9\u05E7\u05D5\u05DF 142) \u05DE\u05D0\u05E4\u05E9\u05E8 \u05D4\u05E1\u05E2\u05D5\u05EA \u05DC\u05DC\u05D0 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA \u05D1\u05EA\u05E0\u05D0\u05D9 \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05E1\u05D5\u05D9\u05DE\u05D9\u05DD."] })] })), step === 1 && (_jsxs("div", { className: "do-card", children: [_jsx("div", { className: "do-card-title", children: "\uD83D\uDC64 \u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD" }), _jsx("div", { className: "do-card-sub", children: "\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA \u05DE\u05D1\u05D5\u05E6\u05E2 \u05E2\u05DC \u05D9\u05D3\u05D9 Persona KYC. \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05DC\u05DA \u05DE\u05D5\u05E6\u05E4\u05E0\u05D9\u05DD \u05D5\u05DE\u05D5\u05D2\u05E0\u05D9\u05DD." }), _jsxs("div", { className: "do-fgroup", children: [_jsx("label", { className: "do-lbl", children: "\u05E9\u05DD \u05DE\u05DC\u05D0" }), _jsx("input", { className: "do-inp", type: "text", placeholder: "\u05D9\u05E9\u05E8\u05D0\u05DC \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9", value: name, onChange: e => setName(e.target.value) })] }), _jsxs("div", { className: "do-fgroup", children: [_jsx("label", { className: "do-lbl", children: "\u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF (\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4)" }), _jsx("input", { className: "do-inp", type: "tel", placeholder: "05X-XXX-XXXX", value: phone, onChange: e => setPhone(e.target.value), dir: "ltr" })] }), _jsxs("div", { className: "do-infobox", children: ["\uD83D\uDD12 ", _jsx("strong", { style: { color: '#F1F5F9' }, children: "\u05D0\u05D1\u05D8\u05D7\u05D4 \u05D5\u05E4\u05E8\u05D8\u05D9\u05D5\u05EA:" }), " \u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA \u05DE\u05EA\u05D1\u05E6\u05E2 \u05E2\u05DC \u05D9\u05D3\u05D9", ' ', _jsx("strong", { style: { color: '#60A5FA' }, children: "Persona.com" }), " \u2014 \u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA KYC \u05D1\u05D9\u05E0\u05DC\u05D0\u05D5\u05DE\u05D9\u05EA. \u05D0\u05E3 \u05DE\u05E1\u05DE\u05DA \u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8 \u05E2\u05DC \u05E9\u05E8\u05EA\u05D9\u05E0\u05D5 \u05DC\u05D0\u05D7\u05E8 \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA."] })] })), step === 2 && (_jsx("div", { className: "do-card", children: kycUrl ? (
                        /* ── Real Persona hosted flow ── */
                        _jsxs(_Fragment, { children: [_jsx("div", { className: "do-card-title", children: "\uD83E\uDEAA \u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA \u2014 Persona KYC" }), _jsx("div", { className: "do-card-sub", children: "\u05DC\u05D7\u05E5 \u05E2\u05DC \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DC\u05E4\u05EA\u05D9\u05D7\u05EA \u05DE\u05DE\u05E9\u05E7 \u05D4\u05D6\u05D9\u05D4\u05D5\u05D9 \u05D4\u05DE\u05D0\u05D5\u05D1\u05D8\u05D7 \u05E9\u05DC Persona. \u05D4\u05EA\u05D4\u05DC\u05D9\u05DA \u05DC\u05D5\u05E7\u05D7 \u05DB-3 \u05D3\u05E7\u05D5\u05EA \u05D5\u05DE\u05EA\u05D1\u05E6\u05E2 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D1\u05D3\u05E4\u05D3\u05E4\u05DF \u05E9\u05DC\u05DA." }), _jsx("button", { className: "do-kyc-open", onClick: () => { window.open(kycUrl, '_blank', 'noopener,noreferrer'); setKycOpened(true); }, children: "\uD83D\uDEE1\uFE0F \u05E4\u05EA\u05D7 \u05D0\u05D9\u05DE\u05D5\u05EA Persona (\u05E4\u05EA\u05D9\u05D7\u05D4 \u05D1\u05DB\u05E8\u05D8\u05D9\u05E1\u05D9\u05D9\u05D4 \u05D7\u05D3\u05E9\u05D4)" }), kycOpened && (_jsx("div", { className: "do-infobox", style: { background: 'rgba(34,197,94,.07)', borderColor: 'rgba(34,197,94,.2)', color: 'var(--green)' }, children: "\u2705 \u05DE\u05DE\u05E9\u05E7 Persona \u05E0\u05E4\u05EA\u05D7 \u2014 \u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05D5\u05DC\u05D0\u05D7\u05E8 \u05DE\u05DB\u05DF \u05DC\u05D7\u05E5 \"\u05D4\u05DE\u05E9\u05DA\" \u05DB\u05D0\u05DF." })), !kycOpened && (_jsxs("div", { className: "do-infobox", children: ["\uD83D\uDD12 ", _jsx("strong", { style: { color: '#F1F5F9' }, children: "\u05DE\u05D4 \u05D9\u05D9\u05D3\u05E8\u05E9:" }), " \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA / \u05D3\u05E8\u05DB\u05D5\u05DF + \u05E1\u05DC\u05E4\u05D9 \u05D7\u05D9. \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DE\u05D5\u05E6\u05E4\u05E0\u05D9\u05DD \u05D5\u05DE\u05D5\u05E2\u05D1\u05E8\u05D9\u05DD \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC-Persona \u2014 \u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8\u05D9\u05DD \u05D0\u05E6\u05DC\u05E0\u05D5."] })), _jsx("div", { style: { textAlign: 'center', marginTop: '18px' }, children: _jsx("div", { className: "do-persona", children: "\uD83D\uDEE1\uFE0F Persona \u00B7 ISO 27001 \u00B7 SOC 2 Type II" }) })] })) : (
                        /* ── Simulated fallback (no kyc_url — dev / demo mode) ── */
                        _jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }, children: [_jsx("div", { className: "do-card-title", children: "\uD83D\uDCCB \u05D0\u05D9\u05DE\u05D5\u05EA \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" }), _jsxs("div", { style: { fontSize: '.82rem', color: 'var(--muted)' }, children: [_jsx("span", { style: { color: '#60A5FA', fontWeight: 800 }, children: verifiedCount }), "/", visibleDocs.length] })] }), _jsx("div", { className: "do-card-sub", children: "\u05DC\u05D7\u05E5 \u05E2\u05DC \u05DB\u05DC \u05DE\u05E1\u05DE\u05DA \u05DC\u05D4\u05E2\u05DC\u05D0\u05D4 \u2014 AI \u05D9\u05D0\u05DE\u05EA \u05EA\u05D5\u05DA \u05E9\u05E0\u05D9\u05D5\u05EA." }), _jsxs("div", { className: "do-progress-wrap", children: [_jsx("div", { className: "do-progress-bar", children: _jsx("div", { className: "do-progress-fill", style: { width: `${(verifiedCount / visibleDocs.length) * 100}%` } }) }), _jsxs("div", { className: "do-progress-info", children: [_jsx("span", { children: scanningCount > 0 ? `⚙️ סורק ${scanningCount}...` : 'לחץ על מסמך להעלאה' }), _jsxs("span", { children: [Math.round((verifiedCount / visibleDocs.length) * 100), "%"] })] })] }), _jsx("div", { className: "do-docgrid", children: visibleDocs.map(doc => {
                                        const st = docStatusClass(doc.id);
                                        return (_jsxs("button", { className: `do-doc ${st}`, onClick: () => simulateScan(doc.id), disabled: st === 'verified', children: [_jsx("div", { className: "do-doc-ico", children: st === 'verified' ? '✅' : st === 'failed' ? '❌' : (st === 'scanning' || st === 'uploading') ? '⚙️' : doc.icon }), _jsx("div", { className: `do-doc-name ${st}`, children: doc.label }), st === 'scanning' && _jsx("div", { className: "do-scanbar" }), _jsx("div", { className: "do-doc-hint", children: st === 'idle' ? 'לחץ להעלאה' :
                                                        st === 'uploading' ? 'מעלה...' :
                                                            st === 'scanning' ? _jsxs("span", { className: "do-ai-scan", children: [_jsx("span", { className: "do-ai-dot" }), "\u05E1\u05D5\u05DB\u05DF AI \u05E1\u05D5\u05E8\u05E7 \u05DE\u05E1\u05DE\u05DA..."] }) :
                                                                st === 'verified' ? 'אומת ✓' : 'נסה שנית' })] }, doc.id));
                                    }) }), _jsx("div", { style: { textAlign: 'center' }, children: _jsx("div", { className: "do-persona", children: "\uD83D\uDEE1\uFE0F Persona KYC \u00B7 ISO 27001" }) })] })) })), step === 3 && (_jsxs("div", { className: "do-card", children: [_jsx("div", { className: "do-card-title", children: "\uD83D\uDE97 \u05E4\u05E8\u05D8\u05D9 \u05D4\u05E8\u05DB\u05D1" }), _jsxs("div", { className: "do-card-sub", children: ["\u05D4\u05D2\u05D3\u05E8 \u05D0\u05EA \u05D4\u05E8\u05DB\u05D1 \u05E9\u05D1\u05D5 \u05EA\u05E9\u05EA\u05DE\u05E9 \u05DC\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA.", driverType === 'taxi' && ' מונית צריכה מד-מרחק מאושר.'] }), _jsxs("div", { className: "do-fgroup", children: [_jsx("label", { className: "do-lbl", children: "\u05D9\u05E6\u05E8\u05DF \u05D5\u05D3\u05D2\u05DD" }), _jsx("input", { className: "do-inp", type: "text", placeholder: "Toyota Corolla", value: vehicleModel, onChange: e => setVehicle(e.target.value), dir: "ltr" })] }), _jsxs("div", { className: "do-fgroup", children: [_jsx("label", { className: "do-lbl", children: "\u05E9\u05E0\u05EA \u05D9\u05D9\u05E6\u05D5\u05E8" }), _jsx("input", { className: "do-inp", type: "number", placeholder: "2021", min: 2010, max: 2026, value: vehicleYear, onChange: e => setYear(e.target.value), dir: "ltr" })] }), driverType === 'taxi' && (_jsxs("div", { className: "do-infobox warn", children: ["\uD83D\uDE95 ", _jsx("strong", { children: "\u05D3\u05E8\u05D9\u05E9\u05D5\u05EA \u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D4:" }), " \u05DE\u05D3-\u05DE\u05E8\u05D7\u05E7 \u05DE\u05D0\u05D5\u05E9\u05E8 \u00B7 \u05DE\u05DB\u05E9\u05D9\u05E8 \u05D2\u05D1\u05D9\u05D9\u05EA \u05EA\u05E9\u05DC\u05D5\u05DD \u00B7 \u05E9\u05DC\u05D8 \"\u05DE\u05D5\u05E0\u05D9\u05EA\" \u05EA\u05E7\u05D9\u05DF \u00B7 \u05D1\u05D9\u05D8\u05D5\u05D7 \u05DE\u05E1\u05D7\u05E8\u05D9 \u05D1\u05EA\u05D5\u05E7\u05E3"] }))] })), step === 4 && (_jsxs("div", { className: "do-card do-success", children: [_jsx("div", { className: "do-success-ico", children: "\uD83C\uDF89" }), _jsx("div", { className: "do-card-title", style: { fontSize: '1.6rem', color: '#60A5FA', marginBottom: '10px' }, children: "\u05D1\u05E8\u05D5\u05DA \u05D4\u05D1\u05D0 \u05DC\u05E6\u05D5\u05D5\u05EA!" }), _jsxs("div", { className: "do-card-sub", style: { marginBottom: '24px' }, children: ["\u05D4\u05D4\u05E8\u05E9\u05DE\u05D4 \u05D4\u05D5\u05E9\u05DC\u05DE\u05D4. \u05D1\u05D3\u05D9\u05E7\u05EA \u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05D0\u05D5\u05E8\u05DB\u05EA \u05E2\u05D3 ", _jsx("strong", { style: { color: '#F1F5F9' }, children: "24 \u05E9\u05E2\u05D5\u05EA \u05E2\u05E1\u05E7\u05D9\u05DD" }), ". \u05EA\u05E7\u05D1\u05DC \u05E2\u05D3\u05DB\u05D5\u05DF \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05DB\u05E9\u05EA\u05D4\u05D9\u05D4 \u05DE\u05D5\u05DB\u05DF \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA."] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 320, margin: '0 auto' }, children: [_jsx("div", { className: "do-persona", style: { justifyContent: 'center' }, children: "\u2705 \u05D0\u05D5\u05DE\u05EA \u05E2\u05DC \u05D9\u05D3\u05D9 Persona KYC" }), _jsxs("div", { className: "do-persona", style: { justifyContent: 'center' }, children: ["\u2705 ", driverType === 'taxi' ? 'נהג מונית מורשה' : 'נהג עצמאי — חוק 2026'] })] })] })), error && _jsxs("div", { className: "do-err", children: ["\u26A0\uFE0F ", error] }), _jsxs("div", { className: "do-navbtns", children: [step > 0 && step < 4 && (_jsx("button", { className: "do-btn-back", onClick: () => { setStep(s => s - 1); setError(null); }, children: "\u2190 \u05D0\u05D7\u05D5\u05E8\u05D4" })), step < 4 && (_jsxs("button", { className: "do-btn-next", disabled: !canProceed(), onClick: handleNext, children: [step === 3 ? 'סיים הרשמה' : 'המשך', " \u2192"] })), step === 4 && (_jsx("button", { className: "do-btn-done", onClick: () => window.location.href = 'https://driver.easytaxiisrael.com', children: "\uD83D\uDE95 \u05E2\u05D1\u05D5\u05E8 \u05DC\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05E0\u05D4\u05D2\u05D9\u05DD \u2192" }))] })] })] }));
}
