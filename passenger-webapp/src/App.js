import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import RequestRide from './pages/RequestRide';
import ActiveRide from './pages/ActiveRide';
function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx("div", { style: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }, children: "Loading\u2026" });
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return children;
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(RequestRide, {}) }) }), _jsx(Route, { path: "/ride/:rideId", element: _jsx(RequireAuth, { children: _jsx(ActiveRide, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
