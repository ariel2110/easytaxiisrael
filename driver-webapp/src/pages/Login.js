import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
export default function Login() {
    const { requestWaAuth, cancelWaAuth, waSession, error } = useAuth();
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [localErr, setLocalErr] = useState(null);
    async function handleRequest() {
        if (!phone.trim())
            return;
        setBusy(true);
        setLocalErr(null);
        try {
            await requestWaAuth(phone.trim());
        }
        catch (e) {
            setLocalErr(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "page", style: { justifyContent: 'center', alignItems: 'center', padding: '2rem' }, children: _jsxs("div", { className: "card slide-in", style: { width: '100%', maxWidth: 380 }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '2rem' }, children: [_jsx("div", { style: { fontSize: '2rem' }, children: "\uD83D\uDE97" }), _jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }, children: "EasyTaxi Driver" }), _jsx("p", { style: { color: 'var(--text-secondary)', marginTop: '0.25rem' }, children: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4 \u05D3\u05E8\u05DA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" })] }), !waSession ? (
                /* ── Step 1: enter phone ── */
                _jsxs(_Fragment, { children: [_jsx("label", { style: { display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }, children: "\u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF (\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4)" }), _jsx("input", { className: "input", type: "tel", placeholder: "05X-XXX-XXXX", value: phone, onChange: (e) => setPhone(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleRequest(), dir: "ltr" }), _jsx("button", { className: "btn btn-primary", style: { width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }, disabled: busy, onClick: handleRequest, children: busy ? 'שולח…' : _jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: '1.1rem' }, children: "\uD83D\uDCAC" }), " \u05DB\u05E0\u05D9\u05E1\u05D4 \u05D3\u05E8\u05DA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4"] }) }), _jsx("p", { style: { marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }, children: "\u05EA\u05E7\u05D1\u05DC \u05E7\u05D9\u05E9\u05D5\u05E8 \u05E9\u05D9\u05E4\u05EA\u05D7 \u05D0\u05EA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05E2\u05DD \u05D4\u05D5\u05D3\u05E2\u05D4 \u05DE\u05D5\u05DB\u05E0\u05D4 \u2014 \u05E4\u05E9\u05D5\u05D8 \u05E9\u05DC\u05D7 \u05D0\u05D5\u05EA\u05D4 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA" })] })) : (
                /* ── Step 2: open WhatsApp + poll ── */
                _jsxs(_Fragment, { children: [_jsxs("div", { style: { textAlign: 'center', padding: '1rem 0' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '0.75rem' }, children: "\uD83D\uDCAC" }), _jsx("p", { style: { fontWeight: 600, marginBottom: '0.5rem' }, children: "\u05E4\u05EA\u05D7 \u05D0\u05EA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05D5\u05E9\u05DC\u05D7 \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4" }), _jsx("p", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }, children: "\u05DC\u05D7\u05E5 \u05E2\u05DC \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u2014 \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05DB\u05D1\u05E8 \u05DE\u05D5\u05DB\u05E0\u05D4 \u05DC\u05E9\u05DC\u05D9\u05D7\u05D4. \u05DC\u05D0\u05D7\u05E8 \u05D4\u05E9\u05DC\u05D9\u05D7\u05D4 \u05EA\u05D9\u05DB\u05E0\u05E1 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA." }), _jsxs("a", { href: waSession.whatsapp_link, target: "_blank", rel: "noopener noreferrer", className: "btn btn-primary", style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        textDecoration: 'none',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius)',
                                    }, children: [_jsx("span", { children: "\uD83D\uDCF2" }), " \u05E4\u05EA\u05D7 \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA"] })] }), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                marginTop: '1.25rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.85rem',
                            }, children: [_jsx("span", { style: {
                                        width: 14,
                                        height: 14,
                                        border: '2px solid currentColor',
                                        borderTopColor: 'transparent',
                                        borderRadius: '50%',
                                        display: 'inline-block',
                                        animation: 'spin 1s linear infinite',
                                    } }), "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8\u2026"] }), _jsx("button", { style: {
                                width: '100%',
                                marginTop: '1rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                padding: '0.5rem',
                            }, onClick: cancelWaAuth, children: "\u2190 \u05D7\u05D6\u05D5\u05E8" })] })), (localErr ?? error) && (_jsx("div", { className: "fade-in", style: {
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(239,68,68,.1)',
                        border: '1px solid rgba(239,68,68,.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--danger)',
                        fontSize: '0.875rem',
                    }, children: localErr ?? error }))] }) }));
}
