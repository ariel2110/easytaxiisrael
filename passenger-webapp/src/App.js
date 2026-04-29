import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import RequestRide from './pages/RequestRide';
import ActiveRide from './pages/ActiveRide';
import GuestDashboard from './pages/GuestDashboard';
import DriverOnboarding from './pages/DriverOnboarding';
import DriverLanding from './pages/DriverLanding';
import DriverPending from './pages/DriverPending';
import DriverDashboard from './pages/DriverDashboard';
import AdminPanel from './pages/AdminPanel';
import FAQ from './pages/FAQ';
import Profile from './pages/Profile';
const Loader = () => (_jsxs("div", { style: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)' }, children: [_jsx("div", { style: { fontSize: '2.5rem' }, className: "taxi-bounce", children: "\uD83D\uDE95" }), _jsx("div", { style: { color: 'var(--text-secondary)', fontSize: '.9rem' }, children: "\u05D8\u05D5\u05E2\u05DF\u2026" })] }));
function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx(Loader, {});
    if (!user)
        return _jsx(Navigate, { to: "/login?role=passenger", replace: true });
    return children;
}
function RequireDriverAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx(Loader, {});
    if (!user)
        return _jsx(Navigate, { to: "/login?role=driver", replace: true });
    return children;
}
function RequireAdminAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx(Loader, {});
    if (!user || user.role !== 'admin')
        return _jsx(Navigate, { to: "/", replace: true });
    return children;
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Landing, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/guest", element: _jsx(GuestDashboard, {}) }), _jsx(Route, { path: "/driver/join", element: _jsx(DriverLanding, {}) }), _jsx(Route, { path: "/driver/onboarding", element: _jsx(DriverOnboarding, {}) }), _jsx(Route, { path: "/driver/pending", element: _jsx(DriverPending, {}) }), _jsx(Route, { path: "/faq", element: _jsx(FAQ, {}) }), _jsx(Route, { path: "/driver", element: _jsx(RequireDriverAuth, { children: _jsx(DriverDashboard, {}) }) }), _jsx(Route, { path: "/app", element: _jsx(RequireAuth, { children: _jsx(RequestRide, {}) }) }), _jsx(Route, { path: "/app/profile", element: _jsx(RequireAuth, { children: _jsx(Profile, {}) }) }), _jsx(Route, { path: "/ride/:rideId", element: _jsx(RequireAuth, { children: _jsx(ActiveRide, {}) }) }), _jsx(Route, { path: "/admin", element: _jsx(RequireAdminAuth, { children: _jsx(AdminPanel, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
