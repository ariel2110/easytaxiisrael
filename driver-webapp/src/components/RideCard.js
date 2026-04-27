import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
const statusBadge = {
    pending: 'badge-yellow',
    assigned: 'badge-blue',
    accepted: 'badge-blue',
    in_progress: 'badge-green',
    completed: 'badge-green',
    cancelled: 'badge-red',
};
const statusLabel = {
    pending: 'Pending',
    assigned: 'New Request',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
};
export default function RideCard({ ride, onAction }) {
    return (_jsxs("div", { className: "card slide-in", style: { cursor: 'pointer' }, onClick: onAction, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }, children: [_jsxs("span", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, children: ["#", ride.id.slice(0, 8)] }), _jsx("span", { className: `badge ${statusBadge[ride.status] ?? 'badge-blue'}`, children: statusLabel[ride.status] ?? ride.status })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.4rem' }, children: [_jsxs("div", { style: { fontSize: '0.875rem', display: 'flex', gap: '0.5rem' }, children: [_jsx("span", { children: "\uD83D\uDCCD" }), _jsxs("span", { style: { color: 'var(--text-secondary)' }, children: [ride.pickup_lat.toFixed(4), ", ", ride.pickup_lng.toFixed(4)] })] }), _jsxs("div", { style: { fontSize: '0.875rem', display: 'flex', gap: '0.5rem' }, children: [_jsx("span", { children: "\uD83C\uDFC1" }), _jsxs("span", { style: { color: 'var(--text-secondary)' }, children: [ride.dropoff_lat.toFixed(4), ", ", ride.dropoff_lng.toFixed(4)] })] })] }), _jsx("div", { style: { marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }, children: "Tap to view details \u2192" })] }));
}
