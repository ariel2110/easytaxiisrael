import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRides } from '../hooks/useRides';
import { api } from '../services/api';
import RideCard from '../components/RideCard';
import EarningsPanel from '../components/EarningsPanel';
import ComplianceBar from '../components/ComplianceBar';
import BottomNav from '../components/BottomNav';
export default function LicensedDriverDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { rides, loading, refresh } = useRides();
    const [compliance, setCompliance] = useState(null);
    const [online, setOnline] = useState(true);
    useEffect(() => {
        api.compliance.progress().then(setCompliance).catch(() => { });
    }, []);
    const pendingRides = rides.filter((r) => r.status === 'assigned' || r.status === 'pending');
    const activeRide = rides.find((r) => r.status === 'accepted' || r.status === 'in_progress');
    function handleLogout() {
        logout();
        navigate('/login');
    }
    const isLicensed = user?.driver_type === 'licensed_taxi';
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                    direction: 'rtl',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' }, children: [_jsx("span", { style: { fontSize: '1.1rem' }, children: "\uD83D\uDE95" }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, fontSize: '0.95rem', lineHeight: 1 }, children: user?.full_name ?? user?.phone }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }, children: [isLicensed && (_jsx("span", { className: "badge badge-yellow", style: { fontSize: '0.65rem' }, children: "\u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D4" })), _jsx("span", { className: "badge badge-green", style: { fontSize: '0.65rem' }, children: "\u05DE\u05D0\u05D5\u05E9\u05E8 \u2713" })] })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsxs("button", { onClick: () => setOnline(o => !o), style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: 999,
                                    background: online ? 'rgba(34,197,94,0.15)' : 'var(--bg-elevated)',
                                    border: `1px solid ${online ? 'var(--success)' : 'var(--border)'}`,
                                    color: online ? 'var(--success)' : 'var(--text-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                }, children: [_jsx("span", { style: {
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: online ? 'var(--success)' : 'var(--text-secondary)',
                                        } }), online ? 'מחובר' : 'מנותק'] }), _jsx("button", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, onClick: handleLogout, children: "\u05D9\u05E6\u05D9\u05D0\u05D4" })] })] }), _jsxs("div", { className: "page-content", style: { paddingBottom: '5rem', direction: 'rtl' }, children: [compliance && _jsx(ComplianceBar, { compliance: compliance }), !online && (_jsxs("div", { className: "card", style: { marginBottom: '1rem', borderColor: 'var(--warning)', background: 'rgba(245,158,11,0.08)', textAlign: 'center' }, children: [_jsx("div", { style: { fontWeight: 600, color: 'var(--warning)', marginBottom: '0.25rem' }, children: "\u23F8 \u05D0\u05EA\u05D4 \u05D1\u05DE\u05E6\u05D1 \u05DC\u05D0 \u05DE\u05D7\u05D5\u05D1\u05E8" }), _jsx("div", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)' }, children: "\u05DC\u05D0 \u05EA\u05E7\u05D1\u05DC \u05D1\u05E7\u05E9\u05D5\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4 \u05D7\u05D3\u05E9\u05D5\u05EA" })] })), _jsx(EarningsPanel, {}), _jsxs("div", { style: { marginTop: '1.5rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }, children: [_jsx("h2", { style: { fontSize: '1rem', fontWeight: 700 }, children: activeRide ? 'נסיעה פעילה' : 'בקשות ממתינות' }), _jsxs("button", { onClick: refresh, style: { fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.3rem' }, children: [loading ? _jsx("span", { className: "pulse" }) : '↻', " \u05E8\u05E2\u05E0\u05DF"] })] }), activeRide ? (_jsx(RideCard, { ride: activeRide, onAction: () => navigate(`/ride/${activeRide.id}`) })) : !online ? (_jsxs("div", { className: "card", style: { textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '0.5rem' }, children: "\u23F8" }), _jsx("p", { children: "\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DB\u05D3\u05D9 \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA" })] })) : pendingRides.length === 0 ? (_jsxs("div", { className: "card fade-in", style: { textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '0.5rem' }, children: "\u23F3" }), _jsx("p", { children: "\u05DE\u05D7\u05DB\u05D4 \u05DC\u05D1\u05E7\u05E9\u05D5\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4\u2026" })] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' }, children: pendingRides.map((ride) => (_jsx(RideCard, { ride: ride, onAction: () => navigate(`/ride/${ride.id}`) }, ride.id))) }))] })] }), _jsx(BottomNav, {})] }));
}
