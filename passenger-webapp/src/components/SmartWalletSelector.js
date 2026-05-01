import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SmartWalletSelector — payment context toggle shown before booking a ride.
 *
 * Usage: place above the "הזמן נסיעה" button in RequestRide.tsx
 *
 * Options:
 *   💳 אישי    — charge default saved card / wallet balance
 *   🏢 עסקי    — auto-invoice to company (requires business profile)
 *   👨‍👩‍👧 משפחה  — stub, "בקרוב"
 */
import { useState, useEffect } from 'react';
import { api } from '../services/api';
const CSS = `
.sws{font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;margin-bottom:12px;}
.sws-label{font-size:.72rem;color:#64748b;font-weight:600;letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:8px;}
.sws-row{display:flex;gap:8px;}
.sws-btn{
  flex:1;padding:11px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.1);
  font-family:inherit;font-size:.78rem;font-weight:600;cursor:pointer;
  background:rgba(255,255,255,.04);color:#94a3b8;
  transition:all .18s;text-align:center;display:flex;flex-direction:column;
  align-items:center;gap:3px;
}
.sws-btn.active{
  background:rgba(255,215,0,.12);border-color:#FFD700;color:#FFD700;
  transform:translateY(-1px);box-shadow:0 4px 14px rgba(255,215,0,.12);
}
.sws-btn.disabled{opacity:.4;cursor:not-allowed;}
.sws-btn:not(.active):not(.disabled):hover{background:rgba(255,255,255,.07);color:#cbd5e1;}
.sws-icon{font-size:1.1rem;}
.sws-soon{font-size:.6rem;color:#475569;letter-spacing:.03em;}
.sws-biz-hint{
  font-size:.72rem;color:#94a3b8;margin-top:8px;
  background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.12);
  border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:6px;
}
`;
export default function SmartWalletSelector({ value, onChange }) {
    const [bizName, setBizName] = useState(null);
    useEffect(() => {
        if (value === 'business')
            return; // already loaded below
        api.wallet.getProfile()
            .then(p => { if (p.business_name)
            setBizName(p.business_name); })
            .catch(() => { });
    }, [value]);
    const options = [
        { mode: 'personal', icon: '💳', label: 'אישי' },
        { mode: 'business', icon: '🏢', label: 'עסקי' },
        { mode: 'family', icon: '👨‍👩‍👧', label: 'משפחה', soon: true },
    ];
    return (_jsxs("div", { className: "sws", children: [_jsx("style", { children: CSS }), _jsx("p", { className: "sws-label", children: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05E2\u05D1\u05D5\u05E8" }), _jsx("div", { className: "sws-row", children: options.map(opt => (_jsxs("button", { className: `sws-btn${value === opt.mode ? ' active' : ''}${opt.soon ? ' disabled' : ''}`, onClick: () => { if (!opt.soon)
                        onChange(opt.mode); }, title: opt.soon ? 'בקרוב' : undefined, children: [_jsx("span", { className: "sws-icon", children: opt.icon }), opt.label, opt.soon && _jsx("span", { className: "sws-soon", children: "\u05D1\u05E7\u05E8\u05D5\u05D1" })] }, opt.mode))) }), value === 'business' && (_jsxs("div", { className: "sws-biz-hint", children: ["\uD83E\uDDFE \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05DE\u05E1 \u05EA\u05D9\u05E9\u05DC\u05D7 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA", bizName ? _jsxs("strong", { children: [" \u05DC", bizName] }) : ' לחברה שלך', ' ', "\u05D1\u05E1\u05D9\u05D5\u05DD \u05D4\u05E0\u05E1\u05D9\u05E2\u05D4"] }))] }));
}
