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
import StatusBar from '../components/StatusBar';
export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { rides, loading, refresh } = useRides();
    const [compliance, setCompliance] = useState(null);
    useEffect(() => {
        api.compliance.progress().then(setCompliance).catch(() => { });
    }, []);
    const pendingRides = rides.filter((r) => r.status === 'assigned' || r.status === 'pending');
    const activeRide = rides.find((r) => r.status === 'accepted' || r.status === 'in_progress');
    function handleLogout() {
        logout();
        navigate('/');
    }
    return (_jsxs("div", { className: "page", children: [_jsx(StatusBar, { user: user, onLogout: handleLogout }), _jsxs("div", { className: "page-content", style: { paddingBottom: '5rem' }, children: [compliance && _jsx(ComplianceBar, { compliance: compliance }), _jsx(EarningsPanel, {}), _jsxs("div", { style: { marginTop: '1.5rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }, children: [_jsx("h2", { style: { fontSize: '1.1rem', fontWeight: 600 }, children: activeRide ? 'Active Ride' : 'Pending Requests' }), loading && _jsx("span", { className: "pulse" })] }), activeRide ? (_jsx(RideCard, { ride: activeRide, onAction: () => navigate(`/ride/${activeRide.id}`) })) : pendingRides.length === 0 ? (_jsxs("div", { className: "card fade-in", style: { textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '0.5rem' }, children: "\u23F3" }), _jsx("p", { children: "Waiting for ride requests\u2026" }), _jsx("button", { className: "btn", style: { marginTop: '1rem', color: 'var(--accent)', fontSize: '0.875rem' }, onClick: refresh, children: "Refresh" })] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' }, children: pendingRides.map((ride) => (_jsx(RideCard, { ride: ride, onAction: () => navigate(`/ride/${ride.id}`) }, ride.id))) }))] })] }), _jsx(BottomNav, {})] }));
}
