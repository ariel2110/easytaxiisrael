import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
/* ── Self-contained dark-navy design (matches Landing.tsx) ── */
const CSS = `
.lg*,.lg*::before,.lg*::after{box-sizing:border-box;margin:0;padding:0;}
.lg{
  --bg:#070B14;--bg2:#0D1526;--blue:#2563EB;--blue2:#1D4ED8;
  --bluel:#60A5FA;--blueg:rgba(37,99,235,.28);
  --white:#F1F5F9;--muted:#94A3B8;--card:rgba(255,255,255,.04);
  --cb:rgba(255,255,255,.09);--r:18px;--green:#22C55E;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:24px 16px;position:relative;overflow:hidden;
}
/* Radial bg glow */
.lg-bg{position:fixed;inset:0;z-index:0;
  background:
    radial-gradient(ellipse 90% 60% at 50% 0%,rgba(37,99,235,.18) 0%,transparent 65%),
    radial-gradient(ellipse 50% 50% at 80% 90%,rgba(29,78,216,.12) 0%,transparent 55%),
    linear-gradient(180deg,#070B14 0%,#0C1322 100%);
}
/* Grid pattern */
.lg-grid{position:fixed;inset:0;z-index:0;
  background-image:linear-gradient(rgba(37,99,235,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.04) 1px,transparent 1px);
  background-size:64px 64px;
  -webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);
  mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);
}
/* Back link */
.lg-back{position:fixed;top:20px;right:24px;z-index:10;
  display:inline-flex;align-items:center;gap:6px;
  color:var(--muted);font-size:.85rem;font-weight:600;
  padding:7px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);backdrop-filter:blur(8px);
  cursor:pointer;text-decoration:none;transition:all .2s;
}
.lg-back:hover{color:var(--bluel);border-color:rgba(96,165,250,.3);background:rgba(96,165,250,.07);}
/* Card */
.lg-card{
  position:relative;z-index:1;width:100%;max-width:420px;
  background:rgba(255,255,255,.035);
  border:1px solid rgba(255,255,255,.09);
  border-radius:24px;padding:40px 36px;
  backdrop-filter:blur(16px);
  animation:lgIn .45s cubic-bezier(.22,.68,0,1.2) both;
}
@keyframes lgIn{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
/* Logo area */
.lg-logo{text-align:center;margin-bottom:32px;}
.lg-icon{font-size:2.8rem;margin-bottom:12px;animation:lgBounce 2s ease-in-out infinite;}
@keyframes lgBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.lg-brand{font-size:1.5rem;font-weight:900;letter-spacing:-.03em;}
.lg-brand .ac{color:var(--bluel);}
.lg-tagline{color:var(--muted);font-size:.9rem;margin-top:6px;}
/* Badge */
.lg-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(37,99,235,.12);border:1px solid rgba(96,165,250,.22);
  border-radius:100px;padding:5px 14px;font-size:.75rem;
  color:var(--bluel);margin-bottom:28px;font-weight:600;
}
.lg-dot{width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 6px var(--green);animation:lgPl 2s ease-in-out infinite;}
@keyframes lgPl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.3)}}
/* Label */
.lg-lbl{display:block;font-size:.8rem;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;}
/* Input */
.lg-inp{
  width:100%;background:rgba(255,255,255,.06);
  border:1.5px solid rgba(255,255,255,.1);border-radius:12px;
  color:var(--white);font:600 1rem 'Heebo',sans-serif;
  padding:13px 16px;outline:none;direction:ltr;
  transition:border-color .2s,box-shadow .2s;
}
.lg-inp::placeholder{color:rgba(148,163,184,.5);font-weight:400;}
.lg-inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.18);}
/* Primary CTA button */
.lg-cta{
  width:100%;margin-top:14px;padding:15px;border-radius:13px;
  background:linear-gradient(135deg,var(--blue),var(--blue2));
  color:#fff;border:none;font:700 1.05rem 'Heebo',sans-serif;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;
  box-shadow:0 4px 20px rgba(37,99,235,.35);
  transition:all .25s;
}
.lg-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(37,99,235,.5);}
.lg-cta:disabled{opacity:.55;cursor:not-allowed;}
/* Hint text */
.lg-hint{margin-top:14px;font-size:.8rem;color:var(--muted);text-align:center;line-height:1.65;}
/* Divider */
.lg-div{height:1px;background:rgba(255,255,255,.07);margin:22px 0;}
/* WA step */
.lg-wa-step{text-align:center;padding:8px 0 12px;}
.lg-wa-icon{font-size:2.8rem;margin-bottom:14px;}
.lg-wa-title{font-size:1.1rem;font-weight:800;margin-bottom:8px;}
.lg-wa-sub{font-size:.88rem;color:var(--muted);line-height:1.65;margin-bottom:22px;}
.lg-wa-btn{
  display:inline-flex;align-items:center;gap:8px;padding:14px 28px;
  border-radius:13px;background:linear-gradient(135deg,#25D366,#1ebe5d);
  color:#fff;font:700 1rem 'Heebo',sans-serif;text-decoration:none;
  box-shadow:0 4px 20px rgba(37,211,102,.35);transition:all .25s;
}
.lg-wa-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(37,211,102,.5);}
/* Polling row */
.lg-poll{display:flex;align-items:center;justify-content:center;gap:8px;
  margin-top:18px;color:var(--muted);font-size:.85rem;}
.lg-spin{display:inline-block;width:15px;height:15px;border-radius:50%;
  border:2px solid rgba(96,165,250,.3);border-top-color:var(--bluel);
  animation:lgSpin .8s linear infinite;}
@keyframes lgSpin{to{transform:rotate(360deg)}}
/* OTP input */
.lg-otp{
  width:100%;background:rgba(255,255,255,.06);
  border:1.5px solid rgba(255,255,255,.1);border-radius:12px;
  color:var(--white);font:700 2rem 'Heebo',monospace;
  padding:16px;outline:none;direction:ltr;text-align:center;
  letter-spacing:0.55em;
  transition:border-color .2s,box-shadow .2s;
}
.lg-otp::placeholder{color:rgba(148,163,184,.3);letter-spacing:.15em;font-size:1.4rem;}
.lg-otp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.18);}
/* Ghost button */
.lg-ghost{
  width:100%;margin-top:12px;padding:10px;border-radius:10px;
  border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);
  color:var(--muted);font:.9rem 'Heebo',sans-serif;cursor:pointer;
  transition:all .2s;
}
.lg-ghost:hover{background:rgba(255,255,255,.07);color:var(--bluel);}
/* Steps indicator */
.lg-steps{display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:28px;}
.lg-s{width:24px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);transition:background .3s;}
.lg-s.on{background:var(--blue);}
/* Error */
.lg-err{margin-top:14px;padding:12px 14px;background:rgba(239,68,68,.1);
  border:1px solid rgba(239,68,68,.3);border-radius:10px;
  color:#FCA5A5;font-size:.85rem;animation:lgIn .3s ease both;}
/* Footer link */
.lg-ftr{position:relative;z-index:1;margin-top:24px;text-align:center;font-size:.8rem;color:var(--muted);}
.lg-ftr a{color:var(--bluel);text-decoration:none;font-weight:600;}
.lg-ftr a:hover{text-decoration:underline;}
/* Role selection */
.lg-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px;}
.lg-rc{padding:18px 10px;border-radius:14px;cursor:pointer;border:1.5px solid var(--cb);background:var(--card);text-align:center;color:var(--white);transition:all .2s;display:block;width:100%;font-family:'Heebo',sans-serif;}
.lg-rc:hover{transform:translateY(-2px);}
.lg-rc.pass:hover{background:rgba(37,99,235,.1);border-color:var(--blue);box-shadow:0 6px 22px rgba(37,99,235,.2);}
.lg-rc.drv:hover{background:rgba(34,197,94,.08);border-color:#22C55E;box-shadow:0 6px 22px rgba(34,197,94,.15);}
.lg-rc.taxi:hover{background:rgba(253,224,71,.06);border-color:#FDE047;box-shadow:0 6px 22px rgba(253,224,71,.1);}
.lg-rcico{font-size:1.8rem;margin-bottom:6px;}
.lg-rct{font-size:.82rem;font-weight:800;margin-bottom:3px;}
.lg-rcd{font-size:.7rem;color:var(--muted);line-height:1.4;}
.lg-role-hint{text-align:center;margin-top:14px;font-size:.8rem;color:var(--muted);}
/* WA choice modal */
.lg-modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(7,11,20,.75);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding-bottom:24px;animation:lgIn .25s ease both;}
.lg-modal{width:100%;max-width:400px;background:#0D1526;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px 24px;text-align:center;}
.lg-modal-title{font-size:1.1rem;font-weight:800;margin-bottom:6px;}
.lg-modal-sub{font-size:.82rem;color:var(--muted);margin-bottom:22px;line-height:1.6;}
.lg-modal-btns{display:flex;flex-direction:column;gap:10px;}
.lg-modal-btn{width:100%;padding:14px;border-radius:13px;border:none;font:700 .95rem 'Heebo',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;}
.lg-modal-btn.biz{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;box-shadow:0 4px 18px rgba(37,211,102,.35);}
.lg-modal-btn.biz:hover{transform:translateY(-2px);box-shadow:0 7px 24px rgba(37,211,102,.5);}
.lg-modal-btn.reg{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.25);color:#25D366;}
.lg-modal-btn.reg:hover{background:rgba(37,211,102,.18);}
.lg-modal-cancel{margin-top:12px;background:none;border:none;color:var(--muted);font:600 .82rem 'Heebo',sans-serif;cursor:pointer;}
`;
export default function Login() {
    const { requestWaAuth, cancelWaAuth, waSession, error, user, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [localErr, setLocalErr] = useState(null);
    const [selectedRole, setSelectedRole] = useState(() => {
        const urlRole = new URLSearchParams(window.location.search).get('role');
        return (urlRole === 'passenger' || urlRole === 'driver' || urlRole === 'taxi') ? urlRole : null;
    });
    const [waOpened, setWaOpened] = useState(false);
    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'lg-css';
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { document.getElementById('lg-css')?.remove(); };
    }, []);
    useEffect(() => {
        if (!loading && user) {
            const confirmedRole = localStorage.getItem('auth_role') || selectedRole || 'passenger';
            if (confirmedRole === 'driver' || confirmedRole === 'taxi') {
                navigate('/driver', { replace: true });
            }
            else {
                navigate('/app', { replace: true });
            }
        }
    }, [user, loading, navigate, selectedRole]);
    async function handleWaAuth() {
        if (!phone.trim())
            return;
        setBusy(true);
        setLocalErr(null);
        try {
            await requestWaAuth(phone.trim(), selectedRole ?? 'passenger');
        }
        catch (e) {
            setLocalErr(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    function handleOpenWhatsApp() {
        if (waSession?.whatsapp_link) {
            window.open(waSession.whatsapp_link, '_blank', 'noopener,noreferrer');
            setWaOpened(true);
        }
    }
    const err = localErr ?? error;
    return (_jsxs("div", { className: "lg", children: [_jsx("div", { className: "lg-bg" }), _jsx("div", { className: "lg-grid" }), _jsx("a", { href: "/", className: "lg-back", onClick: e => { e.preventDefault(); navigate('/'); }, children: "\u2190 \u05D7\u05D6\u05D5\u05E8 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA" }), _jsxs("div", { className: "lg-card", children: [_jsxs("div", { className: "lg-logo", children: [_jsx("div", { className: "lg-icon", children: "\uD83D\uDE95" }), _jsxs("div", { className: "lg-brand", children: [_jsx("span", { className: "ac", children: "Easy" }), "Taxi \u05D9\u05E9\u05E8\u05D0\u05DC"] }), _jsx("div", { className: "lg-tagline", children: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4 \u05D3\u05E8\u05DA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" })] }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: '26px' }, children: _jsxs("div", { className: "lg-steps", children: [!searchParams.get('role') && _jsx("div", { className: `lg-s ${selectedRole === null ? 'on' : ''}` }), _jsx("div", { className: `lg-s ${selectedRole !== null && !waSession ? 'on' : ''}` }), _jsx("div", { className: `lg-s ${waSession ? 'on' : ''}` })] }) }), _jsx("div", { style: { textAlign: 'center', marginBottom: '24px' }, children: _jsxs("span", { className: "lg-badge", children: [_jsx("span", { className: "lg-dot" }), "\u05E9\u05D9\u05E8\u05D5\u05EA \u05E4\u05E2\u05D9\u05DC 24/7"] }) }), selectedRole === null ? (
                    /* ── Step 0: role selection ── */
                    _jsxs("div", { children: [_jsx("div", { style: { textAlign: 'center', marginBottom: '16px' }, children: _jsx("div", { style: { fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }, children: "\u05D1\u05D7\u05E8 \u05EA\u05E4\u05E7\u05D9\u05D3" }) }), _jsxs("div", { className: "lg-roles", children: [_jsxs("button", { className: "lg-rc pass", onClick: () => setSelectedRole('passenger'), children: [_jsx("div", { className: "lg-rcico", children: "\uD83E\uDDD1\u200D\uD83D\uDCBC" }), _jsx("div", { className: "lg-rct", children: "\u05E0\u05D5\u05E1\u05E2" }), _jsx("div", { className: "lg-rcd", children: "\u05D4\u05D6\u05DE\u05E0\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4" })] }), _jsxs("button", { className: "lg-rc drv", onClick: () => setSelectedRole('driver'), children: [_jsx("div", { className: "lg-rcico", children: "\uD83D\uDE97" }), _jsx("div", { className: "lg-rct", children: "\u05E0\u05D4\u05D2 \u05E2\u05E6\u05DE\u05D0\u05D9" }), _jsx("div", { className: "lg-rcd", children: "\u05D7\u05D5\u05E7 2026" })] }), _jsxs("button", { className: "lg-rc taxi", onClick: () => setSelectedRole('taxi'), children: [_jsx("div", { className: "lg-rcico", children: "\uD83D\uDE95" }), _jsx("div", { className: "lg-rct", children: "\u05DE\u05D5\u05E0\u05D9\u05EA" }), _jsx("div", { className: "lg-rcd", children: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA" })] })] }), _jsxs("div", { className: "lg-role-hint", children: ["\u05DC\u05D0 \u05D1\u05D8\u05D5\u05D7? ", _jsx("a", { href: "/guest", style: { color: 'var(--bluel)', fontWeight: 700 }, children: "\u05E8\u05D0\u05D4 \u05DE\u05D9\u05D3\u05E2 \u2192" })] })] })) : !waSession ? (
                    /* ── Step 1: phone entry → WA auth ── */
                    _jsxs("div", { children: [_jsx("label", { className: "lg-lbl", children: "\u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF (\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4)" }), _jsx("input", { className: "lg-inp", type: "tel", placeholder: "05X-XXX-XXXX", value: phone, onChange: e => setPhone(e.target.value), onKeyDown: e => e.key === 'Enter' && handleWaAuth(), autoFocus: true }), _jsx("button", { className: "lg-cta", disabled: busy || !phone.trim(), onClick: handleWaAuth, children: busy
                                    ? _jsxs(_Fragment, { children: [_jsx("span", { className: "lg-spin" }), " \u05D9\u05D5\u05E6\u05E8 \u05E7\u05D9\u05E9\u05D5\u05E8\u2026"] })
                                    : _jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: '1.1rem' }, children: "\uD83D\uDCAC" }), " \u05DB\u05E0\u05D9\u05E1\u05D4 \u05D3\u05E8\u05DA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4"] }) }), _jsxs("p", { className: "lg-hint", children: ["\u05E0\u05E9\u05DC\u05D7 \u05DC\u05DA \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u2014 \u05DC\u05D7\u05E5 \u05E2\u05DC\u05D9\u05D5 \u05D5\u05E9\u05DC\u05D7 \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4.", _jsx("br", {}), "\u05DC\u05D0 \u05E6\u05E8\u05D9\u05DA \u05E7\u05D5\u05D3, \u05DC\u05D0 \u05E6\u05E8\u05D9\u05DA \u05E1\u05D9\u05E1\u05DE\u05D0. \u05D1\u05DC\u05D7\u05D9\u05E6\u05D4 \u05D0\u05D7\u05EA."] }), _jsx("div", { className: "lg-div" }), _jsx("div", { style: { textAlign: 'center', fontSize: '.85rem', color: 'var(--muted)', marginTop: '6px' }, children: _jsx("button", { onClick: () => setSelectedRole(null), style: { background: 'none', border: 'none', color: 'var(--bluel)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo', fontSize: '.85rem' }, children: "\u2190 \u05E9\u05E0\u05D4 \u05EA\u05E4\u05E7\u05D9\u05D3" }) })] })) : (
                    /* ── Step 2: WA pending — open WA + auto-poll ── */
                    _jsxs("div", { className: "lg-wa-step", children: [_jsx("div", { className: "lg-wa-icon", children: waOpened ? '⏳' : '💬' }), _jsx("div", { className: "lg-wa-title", children: waOpened ? 'ממתין לאימות…' : 'פתח וואטסאפ ושלח הודעה' }), _jsx("div", { className: "lg-wa-sub", children: waOpened
                                    ? 'שלחת את ההודעה? הכניסה תתבצע אוטומטית תוך שניות — לא צריך לעשות כלום.'
                                    : 'לחץ על הכפתור למטה. וואטסאפ ייפתח עם הודעה מוכנה — פשוט לחץ "שלח".' }), !waOpened ? (_jsxs("button", { className: "lg-wa-btn", onClick: handleOpenWhatsApp, style: { display: 'inline-flex', width: '100%', justifyContent: 'center' }, children: [_jsx("span", { style: { fontSize: '1.2rem' }, children: "\uD83D\uDCAC" }), "\u05E4\u05EA\u05D7 \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA"] })) : (_jsxs("div", { className: "lg-poll", children: [_jsx("span", { className: "lg-spin" }), "\u05DE\u05D7\u05DB\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8\u05DA\u2026"] })), waOpened && (_jsx("button", { className: "lg-wa-btn", onClick: handleOpenWhatsApp, style: { display: 'inline-flex', width: '100%', justifyContent: 'center', marginTop: 14, fontSize: '.88rem', padding: '11px 20px', background: 'rgba(37,211,102,.12)', color: '#25D366', boxShadow: 'none', border: '1px solid rgba(37,211,102,.3)' }, children: "\u05DC\u05D0 \u05E0\u05E4\u05EA\u05D7? \u05DC\u05D7\u05E5 \u05E9\u05D5\u05D1" })), _jsx("button", { className: "lg-ghost", style: { marginTop: 16 }, onClick: () => { cancelWaAuth(); setWaOpened(false); setPhone(''); }, children: "\u2190 \u05D7\u05D6\u05D5\u05E8 \u05D5\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1" })] })), err && (_jsxs("div", { className: "lg-err", children: ["\u26A0\uFE0F ", err] }))] }), _jsxs("div", { className: "lg-ftr", children: [_jsx("a", { href: "/guest", children: "\u05DE\u05D7\u05D9\u05E8\u05D9\u05DD \u05D5\u05DE\u05D9\u05D3\u05E2" }), ' · ', _jsx("a", { href: "https://wa.me/447474775344", target: "_blank", rel: "noopener noreferrer", children: "\u05EA\u05DE\u05D9\u05DB\u05D4" })] })] }));
}
