import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
export default function PassengerOnboarding({ user, onComplete }) {
    const navigate = useNavigate();
    const [step, setStep] = useState('name');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [tosChecked, setTosChecked] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const steps = ['name', 'email', 'tos'];
    const stepIndex = steps.indexOf(step);
    const progress = ((stepIndex + 1) / steps.length) * 100;
    async function handleFinish() {
        if (!tosChecked) {
            setError('יש לאשר את תנאי השימוש');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const updated = await api.auth.updateProfile({
                full_name: fullName.trim() || undefined,
                email: email.trim() || undefined,
            });
            onComplete(updated);
            navigate('/app', { replace: true });
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    function nextStep() {
        setError(null);
        if (step === 'name') {
            if (fullName.trim().length < 2) {
                setError('נא להזין שם מלא (לפחות 2 תווים)');
                return;
            }
            setStep('email');
        }
        else if (step === 'email') {
            // email is optional — skip validation if empty
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setError('כתובת אימייל לא תקינה');
                return;
            }
            setStep('tos');
        }
    }
    return (_jsxs("div", { style: {
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            background: 'var(--bg-primary)',
            padding: '1.5rem',
            maxWidth: 480,
            margin: '0 auto',
        }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '2rem', paddingTop: '2rem' }, children: [_jsx("div", { style: { fontSize: '3rem', marginBottom: '0.5rem' }, children: "\uD83D\uDE95" }), _jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }, children: "\u05D1\u05E8\u05D5\u05DA \u05D4\u05D1\u05D0 \u05DC-EasyTaxi" }), _jsx("p", { style: { color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.9rem' }, children: "\u05E0\u05E9\u05D0\u05DC \u05D0\u05D5\u05EA\u05DA \u05DB\u05DE\u05D4 \u05E9\u05D0\u05DC\u05D5\u05EA \u05E7\u05E6\u05E8\u05D5\u05EA \u05DC\u05E4\u05E0\u05D9 \u05E9\u05EA\u05EA\u05D7\u05D9\u05DC" })] }), _jsx("div", { style: {
                    background: 'var(--bg-elevated)',
                    borderRadius: 999,
                    height: 6,
                    marginBottom: '2rem',
                    overflow: 'hidden',
                }, children: _jsx("div", { style: {
                        height: '100%',
                        width: `${progress}%`,
                        background: 'var(--accent)',
                        borderRadius: 999,
                        transition: 'width 0.4s ease',
                    } }) }), _jsxs("div", { className: "card", style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }, children: [step === 'name' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }, children: "\u05E9\u05DC\u05D1 1 \u05DE\u05EA\u05D5\u05DA 3" }), _jsx("h2", { style: { fontSize: '1.2rem', fontWeight: 700 }, children: "\u05DE\u05D4 \u05D4\u05E9\u05DD \u05E9\u05DC\u05DA?" }), _jsx("p", { style: { color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }, children: "\u05D4\u05E0\u05D4\u05D2 \u05D9\u05E8\u05D0\u05D4 \u05D0\u05EA \u05E9\u05DE\u05DA \u05DB\u05E9\u05D9\u05D2\u05D9\u05E2 \u05DC\u05D0\u05E1\u05D5\u05E3 \u05D0\u05D5\u05EA\u05DA" })] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }, children: "\u05E9\u05DD \u05DE\u05DC\u05D0" }), _jsx("input", { className: "input", type: "text", placeholder: "\u05D9\u05E9\u05E8\u05D0\u05DC \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9", value: fullName, onChange: e => setFullName(e.target.value), onKeyDown: e => e.key === 'Enter' && nextStep(), autoFocus: true, maxLength: 120 })] })] })), step === 'email' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }, children: "\u05E9\u05DC\u05D1 2 \u05DE\u05EA\u05D5\u05DA 3" }), _jsx("h2", { style: { fontSize: '1.2rem', fontWeight: 700 }, children: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC" }), _jsx("p", { style: { color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }, children: "\u05DC\u05E7\u05D1\u05DC\u05EA \u05E7\u05D1\u05DC\u05D5\u05EA \u05E2\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)" })] }), _jsxs("div", { children: [_jsxs("label", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }, children: ["\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC ", _jsx("span", { style: { color: 'var(--text-secondary)', fontWeight: 400 }, children: "(\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)" })] }), _jsx("input", { className: "input", type: "email", placeholder: "name@example.com", value: email, onChange: e => setEmail(e.target.value), onKeyDown: e => e.key === 'Enter' && nextStep(), autoFocus: true, maxLength: 254, style: { direction: 'ltr', textAlign: 'right' } })] })] })), step === 'tos' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }, children: "\u05E9\u05DC\u05D1 3 \u05DE\u05EA\u05D5\u05DA 3" }), _jsx("h2", { style: { fontSize: '1.2rem', fontWeight: 700 }, children: "\u05EA\u05E0\u05D0\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9" }), _jsx("p", { style: { color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }, children: "\u05E7\u05E8\u05D0 \u05D5\u05D0\u05E9\u05E8 \u05DC\u05E4\u05E0\u05D9 \u05E9\u05EA\u05EA\u05D7\u05D9\u05DC \u05DC\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E9\u05D9\u05E8\u05D5\u05EA" })] }), _jsxs("div", { style: {
                                    background: 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '1rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.6,
                                    maxHeight: 180,
                                    overflowY: 'auto',
                                }, children: [_jsx("strong", { style: { color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }, children: "\u05E2\u05D9\u05E7\u05E8\u05D9 \u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9:" }), _jsxs("ul", { style: { paddingRight: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }, children: [_jsx("li", { children: "\u05D4\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4 \u05DE\u05D7\u05D1\u05E8\u05EA \u05D1\u05D9\u05DF \u05E0\u05D5\u05E1\u05E2\u05D9\u05DD \u05DC\u05E0\u05D4\u05D2\u05D9\u05DD \u05DE\u05D5\u05E8\u05E9\u05D9\u05DD \u05D1\u05DC\u05D1\u05D3" }), _jsx("li", { children: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05EA\u05D1\u05E6\u05E2 \u05D1\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u2014 \u05D0\u05D9\u05DF \u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D6\u05D5\u05DE\u05DF \u05DC\u05E0\u05D4\u05D2" }), _jsx("li", { children: "\u05D3\u05DE\u05D9 \u05D1\u05D9\u05D8\u05D5\u05DC \u05D7\u05DC\u05D9\u05DD \u05E2\u05DC \u05E0\u05E1\u05D9\u05E2\u05D4 \u05E9\u05D1\u05D5\u05D8\u05DC\u05D4 \u05DC\u05D0\u05D7\u05E8 3 \u05D3\u05E7\u05D5\u05EA \u05DE\u05D0\u05D9\u05E9\u05D5\u05E8\u05D4" }), _jsx("li", { children: "\u05D4\u05DE\u05D9\u05D3\u05E2 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05DA \u05E9\u05DE\u05D5\u05E8 \u05D1\u05D4\u05E6\u05E4\u05E0\u05D4 \u05D5\u05DC\u05D0 \u05D9\u05D5\u05E2\u05D1\u05E8 \u05DC\u05E6\u05D3\u05D3\u05D9\u05DD \u05E9\u05DC\u05D9\u05E9\u05D9\u05D9\u05DD" }), _jsx("li", { children: "\u05E9\u05D9\u05DE\u05D5\u05E9 \u05DC\u05E8\u05E2\u05D4 \u05D1\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4 \u05D9\u05D2\u05E8\u05D5\u05E8 \u05D7\u05E1\u05D9\u05DE\u05EA \u05D7\u05E9\u05D1\u05D5\u05DF" })] })] }), _jsxs("label", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    cursor: 'pointer',
                                    padding: '0.75rem',
                                    background: tosChecked ? 'rgba(255,215,0,0.08)' : 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${tosChecked ? 'var(--accent)' : 'var(--border)'}`,
                                    transition: 'all 0.2s',
                                }, children: [_jsx("input", { type: "checkbox", checked: tosChecked, onChange: e => setTosChecked(e.target.checked), style: { width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' } }), _jsxs("span", { style: { fontSize: '0.9rem' }, children: ["\u05E7\u05E8\u05D0\u05EA\u05D9 \u05D5\u05D0\u05E0\u05D9 \u05DE\u05E1\u05DB\u05D9\u05DD/\u05D4 \u05DC", _jsx("a", { href: "/faq", target: "_blank", rel: "noopener noreferrer", style: { color: 'var(--accent)', marginRight: '0.25rem' }, children: "\u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9" })] })] })] })), step === 'tos' && (_jsxs("div", { style: {
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem 1rem',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                        }, children: [_jsxs("div", { children: ["\uD83D\uDCF1 ", user.phone] }), fullName && _jsxs("div", { children: ["\uD83D\uDC64 ", fullName] }), email && _jsxs("div", { children: ["\uD83D\uDCE7 ", email] })] })), error && (_jsx("div", { style: {
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem',
                            color: 'var(--danger)',
                            fontSize: '0.875rem',
                        }, children: error })), _jsxs("div", { style: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }, children: [step !== 'tos' ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn-primary", style: { width: '100%' }, onClick: nextStep, children: "\u05D4\u05DE\u05E9\u05DA \u2190" }), step === 'email' && (_jsx("button", { className: "btn btn-secondary", style: { width: '100%' }, onClick: () => { setEmail(''); nextStep(); }, children: "\u05D3\u05DC\u05D2" }))] })) : (_jsx("button", { className: "btn btn-primary", style: { width: '100%' }, onClick: handleFinish, disabled: busy || !tosChecked, children: busy ? 'שומר…' : 'בואו נתחיל 🚕' })), stepIndex > 0 && (_jsx("button", { className: "btn", style: { color: 'var(--text-secondary)', fontSize: '0.85rem' }, onClick: () => { setError(null); setStep(steps[stepIndex - 1]); }, children: "\u2190 \u05D7\u05D6\u05D5\u05E8" }))] })] })] }));
}
