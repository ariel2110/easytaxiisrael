import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
const CSS = `
.dp,.dp *,.dp *::before,.dp *::after{box-sizing:border-box;margin:0;padding:0;}
.dp{
  --bg:#070B14;--blue:#2563EB;--blue2:#1D4ED8;--bluel:#60A5FA;
  --white:#F1F5F9;--muted:#94A3B8;--card:rgba(255,255,255,.04);--cb:rgba(255,255,255,.09);
  --green:#22C55E;--gold:#FDE047;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
  display:flex;align-items:center;justify-content:center;padding:20px;
}
.dp-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 70% 50% at 50% 10%,rgba(37,99,235,.18) 0%,transparent 65%),linear-gradient(180deg,#070B14 0%,#0C1322 100%);}
.dp-wrap{position:relative;z-index:1;max-width:480px;width:100%;text-align:center;}
/* Spinner */
@keyframes dpSpin{to{transform:rotate(360deg)}}
.dp-spinner{width:80px;height:80px;margin:0 auto 24px;border-radius:50%;border:4px solid rgba(255,255,255,.08);border-top-color:var(--blue);animation:dpSpin 1.1s linear infinite;}
@keyframes dpSpin{to{transform:rotate(360deg)}}
/* Pulse ring */
.dp-pulseRing{position:absolute;inset:0;border-radius:50%;border:4px solid rgba(37,99,235,.2);animation:dpPulse 2s ease-out infinite;}
@keyframes dpPulse{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.4);opacity:0}}
.dp-icon-wrap{position:relative;width:80px;height:80px;margin:0 auto 24px;}
.dp-icon{width:80px;height:80px;border-radius:50%;background:rgba(37,99,235,.15);border:2px solid rgba(37,99,235,.3);display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:1;position:relative;}
/* Card */
.dp-card{background:var(--card);border:1px solid var(--cb);border-radius:22px;padding:36px 28px;margin-bottom:18px;}
.dp-title{font-size:1.8rem;font-weight:900;letter-spacing:-.03em;margin-bottom:10px;line-height:1.15;}
.dp-title span{background:linear-gradient(135deg,#93C5FD,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.dp-sub{color:var(--muted);font-size:.95rem;line-height:1.7;margin-bottom:28px;}
/* Steps */
.dp-steps{text-align:right;display:flex;flex-direction:column;gap:10px;margin-bottom:28px;}
.dp-srow{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);}
.dp-srow.active{background:rgba(37,99,235,.08);border-color:rgba(96,165,250,.2);}
.dp-srow.done{background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.2);}
.dp-sbadge{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:800;}
.dp-srow.done .dp-sbadge{background:rgba(34,197,94,.2);color:var(--green);}
.dp-srow.active .dp-sbadge{background:rgba(37,99,235,.25);color:var(--bluel);animation:dpPulseIcon .9s ease-in-out infinite alternate;}
@keyframes dpPulseIcon{from{box-shadow:0 0 0 0 rgba(37,99,235,.4)}to{box-shadow:0 0 0 6px rgba(37,99,235,0)}}
.dp-srow.idle .dp-sbadge{background:rgba(255,255,255,.06);color:var(--muted);}
.dp-slabel{font-size:.88rem;font-weight:700;}
.dp-sdesc{font-size:.75rem;color:var(--muted);}
/* ETA chip */
.dp-eta{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:100px;background:rgba(37,99,235,.1);border:1px solid rgba(96,165,250,.18);color:var(--bluel);font-size:.82rem;font-weight:700;margin-bottom:24px;}
/* WA button */
.dp-wa{width:100%;padding:14px;border-radius:13px;background:#25D366;color:#fff;border:none;font:700 1rem 'Heebo',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 4px 18px rgba(37,211,102,.35);transition:all .25s;text-decoration:none;margin-bottom:10px;}
.dp-wa:hover{transform:translateY(-2px);box-shadow:0 7px 24px rgba(37,211,102,.5);}
.dp-link{color:var(--muted);font-size:.8rem;text-decoration:none;display:block;transition:color .2s;}
.dp-link:hover{color:var(--bluel);}
/* Persona */
.dp-persona{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.22);font-size:.78rem;color:var(--green);font-weight:700;margin-top:6px;}
@keyframes dpIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.dp-ain{animation:dpIn .5s ease both;}
.dp-d1{animation-delay:.08s}.dp-d2{animation-delay:.16s}
`;
function stepsFromKyc(kycStatus) {
    const isActive = (s) => ['created', 'started'].includes(s);
    const isDone = (s) => ['completed', 'approved'].includes(s);
    return [
        { label: 'אימות WhatsApp', desc: 'מספר הטלפון אומת בהצלחה ✓', status: 'done' },
        {
            label: 'בדיקת מסמכים',
            desc: kycStatus === 'approved' ? 'Persona KYC אישרה את המסמכים ✓'
                : kycStatus === 'declined' ? '❌ Persona דחתה — פנה לתמיכה'
                    : kycStatus === 'expired' ? '⌛ פג תוקף — פתח שוב את קישור ה-KYC'
                        : 'Persona KYC סורקת את המסמכים שלך…',
            status: isDone(kycStatus) ? 'done'
                : isActive(kycStatus) ? 'active'
                    : kycStatus === 'not_started' ? 'idle' : 'active',
        },
        {
            label: 'אישור ידני',
            desc: kycStatus === 'approved' ? 'בדיקה הושלמה ✓' : 'עורך דין רישוי בודק את הגשתך',
            status: kycStatus === 'approved' ? 'done' : isDone(kycStatus) ? 'active' : 'idle',
        },
        { label: 'פעיל!', desc: 'מוכן לקבל נסיעות', status: kycStatus === 'approved' ? 'active' : 'idle' },
    ];
}
export default function DriverPending() {
    const navigate = useNavigate();
    const [elapsed, setElapsed] = useState(0);
    const [kycStatus, setKycStatus] = useState('created');
    const [kycUrl, setKycUrl] = useState(() => localStorage.getItem('kyc_url'));
    const [approved, setApproved] = useState(false);
    const [kycLoading, setKycLoading] = useState(false);
    const pollRef = useRef(null);
    function handleStartKyc() {
        if (!kycUrl || kycLoading)
            return;
        let inquiryId = null;
        let sessionToken = null;
        try {
            const parsed = new URL(kycUrl);
            inquiryId = parsed.searchParams.get('inquiry-id');
            sessionToken = parsed.searchParams.get('session-token');
        }
        catch { /* ignore */ }
        if (!inquiryId) {
            window.location.href = kycUrl;
            return;
        }
        setKycLoading(true);
        const iid = inquiryId;
        const stok = sessionToken;
        function openClient() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const P = window.Persona;
            if (!P?.Client) {
                setKycLoading(false);
                window.location.href = kycUrl;
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cfg = {
                inquiryId: iid,
                onReady: () => { setKycLoading(false); client.open(); },
                onComplete: () => { window.location.reload(); },
                onCancel: () => { setKycLoading(false); },
                onError: () => { setKycLoading(false); window.location.href = kycUrl; },
            };
            if (stok)
                cfg.sessionToken = stok;
            const client = new P.Client(cfg);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (window.Persona?.Client) {
            openClient();
            return;
        }
        if (document.getElementById('persona-sdk')) {
            document.getElementById('persona-sdk').addEventListener('load', openClient, { once: true });
            return;
        }
        const s = document.createElement('script');
        s.id = 'persona-sdk';
        s.src = 'https://cdn.withpersona.com/dist/persona-v5-latest.js';
        s.addEventListener('load', openClient, { once: true });
        s.addEventListener('error', () => { setKycLoading(false); window.location.href = kycUrl; }, { once: true });
        document.head.appendChild(s);
    }
    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'dp-css';
        el.textContent = CSS;
        document.head.appendChild(el);
        const t = setInterval(() => setElapsed(p => p + 1), 60000);
        return () => { document.getElementById('dp-css')?.remove(); clearInterval(t); };
    }, []);
    // Poll KYC status every 10 seconds
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token)
            return;
        const poll = async () => {
            try {
                const r = await fetch('/api/auth/driver/kyc-status', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!r.ok)
                    return;
                const data = await r.json();
                setKycStatus(data.kyc_status);
                if (data.kyc_url)
                    setKycUrl(data.kyc_url);
                if (data.kyc_status === 'approved') {
                    setApproved(true);
                    if (pollRef.current)
                        clearInterval(pollRef.current);
                }
            }
            catch { /* network error — silently ignore */ }
        };
        poll();
        pollRef.current = setInterval(poll, 10000);
        return () => { if (pollRef.current)
            clearInterval(pollRef.current); };
    }, []);
    const etaHours = Math.max(2, 24 - elapsed);
    const steps = stepsFromKyc(kycStatus);
    return (_jsxs("div", { className: "dp", children: [kycLoading && (_jsxs("div", { style: {
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(7,11,20,0.96)',
                }, children: [_jsx("div", { style: { width: 48, height: 48, border: '4px solid rgba(255,255,255,.1)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'dpSpin 1s linear infinite' } }), _jsx("p", { style: { marginTop: 20, color: '#94A3B8', fontFamily: 'Heebo,sans-serif', fontSize: '0.95rem' }, children: "\u05D8\u05D5\u05E2\u05DF \u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA\u2026" })] })), _jsx("div", { className: "dp-bg" }), _jsxs("div", { className: "dp-wrap", children: [_jsxs("div", { className: "dp-icon-wrap dp-ain", children: [_jsx("div", { className: "dp-pulseRing" }), _jsx("div", { className: "dp-icon", children: "\uD83E\uDEAA" })] }), _jsx("div", { className: "dp-card dp-ain dp-d1", children: approved ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dp-title", children: ["\uD83C\uDF89 ", _jsx("span", { children: "\u05D0\u05D5\u05E9\u05E8\u05EA!" })] }), _jsx("div", { className: "dp-sub", children: "\u05D4\u05D6\u05D4\u05D5\u05EA \u05D0\u05D5\u05DE\u05EA\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4. \u05D0\u05EA\u05D4 \u05DE\u05D5\u05DB\u05DF \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA!" }), _jsx("button", { className: "dp-wa", style: { background: '#2563EB', boxShadow: '0 4px 18px rgba(37,99,235,.4)' }, onClick: () => { window.location.href = 'https://driver.easytaxiisrael.com'; }, children: "\uD83D\uDE95 \u05E4\u05EA\u05D7 \u05E4\u05D5\u05E8\u05D8\u05DC \u05E0\u05D4\u05D2\u05D9\u05DD" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dp-title", children: ["\u05D0\u05D9\u05DE\u05D5\u05EA ", _jsx("span", { children: "\u05D1\u05EA\u05D4\u05DC\u05D9\u05DA" })] }), _jsx("div", { className: "dp-sub", children: "\u05E7\u05D9\u05D1\u05DC\u05E0\u05D5 \u05D0\u05EA \u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E9\u05DC\u05DA. Persona KYC \u05DE\u05D0\u05DE\u05EA\u05EA \u05D0\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA \u05E9\u05DC\u05DA \u05DB\u05E2\u05EA. \u05EA\u05E7\u05D1\u05DC \u05D4\u05D5\u05D3\u05E2\u05D4 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05D1\u05E8\u05D2\u05E2 \u05E9\u05EA\u05D4\u05D9\u05D4 \u05DE\u05D5\u05DB\u05DF \u05DC\u05E0\u05E1\u05D5\u05E2." }), _jsxs("div", { className: "dp-eta", children: ["\u23F1 \u05D6\u05DE\u05DF \u05DE\u05DE\u05D5\u05E6\u05E2 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8: \u05E2\u05D3 ", etaHours, " \u05E9\u05E2\u05D5\u05EA"] }), _jsx("div", { className: "dp-steps", children: steps.map(s => (_jsxs("div", { className: `dp-srow ${s.status}`, children: [_jsx("div", { className: "dp-sbadge", children: s.status === 'done' ? '✓' : s.status === 'active' ? '⚙' : '○' }), _jsxs("div", { children: [_jsx("div", { className: "dp-slabel", children: s.label }), _jsx("div", { className: "dp-sdesc", children: s.desc })] })] }, s.label))) }), kycUrl && (kycStatus === 'not_started' || kycStatus === 'created') && (_jsxs("button", { className: "dp-wa", style: { background: '#7C3AED', boxShadow: '0 4px 18px rgba(124,58,237,.4)', marginBottom: '12px' }, onClick: handleStartKyc, disabled: kycLoading, children: ["\uD83E\uDEAA ", kycLoading ? 'טוען…' : 'השלם אימות Persona'] })), _jsx("div", { className: "dp-persona", children: "\uD83D\uDEE1\uFE0F \u05DE\u05D5\u05E4\u05E2\u05DC \u05E2\u05DC \u05D9\u05D3\u05D9 Persona \u00B7 ISO 27001 \u00B7 SOC 2" })] })) }), _jsxs("div", { className: "dp-ain dp-d2", children: [_jsx("a", { href: "https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A0%D7%94%D7%92%20%D7%9E%D7%97%D7%9B%D7%94%20%D7%9C%D7%90%D7%99%D7%A9%D7%95%D7%A8", target: "_blank", rel: "noopener noreferrer", className: "dp-wa", children: "\uD83D\uDCAC \u05E9\u05D0\u05DC \u05D0\u05EA \u05D4\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" }), _jsx("a", { className: "dp-link", onClick: () => navigate('/'), style: { cursor: 'pointer' }, children: "\u2190 \u05D7\u05D6\u05D5\u05E8 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA" })] })] })] }));
}
