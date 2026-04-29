import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ActiveRide from './pages/ActiveRide';
import PendingDriverDashboard from './pages/PendingDriverDashboard';
import LicensedDriverDashboard from './pages/LicensedDriverDashboard';
import KycReturn from './pages/KycReturn';
import Profile from './pages/Profile';
function RequireAuth({ children }) {
    const { user, loading, logout } = useAuth();
    if (loading)
        return (_jsx("div", { style: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }, children: "\u05D8\u05D5\u05E2\u05DF\u2026" }));
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (user.role !== 'driver')
        return (_jsx("div", { style: { padding: '2rem', color: 'var(--danger)' }, children: "\u05D2\u05D9\u05E9\u05D4 \u05E0\u05D3\u05D7\u05EA\u05D4: \u05D7\u05E9\u05D1\u05D5\u05E0\u05D5\u05EA \u05E0\u05D4\u05D2\u05D9\u05DD \u05D1\u05DC\u05D1\u05D3." }));
    // Not yet approved → show pending progress screen
    if (user.auth_status !== 'approved') {
        return _jsx(PendingDriverDashboard, { user: user, onLogout: logout });
    }
    // Approved licensed taxi → enhanced dashboard
    if (user.driver_type === 'licensed_taxi') {
        return _jsx(LicensedDriverDashboard, {});
    }
    // Approved rideshare / fallback → existing dashboard
    return children;
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/kyc/done", element: _jsx(KycReturn, {}) }), _jsx(Route, { path: "/profile", element: _jsx(RequireAuth, { children: _jsx(Profile, {}) }) }), _jsx(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/ride/:rideId", element: _jsx(RequireAuth, { children: _jsx(ActiveRide, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
