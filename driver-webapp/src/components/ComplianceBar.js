import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const statusColor = {
    approved: 'var(--success)',
    warning: 'var(--warning)',
    blocked: 'var(--danger)',
};
export default function ComplianceBar({ compliance }) {
    const color = statusColor[compliance.status] ?? 'var(--text-secondary)';
    if (compliance.status === 'approved')
        return null; // no noise when fully compliant
    return (_jsxs("div", { className: "card slide-in", style: {
            borderColor: color,
            marginBottom: '1rem',
            background: `${color}11`,
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }, children: [_jsx("span", { style: { fontWeight: 600, color }, children: compliance.status === 'blocked' ? '⛔ Account Blocked' : '⚠️ Action Required' }), _jsxs("span", { style: { fontSize: '0.875rem', color }, children: [compliance.compliance_score, "%"] })] }), _jsx("div", { style: {
                    height: 6,
                    background: 'var(--bg-elevated)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: '0.5rem',
                }, children: _jsx("div", { style: {
                        height: '100%',
                        width: `${compliance.progress_pct}%`,
                        background: color,
                        borderRadius: 3,
                        transition: 'width 600ms ease',
                    } }) }), _jsxs("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)' }, children: [compliance.steps_completed, "/", compliance.steps_total, " steps completed", compliance.expired_documents > 0 && (_jsxs("span", { style: { color: 'var(--danger)', marginLeft: '0.5rem' }, children: ["\u00B7 ", compliance.expired_documents, " expired document", compliance.expired_documents > 1 ? 's' : ''] }))] })] }));
}
