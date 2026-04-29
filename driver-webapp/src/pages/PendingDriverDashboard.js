import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const STATUS_STEPS = [
    { key: 'whatsapp_verified', label: 'אימות WhatsApp', icon: '✅' },
    { key: 'persona_in_progress', label: 'KYC — בתהליך אימות', icon: '🔄' },
    { key: 'persona_completed', label: 'KYC הושלם — ממתין לאישור', icon: '⏳' },
    { key: 'approved', label: 'חשבון מאושר', icon: '🎉' },
];
const STATUS_INDEX = {
    pending: 0,
    whatsapp_verified: 1,
    persona_in_progress: 2,
    persona_completed: 3,
    approved: 4,
};
const STATUS_MESSAGE = {
    pending: {
        title: 'ממתין לאימות',
        body: 'אמת את מספר הטלפון שלך דרך WhatsApp כדי להמשיך.',
        color: 'var(--warning)',
    },
    whatsapp_verified: {
        title: 'WhatsApp מאומת ✓',
        body: 'עלייך להשלים אימות זהות (KYC) — לחץ על הכפתור למטה.',
        color: 'var(--accent)',
    },
    persona_in_progress: {
        title: 'אימות זהות בתהליך',
        body: 'הגשת את המסמכים שלך. הצוות שלנו בוחן אותם — זה לוקח עד 24 שעות.',
        color: 'var(--warning)',
    },
    persona_completed: {
        title: 'KYC הושלם — ממתין לאישור ידני',
        body: 'מסמכיך התקבלו ועוברים בדיקה אחרונה על ידי הצוות. נעדכן אותך ב-WhatsApp.',
        color: 'var(--warning)',
    },
};
export default function PendingDriverDashboard({ user, onLogout }) {
    const navigate = useNavigate();
    const statusIdx = STATUS_INDEX[user.auth_status] ?? 0;
    const info = STATUS_MESSAGE[user.auth_status];
    const kycUrl = localStorage.getItem('kyc_url');
    const [kycLoading, setKycLoading] = useState(false);
    function handleLogout() {
        onLogout();
        navigate('/login');
    }
    function handleStartKyc() {
        if (!kycUrl)
            return;
        setKycLoading(true);
        // Parse inquiry-id and session-token from stored KYC URL
        let inquiryId = null;
        let sessionToken = null;
        try {
            const parsed = new URL(kycUrl);
            inquiryId = parsed.searchParams.get('inquiry-id');
            sessionToken = parsed.searchParams.get('session-token');
        }
        catch {
            window.location.href = kycUrl;
            return;
        }
        if (!inquiryId) {
            window.location.href = kycUrl;
            return;
        }
        const capturedInquiryId = inquiryId;
        const capturedSessionToken = sessionToken;
        function launchPersonaClient() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const PersonaLib = window.Persona;
            if (!PersonaLib?.Client) {
                window.location.href = kycUrl;
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const clientOptions = {
                inquiryId: capturedInquiryId,
                frameWidth: '100%',
                frameHeight: '100%',
                onReady: () => {
                    setKycLoading(false);
                    client.open();
                },
                onComplete: () => {
                    navigate('/kyc/done');
                },
                onCancel: () => {
                    setKycLoading(false);
                },
                onError: () => {
                    setKycLoading(false);
                    window.location.href = kycUrl;
                },
            };
            if (capturedSessionToken)
                clientOptions.sessionToken = capturedSessionToken;
            const client = new PersonaLib.Client(clientOptions);
        }
        // If SDK already loaded, launch immediately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (window.Persona?.Client) {
            launchPersonaClient();
            return;
        }
        // Dynamically load the Persona embedded SDK from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.withpersona.com/dist/persona-v5-latest.js';
        script.onload = launchPersonaClient;
        script.onerror = () => {
            setKycLoading(false);
            // Fallback: direct redirect if CDN unreachable
            window.location.href = kycUrl;
        };
        document.head.appendChild(script);
    }
    // ── KYC Transition overlay ──────────────────────────────────
    if (kycLoading) {
        return (_jsxs("div", { style: {
                direction: 'rtl',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100dvh',
                background: 'var(--bg-primary)',
                gap: '1.5rem',
                padding: '2rem',
            }, children: [_jsx("div", { style: { fontSize: '3.5rem' }, children: "\uD83D\uDD10" }), _jsx("h2", { style: { fontWeight: 800, fontSize: '1.4rem', margin: 0 }, children: "\u05DE\u05E2\u05D1\u05D9\u05E8 \u05D0\u05D5\u05EA\u05DA \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA" }), _jsxs("p", { style: { color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.95rem', maxWidth: 320, lineHeight: 1.6, margin: 0 }, children: ["\u05D0\u05E0\u05D7\u05E0\u05D5 \u05DE\u05D7\u05D1\u05E8\u05D9\u05DD \u05D0\u05D5\u05EA\u05DA \u05DC\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7 \u05E9\u05DC ", _jsx("strong", { children: "Persona" }), ".", _jsx("br", {}), "\u05EA\u05D5\u05E2\u05D1\u05E8 \u05E2\u05D5\u05D3 \u05E8\u05D2\u05E2\u2026"] }), _jsx("div", { style: {
                        width: 48,
                        height: 48,
                        border: '4px solid var(--border)',
                        borderTopColor: 'var(--accent)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    } }), _jsx("p", { style: { color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }, children: "\u05EA\u05E6\u05D8\u05E8\u05DA: \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA / \u05D3\u05E8\u05DB\u05D5\u05DF \u2022 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05D4\u05D9\u05D2\u05D4 \u2022 \u05E1\u05DC\u05E4\u05D9" })] }));
    }
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
                }, children: [_jsx("span", { style: { fontWeight: 700, fontSize: '1rem' }, children: "\uD83D\uDE95 EasyTaxi \u2014 \u05E0\u05D4\u05D2" }), _jsx("button", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, onClick: handleLogout, children: "\u05D4\u05EA\u05E0\u05EA\u05E7" })] }), _jsxs("div", { style: { padding: '1.5rem', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }, children: [info && (_jsxs("div", { className: "card", style: { borderColor: info.color, background: `${info.color}11` }, children: [_jsx("div", { style: { fontWeight: 700, color: info.color, marginBottom: '0.4rem', fontSize: '1.05rem' }, children: info.title }), _jsx("div", { style: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }, children: info.body })] })), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }, children: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05D4\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' }, children: STATUS_STEPS.map((step, i) => {
                                    const done = statusIdx > i + 1;
                                    const active = statusIdx === i + 1;
                                    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsx("div", { style: {
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.9rem',
                                                    flexShrink: 0,
                                                    background: done
                                                        ? 'rgba(34,197,94,0.15)'
                                                        : active
                                                            ? 'rgba(99,102,241,0.15)'
                                                            : 'var(--bg-elevated)',
                                                    border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                                                    color: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--text-secondary)',
                                                }, children: done ? '✓' : active ? step.icon : String(i + 1) }), _jsxs("div", { children: [_jsx("div", { style: {
                                                            fontSize: '0.875rem',
                                                            fontWeight: active || done ? 600 : 400,
                                                            color: done ? 'var(--success)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        }, children: step.label }), active && (_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.15rem' }, children: "\u05E9\u05DC\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9" }))] })] }, step.key));
                                }) })] }), (user.auth_status === 'whatsapp_verified') && kycUrl && (_jsx("button", { className: "btn btn-primary", style: { width: '100%', textAlign: 'center' }, onClick: handleStartKyc, children: "\uD83D\uDD10 \u05D4\u05EA\u05D7\u05DC \u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA (KYC) \u2192" })), (user.auth_status === 'whatsapp_verified' || user.auth_status === 'pending') && (_jsxs("div", { className: "card", children: [_jsx("h3", { style: { fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }, children: "\uD83D\uDCCB \u05DE\u05D4 \u05EA\u05E6\u05D8\u05E8\u05DA \u05DC\u05D0\u05DE\u05EA" }), _jsxs("ul", { style: {
                                    paddingRight: '1.2rem',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.85rem',
                                    lineHeight: 1.9,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.1rem',
                                }, children: [_jsx("li", { children: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA \u05D0\u05D5 \u05D3\u05E8\u05DB\u05D5\u05DF" }), _jsx("li", { children: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05D4\u05D9\u05D2\u05D4 \u05D1\u05EA\u05D5\u05E7\u05E3" }), _jsx("li", { children: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA (\u05D0\u05DD \u05E8\u05DC\u05D5\u05D5\u05E0\u05D8\u05D9)" }), _jsx("li", { children: "\u05EA\u05DE\u05D5\u05E0\u05EA \u05E1\u05DC\u05E4\u05D9" }), _jsx("li", { children: "\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05D4\u05E8\u05DB\u05D1" })] })] })), _jsxs("div", { style: { textAlign: 'center', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }, children: [_jsx("button", { className: "btn", style: { fontSize: '0.85rem', color: 'var(--text-secondary)' }, onClick: () => navigate('/profile'), children: "\uD83D\uDC64 \u05E2\u05E8\u05D9\u05DB\u05EA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05D0\u05D9\u05E9\u05D9" }), _jsx("a", { href: `https://wa.me/972546363350?text=${encodeURIComponent('שלום, אני נהג ב-EasyTaxi ואני זקוק לעזרה עם תהליך ההצטרפות')}`, target: "_blank", rel: "noopener noreferrer", className: "btn", style: { color: '#25D366', fontSize: '0.85rem' }, children: "\uD83D\uDCAC \u05E4\u05E0\u05D4 \u05DC\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-WhatsApp" })] })] })] }));
}
