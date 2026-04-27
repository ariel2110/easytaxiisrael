import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { RideWebSocket } from '../services/websocket';
export default function ActiveRide() {
    const { rideId } = useParams();
    const navigate = useNavigate();
    const [ride, setRide] = useState(null);
    const [fare, setFare] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const wsRef = useRef(null);
    useEffect(() => {
        if (!rideId)
            return;
        api.rides.get(rideId).then(setRide).catch((e) => setError(e.message));
        api.rides.fare(rideId).then(setFare).catch(() => { });
        const ws = new RideWebSocket(rideId, 'driver');
        wsRef.current = ws;
        ws.connect();
        // Stream GPS to server every 5 s
        const locInterval = setInterval(() => {
            navigator.geolocation.getCurrentPosition((pos) => {
                const payload = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    timestamp: new Date().toISOString(),
                };
                ws.send(payload);
                api.tracking.postLocation(rideId, payload.lat, payload.lng).catch(() => { });
            });
        }, 5000);
        return () => {
            clearInterval(locInterval);
            ws.disconnect();
        };
    }, [rideId]);
    async function doAction(action) {
        if (!rideId)
            return;
        setBusy(true);
        setError(null);
        try {
            const updated = await api.rides[action](rideId);
            setRide(updated);
            if (action === 'end' || action === 'reject') {
                navigate('/');
            }
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    if (!ride) {
        return (_jsx("div", { className: "page", style: { justifyContent: 'center', alignItems: 'center' }, children: error ? (_jsx("p", { style: { color: 'var(--danger)' }, children: error })) : (_jsx("p", { style: { color: 'var(--text-secondary)' }, children: "Loading ride\u2026" })) }));
    }
    const statusLabel = {
        pending: 'Pending',
        assigned: 'Assigned to you',
        accepted: 'Accepted — head to pickup',
        in_progress: 'Ride in progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
    };
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }, children: [_jsx("button", { onClick: () => navigate('/'), style: { color: 'var(--text-secondary)', marginRight: '1rem' }, children: "\u2190" }), _jsxs("h1", { style: { fontSize: '1.1rem', fontWeight: 600 }, children: ["Ride #", ride.id.slice(0, 8)] })] }), _jsxs("div", { className: "page-content slide-in", children: [_jsxs("div", { className: "card", style: { marginBottom: '1rem' }, children: [_jsx("span", { className: `badge ${ride.status === 'in_progress' ? 'badge-green' : 'badge-blue'}`, children: statusLabel[ride.status] ?? ride.status }), _jsxs("div", { style: { marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }, children: [_jsx(LocationRow, { icon: "\uD83D\uDCCD", label: "Pickup", lat: ride.pickup_lat, lng: ride.pickup_lng }), _jsx(LocationRow, { icon: "\uD83C\uDFC1", label: "Dropoff", lat: ride.dropoff_lat, lng: ride.dropoff_lng })] })] }), fare && (_jsxs("div", { className: "card", style: { marginBottom: '1rem' }, children: [_jsx("h3", { style: { fontWeight: 600, marginBottom: '0.75rem' }, children: "Fare Breakdown" }), _jsx(FareRow, { label: "Base fare", value: `$${fare.base_fare.toFixed(2)}` }), _jsx(FareRow, { label: `Distance (${fare.distance_km.toFixed(1)} km)`, value: `$${fare.distance_fare.toFixed(2)}` }), parseFloat(fare.surge_multiplier) > 1 && (_jsx(FareRow, { label: "Surge", value: `×${fare.surge_multiplier}`, highlight: true })), _jsx(FareRow, { label: "Platform fee", value: `-$${fare.platform_fee.toFixed(2)}` }), _jsx(FareRow, { label: "Tax", value: `-$${fare.tax_amount.toFixed(2)}` }), _jsx("div", { style: { borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }, children: _jsx(FareRow, { label: "Your earnings", value: `$${fare.driver_earnings.toFixed(2)}`, bold: true }) })] })), error && (_jsx("div", { style: { color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }, children: error })), _jsxs("div", { style: { display: 'flex', gap: '0.75rem' }, children: [ride.status === 'assigned' && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn-success", style: { flex: 1 }, disabled: busy, onClick: () => doAction('accept'), children: "\u2713 Accept" }), _jsx("button", { className: "btn btn-danger", style: { flex: 1 }, disabled: busy, onClick: () => doAction('reject'), children: "\u2717 Reject" })] })), ride.status === 'accepted' && (_jsx("button", { className: "btn btn-primary", style: { flex: 1 }, disabled: busy, onClick: () => doAction('start'), children: "\uD83D\uDEA6 Start Ride" })), ride.status === 'in_progress' && (_jsx("button", { className: "btn btn-success", style: { flex: 1 }, disabled: busy, onClick: () => doAction('end'), children: "\uD83C\uDFC1 End Ride" }))] })] })] }));
}
function LocationRow({ icon, label, lat, lng }) {
    return (_jsxs("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }, children: [_jsx("span", { children: icon }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, children: label }), _jsxs("div", { style: { fontSize: '0.875rem' }, children: [lat.toFixed(5), ", ", lng.toFixed(5)] })] })] }));
}
function FareRow({ label, value, bold, highlight }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: bold ? '1rem' : '0.875rem',
            fontWeight: bold ? 700 : 400,
            color: highlight ? 'var(--warning)' : 'inherit',
            marginBottom: '0.25rem',
        }, children: [_jsx("span", { style: { color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }, children: label }), _jsx("span", { children: value })] }));
}
