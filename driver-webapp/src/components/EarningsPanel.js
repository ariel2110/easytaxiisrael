import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../services/api';
export default function EarningsPanel() {
    const [balance, setBalance] = useState(null);
    useEffect(() => {
        api.wallet.get().then((w) => setBalance(w.balance)).catch(() => { });
    }, []);
    return (_jsxs("div", { className: "card slide-in", style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }, children: "Wallet Balance" }), _jsx("div", { style: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }, children: balance != null ? `$${parseFloat(balance).toFixed(2)}` : '—' })] }), _jsx("div", { style: { fontSize: '2rem' }, children: "\uD83D\uDCB0" })] }));
}
