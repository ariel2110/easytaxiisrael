import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import snsWebSdk from '@sumsub/websdk';
import heTranslations from '../assets/sumsub-i18n-he.json';
export default function KYCVerification() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const containerRef = useRef(null);
    const [status, setStatus] = useState('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const driverType = searchParams.get('type') === 'licensed_taxi' ? 'licensed_taxi' : 'rideshare';
    const fetchToken = useCallback(async () => {
        const jwt = localStorage.getItem('access_token');
        const resp = await fetch('/api/sumsub/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
            },
            body: JSON.stringify({ driver_type: driverType }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.detail ?? 'שגיאה בקבלת טוקן אימות');
        }
        const data = await resp.json();
        return data.token;
    }, [driverType]);
    useEffect(() => {
        let cancelled = false;
        const launch = async () => {
            if (!containerRef.current)
                return;
            try {
                const token = await fetchToken();
                if (cancelled)
                    return;
                setStatus('ready');
                snsWebSdk
                    .init(token, () => fetchToken())
                    .withConf({
                    lang: 'he',
                    i18n: heTranslations,
                    uiConf: {
                        customCssStr: `
                .step-name { font-family: 'Heebo', sans-serif; }
                body { direction: rtl; }
              `,
                    },
                })
                    .withOptions({ addViewportTag: false, adaptIframeHeight: true })
                    .on('idCheck.onError', (error) => {
                    console.error('[Sumsub] SDK error:', error);
                    if (!cancelled)
                        setStatus('error');
                })
                    .onMessage((type, payload) => {
                    console.log('[Sumsub] message:', type, payload);
                    if (type === 'idCheck.applicantReviewComplete') {
                        // Mark as submitted locally — shows progress even before webhook arrives
                        localStorage.setItem('sumsub_submitted', '1');
                        if (!cancelled)
                            setStatus('success');
                        setTimeout(() => navigate('/driver?tab=verify'), 2500);
                    }
                })
                    .build()
                    .launch('#sumsub-kyc-container');
            }
            catch (err) {
                if (!cancelled) {
                    setStatus('error');
                    setErrorMsg(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
                }
            }
        };
        launch();
        return () => { cancelled = true; };
    }, [fetchToken, navigate]);
    return (_jsxs("div", { dir: "rtl", style: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #070B14 0%, #0C1322 50%, #0f3460 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 16px',
            fontFamily: "'Heebo', 'Segoe UI', sans-serif",
        }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("div", { style: { fontSize: 40, marginBottom: 8 }, children: "\uD83E\uDEAA" }), _jsx("h1", { style: { color: '#fff', fontSize: 22, fontWeight: 800, margin: 0 }, children: "\u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA \u05E0\u05D4\u05D2" }), _jsx("p", { style: { color: '#94a3b8', fontSize: 14, marginTop: 8 }, children: driverType === 'licensed_taxi' ? 'אימות לרישיון נהג מונית' : 'אימות לנהג שיתופי' }), _jsx("button", { onClick: () => navigate('/driver?tab=verify'), style: {
                            marginTop: 12,
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,.15)',
                            borderRadius: 8,
                            color: '#94a3b8',
                            padding: '6px 16px',
                            cursor: 'pointer',
                            fontSize: 13,
                        }, children: "\u2190 \u05D7\u05D6\u05D5\u05E8 \u05DC\u05D3\u05D0\u05E9\u05D1\u05D5\u05E8\u05D3" })] }), status === 'loading' && (_jsxs("div", { style: { color: '#94a3b8', textAlign: 'center', padding: 40 }, children: [_jsx("div", { style: {
                            width: 48, height: 48,
                            border: '4px solid #334155', borderTop: '4px solid #3b82f6',
                            borderRadius: '50%', animation: 'kcSpin 1s linear infinite',
                            margin: '0 auto 16px',
                        } }), _jsx("p", { children: "\u05D8\u05D5\u05E2\u05DF \u05DE\u05E2\u05E8\u05DB\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA..." }), _jsx("style", { children: `@keyframes kcSpin { to { transform: rotate(360deg); } }` })] })), status === 'error' && (_jsxs("div", { style: {
                    background: '#1e293b', border: '1px solid #ef4444',
                    borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%',
                }, children: [_jsx("div", { style: { fontSize: 48, marginBottom: 16 }, children: "\u274C" }), _jsx("h2", { style: { color: '#ef4444', margin: '0 0 12px' }, children: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05D4" }), _jsx("p", { style: { color: '#94a3b8', margin: '0 0 20px' }, children: errorMsg || 'לא ניתן לטעון את מערכת האימות' }), _jsx("button", { onClick: () => window.location.reload(), style: {
                            background: '#3b82f6', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 16,
                        }, children: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1" })] })), status === 'success' && (_jsxs("div", { style: {
                    background: '#1e293b', border: '1px solid #22c55e',
                    borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%',
                }, children: [_jsx("div", { style: { fontSize: 64, marginBottom: 16 }, children: "\u2705" }), _jsx("h2", { style: { color: '#22c55e', margin: '0 0 12px' }, children: "\u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05D5\u05E9\u05DC\u05DD!" }), _jsx("p", { style: { color: '#94a3b8' }, children: "\u05DE\u05E2\u05D1\u05D9\u05E8 \u05D0\u05D5\u05EA\u05DA \u05DC\u05D3\u05D0\u05E9\u05D1\u05D5\u05E8\u05D3..." })] })), _jsx("div", { id: "sumsub-kyc-container", ref: containerRef, style: {
                    width: '100%',
                    maxWidth: 680,
                    minHeight: 500,
                    background: '#fff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    display: (status === 'loading' || status === 'error' || status === 'success') ? 'none' : 'block',
                } })] }));
}
