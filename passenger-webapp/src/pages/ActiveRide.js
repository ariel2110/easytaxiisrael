import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { RideWebSocket } from '../services/websocket';
const STATUS_LABEL = {
    pending: '⏳ Finding a driver…',
    assigned: '✅ Driver assigned',
    accepted: '🚗 Driver on the way',
    in_progress: '🏎️ Ride in progress',
    completed: '🏁 Ride completed',
    cancelled: '❌ Ride cancelled',
};
export default function ActiveRide() {
    const { rideId } = useParams();
    const navigate = useNavigate();
    const [ride, setRide] = useState(null);
    const [fare, setFare] = useState(null);
    const [driverLoc, setDriverLoc] = useState(null);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);
    const pollRef = useRef(null);
    useEffect(() => {
        if (!rideId)
            return;
        api.rides.get(rideId).then(r => { setRide(r); if (r.status !== 'pending' && r.status !== 'assigned')
            api.rides.fare(rideId).then(setFare).catch(() => { }); }).catch(e => setError(e.message));
        // Poll ride status every 5 s
        pollRef.current = setInterval(async () => {
            try {
                const r = await api.rides.get(rideId);
                setRide(r);
                if (r.status === 'completed' || r.status === 'cancelled') {
                    clearInterval(pollRef.current);
                    if (r.status === 'completed')
                        api.rides.fare(rideId).then(setFare).catch(() => { });
                }
            }
            catch { /* ignore */ }
        }, 5000);
        // WebSocket for driver location
        const ws = new RideWebSocket(rideId);
        wsRef.current = ws;
        ws.connect();
        const unsub = ws.onLocation(setDriverLoc);
        return () => {
            clearInterval(pollRef.current);
            unsub();
            ws.disconnect();
        };
    }, [rideId]);
    async function cancelRide() {
        if (!rideId)
            return;
        try {
            await api.rides.cancel(rideId);
            navigate('/');
        }
        catch (e) {
            setError(e.message);
        }
    }
    const statusBadgeClass = ride?.status === 'in_progress' ? 'badge-green' : ride?.status === 'completed' ? 'badge-green' : ride?.status === 'cancelled' ? 'badge-red' : 'badge-yellow';
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }, children: [_jsx("button", { onClick: () => navigate('/'), style: { color: 'var(--text-secondary)', marginRight: '1rem' }, children: "\u2190" }), _jsx("h1", { style: { fontSize: '1.1rem', fontWeight: 600 }, children: "Your Ride" })] }), _jsx("div", { className: "page-content slide-in", children: !ride ? (_jsx("div", { style: { textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }, children: error ?? 'Loading…' })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card", style: { marginBottom: '1rem', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '2rem', marginBottom: '.5rem' }, children: ride.status === 'in_progress' ? '🏎️' : ride.status === 'completed' ? '🏁' : ride.status === 'cancelled' ? '❌' : '🚗' }), _jsx("span", { className: `badge ${statusBadgeClass}`, children: STATUS_LABEL[ride.status] ?? ride.status }), driverLoc && (ride.status === 'accepted' || ride.status === 'in_progress') && (_jsxs("div", { className: "fade-in", style: { marginTop: '1rem', fontSize: '.875rem', color: 'var(--text-secondary)' }, children: [_jsx("span", { className: "pulse", style: { marginRight: '.5rem' } }), "Driver at ", driverLoc.lat.toFixed(4), ", ", driverLoc.lng.toFixed(4)] }))] }), _jsxs("div", { className: "card", style: { marginBottom: '1rem' }, children: [_jsx(RouteRow, { label: "From", lat: ride.pickup_lat, lng: ride.pickup_lng, icon: "\uD83D\uDCCD" }), _jsx("div", { style: { borderTop: '1px solid var(--border)', margin: '.75rem 0' } }), _jsx(RouteRow, { label: "To", lat: ride.dropoff_lat, lng: ride.dropoff_lng, icon: "\uD83C\uDFC1" })] }), fare && (_jsxs("div", { className: "card fade-in", style: { marginBottom: '1rem' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.875rem', marginBottom: '.25rem' }, children: [_jsx("span", { style: { color: 'var(--text-secondary)' }, children: "Distance" }), _jsxs("span", { children: [fare.distance_km.toFixed(1), " km"] })] }), parseFloat(fare.surge_multiplier) > 1 && (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.875rem', marginBottom: '.25rem', color: 'var(--warning)' }, children: [_jsx("span", { children: "Surge" }), _jsxs("span", { children: ["\u00D7", fare.surge_multiplier] })] })), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '.5rem' }, children: [_jsx("span", { children: "Total" }), _jsxs("span", { style: { color: 'var(--success)' }, children: ["$", fare.total.toFixed(2)] })] })] })), error && _jsx("div", { style: { color: 'var(--danger)', marginBottom: '1rem', fontSize: '.875rem' }, children: error }), (ride.status === 'pending' || ride.status === 'assigned') && (_jsx("button", { className: "btn btn-danger", style: { width: '100%' }, onClick: cancelRide, children: "Cancel Ride" })), (ride.status === 'completed' || ride.status === 'cancelled') && (_jsx("button", { className: "btn btn-primary", style: { width: '100%' }, onClick: () => navigate('/'), children: "Book Another Ride" }))] })) })] }));
}
function RouteRow({ label, lat, lng, icon }) {
    return (_jsxs("div", { style: { display: 'flex', gap: '.75rem', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: icon }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '.75rem', color: 'var(--text-secondary)' }, children: label }), _jsxs("div", { style: { fontSize: '.875rem' }, children: [lat.toFixed(5), ", ", lng.toFixed(5)] })] })] }));
}
