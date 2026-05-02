import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
export default function Profile() {
    const { user, updateUser, logout } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState(user?.full_name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);
    async function handleSave() {
        if (!fullName.trim()) {
            setError('נא להזין שם מלא');
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('כתובת אימייל לא תקינה');
            return;
        }
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
            const updated = await api.auth.updateProfile({
                full_name: fullName.trim() || undefined,
                email: email.trim() || undefined,
            });
            updateUser(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    function handleLogout() {
        logout();
        navigate('/login', { replace: true });
    }
    if (!user)
        return null;
    /* ── Inline CSS matching the dark-navy design used in Login.tsx ── */
    const CSS = `
.prf *{box-sizing:border-box;margin:0;padding:0;}
.prf{
  min-height:100vh;background:#070B14;color:#F1F5F9;
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
  display:flex;flex-direction:column;align-items:center;
  padding:0 16px 40px;position:relative;overflow-x:hidden;
}
.prf-bg{position:fixed;inset:0;z-index:0;
  background:radial-gradient(ellipse 90% 60% at 50% 0%,rgba(37,99,235,.18) 0%,transparent 65%),
             linear-gradient(180deg,#070B14 0%,#0C1322 100%);
}
.prf-header{
  position:sticky;top:0;z-index:10;
  width:100%;max-width:480px;
  background:rgba(7,11,20,.85);backdrop-filter:blur(12px);
  border-bottom:1px solid rgba(255,255,255,.07);
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 0;
}
.prf-back{background:none;border:none;color:#94A3B8;font:600 .9rem 'Heebo',sans-serif;cursor:pointer;display:flex;align-items:center;gap:4px;}
.prf-back:hover{color:#60A5FA;}
.prf-title{font-size:1rem;font-weight:800;}
.prf-body{position:relative;z-index:1;width:100%;max-width:480px;display:flex;flex-direction:column;gap:16px;padding-top:24px;}
.prf-card{
  background:rgba(255,255,255,.035);
  border:1px solid rgba(255,255,255,.09);
  border-radius:16px;padding:20px;
}
.prf-label{display:block;font-size:.72rem;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
.prf-readonly{
  padding:11px 14px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.07);border-radius:10px;
  color:#64748B;font-size:.9rem;direction:ltr;text-align:right;
  display:flex;align-items:center;gap:8px;
}
.prf-hint{font-size:.7rem;color:#475569;margin-top:5px;}
.prf-inp{
  width:100%;background:rgba(255,255,255,.06);
  border:1.5px solid rgba(255,255,255,.1);border-radius:10px;
  color:#F1F5F9;font:400 .95rem 'Heebo',sans-serif;
  padding:11px 14px;outline:none;
  transition:border-color .2s,box-shadow .2s;
}
.prf-inp:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.15);}
.prf-inp::placeholder{color:rgba(148,163,184,.4);}
.prf-btn{
  width:100%;margin-top:4px;padding:13px;border-radius:11px;
  background:linear-gradient(135deg,#2563EB,#1D4ED8);
  color:#fff;border:none;font:700 1rem 'Heebo',sans-serif;cursor:pointer;
  transition:all .2s;
}
.prf-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(37,99,235,.4);}
.prf-btn:disabled{opacity:.55;cursor:not-allowed;}
.prf-ghost{
  width:100%;padding:11px;border-radius:11px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
  color:#94A3B8;font:.88rem 'Heebo',sans-serif;cursor:pointer;
  transition:all .2s;
}
.prf-ghost:hover{background:rgba(255,255,255,.08);}
.prf-danger{color:#F87171 !important;border-color:rgba(248,113,113,.2) !important;}
.prf-danger:hover{background:rgba(248,113,113,.06) !important;}
.prf-success{padding:10px 14px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:10px;color:#4ADE80;font-size:.85rem;}
.prf-error{padding:10px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:10px;color:#FCA5A5;font-size:.85rem;}
.prf-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.85rem;}
.prf-row:last-child{border-bottom:none;}
`;
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: CSS }), _jsxs("div", { className: "prf", children: [_jsx("div", { className: "prf-bg" }), _jsxs("div", { className: "prf-header", children: [_jsx("button", { className: "prf-back", onClick: () => navigate(-1), children: "\u2190 \u05D7\u05D6\u05D5\u05E8" }), _jsx("span", { className: "prf-title", children: "\u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05D9" }), _jsx("div", { style: { width: 56 } })] }), _jsxs("div", { className: "prf-body", children: [_jsxs("div", { style: { textAlign: 'center', padding: '8px 0' }, children: [_jsx("div", { style: {
                                            width: 68, height: 68, borderRadius: '50%',
                                            background: 'rgba(37,99,235,.15)',
                                            border: '2px solid rgba(37,99,235,.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem', margin: '0 auto 8px',
                                        }, children: "\uD83E\uDDD1\u200D\uD83D\uDCBC" }), _jsx("div", { style: { fontWeight: 700 }, children: user.full_name ?? 'נוסע' })] }), _jsxs("div", { className: "prf-card", children: [_jsx("label", { className: "prf-label", children: "\u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF" }), _jsxs("div", { className: "prf-readonly", children: [_jsx("span", { children: "\uD83D\uDD12" }), _jsxs("span", { children: ["+", user.phone] })] }), _jsx("div", { className: "prf-hint", children: "\u05DE\u05E9\u05DE\u05E9 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05D5\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9" })] }), _jsxs("div", { className: "prf-card", style: { display: 'flex', flexDirection: 'column', gap: '14px' }, children: [_jsxs("div", { children: [_jsx("label", { className: "prf-label", children: "\u05E9\u05DD \u05DE\u05DC\u05D0" }), _jsx("input", { className: "prf-inp", type: "text", placeholder: "\u05D9\u05E9\u05E8\u05D0\u05DC \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9", value: fullName, onChange: e => setFullName(e.target.value), onKeyDown: e => e.key === 'Enter' && handleSave() })] }), _jsxs("div", { children: [_jsxs("label", { className: "prf-label", children: ["\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC ", _jsx("span", { style: { fontWeight: 400, textTransform: 'none' }, children: "(\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)" })] }), _jsx("input", { className: "prf-inp", type: "email", placeholder: "example@gmail.com", value: email, onChange: e => setEmail(e.target.value), dir: "ltr" })] }), error && _jsxs("div", { className: "prf-error", children: ["\u26A0\uFE0F ", error] }), saved && _jsx("div", { className: "prf-success", children: "\u2705 \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4" }), _jsx("button", { className: "prf-btn", disabled: busy, onClick: handleSave, children: busy ? 'שומר…' : 'שמור שינויים' })] }), _jsxs("div", { className: "prf-card", children: [_jsx("div", { style: { fontWeight: 700, marginBottom: '10px', fontSize: '.9rem' }, children: "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D7\u05E9\u05D1\u05D5\u05DF" }), _jsxs("div", { className: "prf-row", children: [_jsx("span", { style: { color: '#64748B' }, children: "\u05EA\u05E4\u05E7\u05D9\u05D3" }), _jsx("span", { children: user.role === 'driver' ? '🚗 נהג' : user.role === 'admin' ? '🔑 מנהל' : '🧑‍💼 נוסע' })] }), _jsxs("div", { className: "prf-row", children: [_jsx("span", { style: { color: '#64748B' }, children: "\u05E1\u05D8\u05D8\u05D5\u05E1" }), _jsx("span", { children: user.auth_status === 'approved' ? '✅ מאושר' : user.auth_status === 'persona_completed' ? '⏳ ממתין לאישור' : user.auth_status === 'persona_in_progress' ? '📋 בתהליך אימות' : '⏳ ממתין' })] })] }), user.role === 'passenger' && (_jsxs("div", { style: {
                                    background: 'linear-gradient(135deg,rgba(34,197,94,.08) 0%,rgba(22,163,74,.04) 100%)',
                                    border: '1px solid rgba(34,197,94,.2)', borderRadius: 14, padding: '18px 16px',
                                }, children: [_jsx("div", { style: { fontWeight: 800, fontSize: '1rem', marginBottom: 6, color: '#F1F5F9' }, children: "\uD83D\uDE97 \u05D4\u05E4\u05D5\u05DA \u05DC\u05E0\u05D4\u05D2 \u05E9\u05D9\u05EA\u05D5\u05E4\u05D9!" }), _jsxs("div", { style: { fontSize: '.82rem', color: '#94A3B8', lineHeight: 1.65, marginBottom: 14 }, children: ["\u05D7\u05D5\u05E7 \u05E9\u05D9\u05EA\u05D5\u05E3 \u05D4\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA (\u05D7\u05D5\u05E7 \u05D4\u05D5\u05D1\u05E8) \u05D1\u05D3\u05E8\u05DA!", _jsx("br", {}), "\u05D4\u05D2\u05E9 \u05D1\u05E7\u05E9\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5, \u05E7\u05D1\u05DC \u05D0\u05D9\u05E9\u05D5\u05E8 \u05DE\u05E8\u05D0\u05E9 \u2014 \u05D5\u05EA\u05EA\u05D7\u05D9\u05DC \u05DC\u05E0\u05D4\u05D5\u05D2 \u05DE\u05D4\u05D9\u05D5\u05DD \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF."] }), _jsx("button", { onClick: () => navigate('/become-driver'), style: {
                                            width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                                            background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff',
                                            fontFamily: "'Heebo','Segoe UI',sans-serif", fontWeight: 800, fontSize: '.9rem',
                                            cursor: 'pointer', boxShadow: '0 3px 14px rgba(34,197,94,.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        }, children: "\u05D4\u05E6\u05D8\u05E8\u05E3 \u05DB\u05E0\u05D4\u05D2 \u2190" })] })), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsx("a", { href: "https://wa.me/447474775344", target: "_blank", rel: "noopener noreferrer", className: "prf-ghost", style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', color: '#25D366', borderColor: 'rgba(37,211,102,.2)' }, children: "\uD83D\uDCAC \u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-WhatsApp" }), _jsx("button", { className: "prf-ghost prf-danger", onClick: handleLogout, children: "\u05D4\u05EA\u05E0\u05EA\u05E7" })] })] })] })] }));
}
