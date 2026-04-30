import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
    return (('standalone' in window.navigator && window.navigator.standalone === true) ||
        window.matchMedia('(display-mode: standalone)').matches);
}
export default function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => {
        // Don't show if already installed
        if (isInStandaloneMode())
            return;
        // Don't show if already dismissed in this session
        if (sessionStorage.getItem('pwa-install-dismissed'))
            return;
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        // iOS — show guide after a short delay if not standalone
        if (isIos()) {
            const t = setTimeout(() => setShowIosGuide(true), 3000);
            return () => {
                window.removeEventListener('beforeinstallprompt', handler);
                clearTimeout(t);
            };
        }
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    const handleAndroidInstall = async () => {
        if (!deferredPrompt)
            return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted' || outcome === 'dismissed') {
            setDeferredPrompt(null);
            dismiss();
        }
    };
    const dismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('pwa-install-dismissed', '1');
    };
    if (dismissed || isInStandaloneMode())
        return null;
    // ── Android install banner ──────────────────────────────────────────────
    if (deferredPrompt) {
        return (_jsxs("div", { style: {
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(10px)',
            }, children: [_jsx("img", { src: "/icon-72.png", width: 42, height: 42, alt: "", style: { borderRadius: 10, flexShrink: 0 } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { color: '#fff', fontWeight: 700, fontSize: '0.9rem' }, children: "\u05D4\u05D5\u05E1\u05E3 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA" }), _jsx("div", { style: { color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }, children: "\u05D2\u05D9\u05E9\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4 \u05DC-EasyTaxi \u05D9\u05E9\u05E8\u05D0\u05DC" })] }), _jsx("button", { onClick: handleAndroidInstall, style: {
                        background: '#fff', color: '#1d4ed8',
                        border: 'none', borderRadius: 20, padding: '8px 18px',
                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                        flexShrink: 0, whiteSpace: 'nowrap',
                    }, children: "\u05D4\u05EA\u05E7\u05DF" }), _jsx("button", { onClick: dismiss, "aria-label": "\u05E1\u05D2\u05D5\u05E8", style: {
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
                        fontSize: '1.3rem', cursor: 'pointer', flexShrink: 0, padding: '0 4px',
                    }, children: "\u00D7" })] }));
    }
    // ── iOS install guide ───────────────────────────────────────────────────
    if (showIosGuide) {
        return (_jsx("div", { style: {
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }, onClick: dismiss, children: _jsxs("div", { style: {
                    background: 'linear-gradient(160deg, #0f1e45 0%, #0a0f20 100%)',
                    borderRadius: '24px 24px 0 0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '28px 24px 40px',
                    width: '100%', maxWidth: 480,
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
                }, onClick: e => e.stopPropagation(), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }, children: [_jsx("img", { src: "/icon-72.png", width: 52, height: 52, alt: "", style: { borderRadius: 14 } }), _jsxs("div", { children: [_jsx("div", { style: { color: '#fff', fontWeight: 800, fontSize: '1.05rem' }, children: "EasyTaxi \u05D9\u05E9\u05E8\u05D0\u05DC" }), _jsx("div", { style: { color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }, children: "\u05D4\u05D5\u05E1\u05E3 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA \u05DC\u05D7\u05D5\u05D5\u05D9\u05D4 \u05DE\u05DC\u05D0\u05D4" })] }), _jsx("button", { onClick: dismiss, "aria-label": "\u05E1\u05D2\u05D5\u05E8", style: {
                                    marginRight: 'auto', background: 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: '50%', width: 30, height: 30,
                                    color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }, children: "\u00D7" })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [
                            { num: '1', icon: '⬆️', text: 'לחץ על כפתור השיתוף', sub: 'בתחתית הדפדפן' },
                            { num: '2', icon: '📌', text: 'בחר "הוסף למסך הבית"', sub: 'גלול למטה ברשימה' },
                            { num: '3', icon: '✅', text: 'אשר עם "הוסף"', sub: 'בפינה הימנית עליונה' },
                        ].map(step => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 14 }, children: [_jsx("div", { style: {
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: 'rgba(37,99,235,0.35)', border: '1.5px solid rgba(37,99,235,0.7)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#93c5fd', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
                                    }, children: step.num }), _jsxs("div", { children: [_jsxs("div", { style: { color: '#fff', fontSize: '0.9rem', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { children: step.icon }), " ", step.text] }), _jsx("div", { style: { color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }, children: step.sub })] })] }, step.num))) }), _jsx("div", { style: {
                            marginTop: 20, textAlign: 'center',
                            color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem',
                        }, children: "\u05DC\u05D7\u05E5 \u05E2\u05DC \u25BC \u05D1\u05EA\u05D7\u05EA\u05D9\u05EA Safari" })] }) }));
    }
    return null;
}
