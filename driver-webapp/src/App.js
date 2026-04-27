import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ActiveRide from './pages/ActiveRide';
function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx("div", { style: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }, children: "Loading\u2026" });
    if (!user)
        return _jsx(Navigate, { to: "/", replace: true });
    if (user.role !== 'driver')
        return _jsx("div", { style: { padding: '2rem', color: 'var(--danger)' }, children: "Access denied: driver accounts only." });
    return children;
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Login, {}) }), _jsx(Route, { path: "/login", element: _jsx(Navigate, { to: "/", replace: true }) }), _jsx(Route, { path: "/onboarding", element: _jsx(RequireAuth, { children: _jsx(Onboarding, {}) }) }), _jsx(Route, { path: "/home", element: _jsx(RequireAuth, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/ride/:rideId", element: _jsx(RequireAuth, { children: _jsx(ActiveRide, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
