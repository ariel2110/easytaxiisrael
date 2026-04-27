import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import SurgeIndicator from '../components/SurgeIndicator';
const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 }; // San Francisco default
export default function RequestRide() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pickup, setPickup] = useState({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng });
    const [dropoff, setDropoff] = useState({ lat: 37.7850, lng: -122.4090 });
    const [fare, _setFare] = useState(null);
    const [surge, setSurge] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [locating, setLocating] = useState(false);
    // Detect user location
    useEffect(() => {
        if (!navigator.geolocation)
            return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setLocating(false);
        }, () => setLocating(false));
    }, []);
    // Load surge info
    useEffect(() => {
        api.ai.intelligence().then(setSurge).catch(() => { });
    }, []);
    async function estimateFare() {
        const req = { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng };
        // We estimate by creating a temp ride — in a production app this would be a separate /fare/estimate endpoint
        setBusy(true);
        setError(null);
        try {
            const ride = await api.rides.request(req);
            navigate(`/ride/${ride.id}`);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }, children: [_jsx("h1", { style: { fontWeight: 700, fontSize: '1.2rem' }, children: "\uD83D\uDE80 RideOS" }), _jsxs("div", { style: { display: 'flex', gap: '.75rem', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: '.75rem', color: 'var(--text-secondary)' }, children: user?.phone }), _jsx("button", { style: { fontSize: '.75rem', color: 'var(--text-secondary)' }, onClick: () => { logout(); navigate('/login'); }, children: "Sign out" })] })] }), _jsxs("div", { className: "page-content", style: { paddingBottom: '2rem' }, children: [_jsx("div", { className: "map-placeholder slide-in", style: { height: 200, marginBottom: '1.5rem', marginTop: '1rem' }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '.25rem' }, children: "\uD83D\uDDFA\uFE0F" }), _jsx("div", { children: "Map view \u2014 pickup marked" }), _jsxs("div", { style: { fontSize: '.75rem', marginTop: '.25rem' }, children: [pickup.lat.toFixed(4), ", ", pickup.lng.toFixed(4)] })] }) }), surge && _jsx(SurgeIndicator, { surge: surge }), _jsxs("div", { className: "card slide-in", style: { marginTop: '1rem' }, children: [_jsx("h2", { style: { fontWeight: 600, marginBottom: '1rem' }, children: "Book a ride" }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsxs("label", { style: { display: 'block', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }, children: ["\uD83D\uDCCD Pickup ", locating && _jsx("span", { style: { color: 'var(--accent)' }, children: "(detecting\u2026)" })] }), _jsxs("div", { style: { display: 'flex', gap: '.5rem' }, children: [_jsx("input", { className: "input", type: "number", step: "0.0001", value: pickup.lat, onChange: e => setPickup(p => ({ ...p, lat: parseFloat(e.target.value) })), placeholder: "Lat", style: { flex: 1 } }), _jsx("input", { className: "input", type: "number", step: "0.0001", value: pickup.lng, onChange: e => setPickup(p => ({ ...p, lng: parseFloat(e.target.value) })), placeholder: "Lng", style: { flex: 1 } })] })] }), _jsxs("div", { style: { marginBottom: '1.5rem' }, children: [_jsx("label", { style: { display: 'block', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }, children: "\uD83C\uDFC1 Dropoff" }), _jsxs("div", { style: { display: 'flex', gap: '.5rem' }, children: [_jsx("input", { className: "input", type: "number", step: "0.0001", value: dropoff.lat, onChange: e => setDropoff(p => ({ ...p, lat: parseFloat(e.target.value) })), placeholder: "Lat", style: { flex: 1 } }), _jsx("input", { className: "input", type: "number", step: "0.0001", value: dropoff.lng, onChange: e => setDropoff(p => ({ ...p, lng: parseFloat(e.target.value) })), placeholder: "Lng", style: { flex: 1 } })] })] }), fare && (_jsxs("div", { className: "fade-in", style: { background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '.75rem', marginBottom: '1rem', fontSize: '.875rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }, children: [_jsx("span", { children: "Total" }), _jsxs("span", { style: { color: 'var(--success)' }, children: ["$", fare.total.toFixed(2)] })] }), _jsxs("div", { style: { color: 'var(--text-secondary)', marginTop: '.25rem' }, children: [fare.distance_km.toFixed(1), " km"] })] })), error && (_jsx("div", { style: { color: 'var(--danger)', marginBottom: '1rem', fontSize: '.875rem' }, children: error })), _jsx("button", { className: "btn btn-primary", style: { width: '100%' }, disabled: busy, onClick: estimateFare, children: busy ? 'Finding driver…' : 'Request Ride →' })] })] })] }));
}
