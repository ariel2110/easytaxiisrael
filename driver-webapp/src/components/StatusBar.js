import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function StatusBar({ user, onLogout }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx("span", { className: "pulse" }), _jsx("span", { style: { fontSize: '0.875rem', fontWeight: 600 }, children: "RideOS Driver" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [user && (_jsx("span", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, children: user.phone })), _jsx("button", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem' }, onClick: onLogout, children: "Sign out" })] })] }));
}
