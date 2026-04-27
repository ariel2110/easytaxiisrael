import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
const doneStatuses = new Set(['approved', 'completed', 'ready']);
const statusLabel = {
    not_started: 'לא התחיל',
    pending: 'ממתין לאישור',
    approved: 'הושלם',
    completed: 'הושלם',
    ready: 'מוכן',
    declined: 'נדחה',
    rejected: 'נדחה',
    expired: 'פג תוקף',
};
const statusColor = {
    not_started: 'var(--text-secondary)',
    pending: 'var(--warning)',
    approved: 'var(--success)',
    completed: 'var(--success)',
    ready: 'var(--success)',
    declined: 'var(--danger)',
    rejected: 'var(--danger)',
    expired: 'var(--danger)',
};
function isCompleted(step) {
    return doneStatuses.has(step.status);
}
export default function Onboarding() {
    const navigate = useNavigate();
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyStep, setBusyStep] = useState(null);
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const data = await api.onboarding.progress();
            setProgress(data);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        refresh().catch(() => { });
    }, [refresh]);
    const requiredComplete = useMemo(() => {
        if (!progress)
            return false;
        return progress.steps
            .filter((step) => step.required)
            .every((step) => isCompleted(step));
    }, [progress]);
    useEffect(() => {
        if (requiredComplete) {
            navigate('/home', { replace: true });
        }
    }, [requiredComplete, navigate]);
    async function runIdentityKyc() {
        setBusyStep('identity_kyc');
        setError(null);
        try {
            const res = await api.persona.startInquiry();
            if (res.hosted_flow_url) {
                window.open(res.hosted_flow_url, '_blank', 'noopener,noreferrer');
            }
            await refresh();
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusyStep(null);
        }
    }
    async function runVehicleCompliance() {
        setBusyStep('vehicle_compliance');
        setError(null);
        try {
            const res = await api.vehicle.startInquiry();
            if (res.hosted_flow_url) {
                window.open(res.hosted_flow_url, '_blank', 'noopener,noreferrer');
            }
            await refresh();
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusyStep(null);
        }
    }
    function renderAction(step) {
        if (isCompleted(step))
            return null;
        if (step.id === 'identity_kyc') {
            return (_jsx("button", { className: "btn btn-primary", disabled: busyStep !== null, onClick: runIdentityKyc, children: busyStep === 'identity_kyc' ? 'פותח אימות…' : 'התחל אימות זהות' }));
        }
        if (step.id === 'vehicle_compliance') {
            return (_jsx("button", { className: "btn btn-primary", disabled: busyStep !== null, onClick: runVehicleCompliance, children: busyStep === 'vehicle_compliance' ? 'פותח אימות…' : 'המשך אימות רכב' }));
        }
        if (step.id === 'compliance_docs') {
            return (_jsx("button", { className: "btn", disabled: refreshing, onClick: () => refresh(), children: "\u05E8\u05E2\u05E0\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1 \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" }));
        }
        return null;
    }
    if (loading) {
        return (_jsx("div", { className: "page", style: { justifyContent: 'center', alignItems: 'center' }, children: _jsx("div", { className: "card", style: { width: '100%', maxWidth: 440, textAlign: 'center' }, children: "\u05D8\u05D5\u05E2\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1 \u05D0\u05D9\u05DE\u05D5\u05EA\u2026" }) }));
    }
    return (_jsx("div", { className: "page", style: { justifyContent: 'center', alignItems: 'center', padding: '2rem' }, children: _jsxs("div", { className: "card slide-in", style: { width: '100%', maxWidth: 520 }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '1.25rem' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '.25rem' }, children: "\uD83E\uDDFE" }), _jsx("h1", { style: { fontSize: '1.4rem', fontWeight: 700 }, children: "\u05D4\u05E9\u05DC\u05DE\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05E0\u05D4\u05D2" }), _jsx("p", { style: { color: 'var(--text-secondary)', marginTop: '.25rem' }, children: "\u05D0\u05D7\u05E8\u05D9 \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D9, \u05DE\u05E9\u05DC\u05D9\u05DE\u05D9\u05DD \u05DB\u05D0\u05DF \u05D0\u05EA \u05DB\u05DC \u05E9\u05DC\u05D1\u05D9 \u05D4\u05E0\u05D4\u05D2." })] }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '.35rem' }, children: [_jsx("span", { style: { color: 'var(--text-secondary)', fontSize: '.9rem' }, children: "\u05D4\u05EA\u05E7\u05D3\u05DE\u05D5\u05EA \u05DB\u05DC\u05DC\u05D9\u05EA" }), _jsxs("span", { style: { fontWeight: 600 }, children: [progress?.overall_pct ?? 0, "%"] })] }), _jsx("div", { style: { height: 8, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }, children: _jsx("div", { style: {
                                    height: '100%',
                                    width: `${progress?.overall_pct ?? 0}%`,
                                    background: 'linear-gradient(90deg, #22c55e, #f59e0b)',
                                    transition: 'width 400ms ease',
                                } }) })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '.75rem' }, children: progress?.steps.map((step) => {
                        const color = statusColor[step.status] ?? 'var(--text-secondary)';
                        const label = statusLabel[step.status] ?? step.status;
                        return (_jsxs("div", { style: {
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '.85rem',
                                background: 'var(--surface)',
                            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.5rem' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600 }, children: step.name }), _jsx("div", { style: { color: 'var(--text-secondary)', fontSize: '.8rem' }, children: step.required ? 'שלב חובה' : 'שלב אופציונלי' })] }), _jsx("div", { style: { color, fontWeight: 600, fontSize: '.85rem' }, children: label })] }), renderAction(step)] }, step.id));
                    }) }), error && (_jsx("div", { className: "fade-in", style: { marginTop: '1rem', padding: '.75rem', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.875rem' }, children: error })), _jsxs("div", { style: { marginTop: '1rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem' }, children: [_jsx("button", { className: "btn", onClick: () => refresh(), disabled: refreshing || busyStep !== null, children: refreshing ? 'מרענן…' : 'רענן סטטוס' }), _jsx("button", { className: "btn", onClick: () => navigate('/home'), children: "\u05D4\u05DE\u05E9\u05DA \u05DC\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3" })] })] }) }));
}
