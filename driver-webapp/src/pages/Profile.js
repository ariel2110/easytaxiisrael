import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
export default function Profile() {
    const { user, logout } = useAuth();
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
            await api.auth.updateProfile({
                full_name: fullName.trim() || undefined,
                email: email.trim() || undefined,
            });
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
    return (_jsxs("div", { style: {
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            background: 'var(--bg-primary)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                }, children: [_jsx("button", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)' }, onClick: () => navigate(-1), children: "\u2190 \u05D7\u05D6\u05D5\u05E8" }), _jsx("span", { style: { fontWeight: 700 }, children: "\u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05D9" }), _jsx("div", { style: { width: 48 } })] }), _jsxs("div", { style: { padding: '1.5rem', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }, children: [_jsxs("div", { style: { textAlign: 'center', paddingTop: '0.5rem' }, children: [_jsx("div", { style: {
                                    width: 72, height: 72, borderRadius: '50%',
                                    background: 'rgba(99,102,241,0.15)',
                                    border: '2px solid var(--accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2rem', margin: '0 auto 0.5rem',
                                }, children: "\uD83D\uDE97" }), _jsx("div", { style: { fontWeight: 700, fontSize: '1rem' }, children: user.full_name ?? 'נהג' }), _jsx("div", { style: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }, children: user.driver_type === 'licensed_taxi' ? '🚕 נהג מונית' : '🚗 נהג עצמאי' })] }), _jsxs("div", { className: "card", children: [_jsx("label", { style: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "\u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF" }), _jsxs("div", { style: {
                                    padding: '0.7rem 0.875rem',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.95rem',
                                    direction: 'ltr',
                                    textAlign: 'right',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }, children: [_jsx("span", { children: "\uD83D\uDD12" }), _jsxs("span", { children: ["+", user.phone] })] }), _jsx("div", { style: { fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }, children: "\u05DE\u05E1\u05E4\u05E8 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DE\u05E9\u05DE\u05E9 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05D5\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9" })] }), _jsxs("div", { className: "card", style: { display: 'flex', flexDirection: 'column', gap: '1rem' }, children: [_jsxs("div", { children: [_jsx("label", { style: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: "\u05E9\u05DD \u05DE\u05DC\u05D0" }), _jsx("input", { className: "input", type: "text", placeholder: "\u05D9\u05E9\u05E8\u05D0\u05DC \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9", value: fullName, onChange: e => setFullName(e.target.value), onKeyDown: e => e.key === 'Enter' && handleSave() })] }), _jsxs("div", { children: [_jsxs("label", { style: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: ["\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC ", _jsx("span", { style: { fontWeight: 400, textTransform: 'none' }, children: "(\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)" })] }), _jsx("input", { className: "input", type: "email", placeholder: "example@gmail.com", value: email, onChange: e => setEmail(e.target.value), dir: "ltr" })] }), error && (_jsx("div", { style: {
                                    padding: '0.6rem 0.75rem',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--danger)',
                                    fontSize: '0.85rem',
                                }, children: error })), saved && (_jsx("div", { style: {
                                    padding: '0.6rem 0.75rem',
                                    background: 'rgba(34,197,94,0.1)',
                                    border: '1px solid rgba(34,197,94,0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--success)',
                                    fontSize: '0.85rem',
                                }, children: "\u2705 \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4" })), _jsx("button", { className: "btn btn-primary", disabled: busy, onClick: handleSave, children: busy ? 'שומר…' : 'שמור שינויים' })] }), _jsxs("div", { className: "card", style: { fontSize: '0.85rem' }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.9rem' }, children: "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D7\u05E9\u05D1\u05D5\u05DF" }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }, children: [_jsx("span", { style: { color: 'var(--text-secondary)' }, children: "\u05E1\u05D8\u05D8\u05D5\u05E1" }), _jsx("span", { children: user.auth_status === 'approved' ? '✅ מאושר' :
                                            user.auth_status === 'persona_completed' ? '⏳ ממתין לאישור' :
                                                user.auth_status === 'persona_in_progress' ? '🔄 KYC בתהליך' :
                                                    '⚠️ ממתין לאימות' })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }, children: [_jsx("span", { style: { color: 'var(--text-secondary)' }, children: "\u05E1\u05D5\u05D2 \u05E0\u05D4\u05D2" }), _jsx("span", { children: user.driver_type === 'licensed_taxi' ? 'מונית מורשית' : user.driver_type === 'rideshare' ? 'שיתוף נסיעות' : 'לא הוגדר' })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }, children: [_jsx("a", { href: "https://wa.me/447474775344", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textAlign: 'center', color: '#25D366', fontSize: '0.85rem' }, children: "\uD83D\uDCAC \u05E4\u05E0\u05D4 \u05DC\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-WhatsApp" }), _jsx("button", { className: "btn", style: { color: 'var(--danger)', fontSize: '0.85rem' }, onClick: handleLogout, children: "\u05D4\u05EA\u05E0\u05EA\u05E7" })] })] })] }));
}
