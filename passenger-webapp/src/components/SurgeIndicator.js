import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
const demandColor = {
    low: 'surge-1x',
    medium: 'surge-1x',
    high: 'surge-2x',
    very_high: 'surge-3x',
};
const demandIcon = {
    low: '😌',
    medium: '🚗',
    high: '🔥',
    very_high: '⚡',
};
export default function SurgeIndicator({ surge }) {
    const mult = parseFloat(surge.surge_multiplier);
    if (mult <= 1.05)
        return null;
    const colorClass = demandColor[surge.demand_level] ?? 'surge-2x';
    const icon = demandIcon[surge.demand_level] ?? '🔥';
    return (_jsxs("div", { className: "fade-in", style: { display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }, children: [_jsxs("span", { className: `surge-badge ${colorClass}`, children: [icon, " ", mult.toFixed(1), "\u00D7 surge"] }), _jsx("span", { style: { fontSize: '.8rem', color: 'var(--text-secondary)' }, children: "High demand \u2014 fares are higher than usual" })] }));
}
