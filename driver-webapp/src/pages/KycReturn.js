import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
/**
 * Shown after Persona redirects the driver back to the app.
 * URL: /kyc/done?inquiry-id=inq_xxx&status=completed
 */
export default function KycReturn() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [countdown, setCountdown] = useState(5);
    const inquiryStatus = params.get('status') ?? 'completed';
    const isDeclined = inquiryStatus === 'declined' || inquiryStatus === 'failed';
    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    clearInterval(interval);
                    navigate('/', { replace: true });
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [navigate]);
    return (_jsxs("div", { style: {
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            background: 'var(--bg-primary)',
            gap: '1.25rem',
            padding: '2rem',
            textAlign: 'center',
        }, children: [_jsx("div", { style: { fontSize: '4rem' }, children: isDeclined ? '❌' : '✅' }), _jsx("h1", { style: { fontWeight: 800, fontSize: '1.5rem', margin: 0 }, children: isDeclined ? 'האימות לא הושלם' : 'הבקשה התקבלה!' }), _jsx("p", { style: {
                    color: 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    maxWidth: 340,
                    lineHeight: 1.65,
                    margin: 0,
                }, children: isDeclined
                    ? 'אירעה בעיה בתהליך האימות. אנא חזור לדשבורד ונסה שנית, או פנה לתמיכה.'
                    : 'קיבלנו את המסמכים שלך ונבחן אותם בהקדם. תוצאות יישלחו אליך ב-WhatsApp תוך עד 24 שעות.' }), !isDeclined && (_jsx("div", { className: "card", style: { maxWidth: 320, width: '100%', background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)' }, children: _jsxs("div", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }, children: [_jsx("div", { children: "\uD83D\uDCCB \u05DE\u05D4 \u05E7\u05D5\u05E8\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5?" }), _jsxs("ul", { style: { paddingRight: '1.2rem', margin: '0.5rem 0 0' }, children: [_jsx("li", { children: "\u05E6\u05D5\u05D5\u05EA EasyTaxi \u05D1\u05D5\u05D7\u05DF \u05D0\u05EA \u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" }), _jsx("li", { children: "\u05EA\u05E7\u05D1\u05DC \u05E2\u05D3\u05DB\u05D5\u05DF \u05D1-WhatsApp" }), _jsx("li", { children: "\u05DC\u05D0\u05D7\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u05EA\u05D5\u05DB\u05DC \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E0\u05E1\u05D5\u05E2" })] })] }) })), _jsx("button", { className: "btn btn-primary", style: { marginTop: '0.5rem' }, onClick: () => navigate('/', { replace: true }), children: "\u05D7\u05D6\u05D5\u05E8 \u05DC\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3" }), _jsxs("p", { style: { color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }, children: ["\u05E2\u05D5\u05D1\u05E8 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E2\u05D5\u05D3 ", countdown, " \u05E9\u05E0\u05D9\u05D5\u05EA\u2026"] })] }));
}
