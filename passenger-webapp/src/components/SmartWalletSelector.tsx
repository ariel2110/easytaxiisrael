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

import { useState, useEffect } from 'react'
import { api } from '../services/api'

export type PaymentMode = 'personal' | 'business' | 'family'

interface Props {
  value: PaymentMode
  onChange: (mode: PaymentMode) => void
}

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
`

export default function SmartWalletSelector({ value, onChange }: Props) {
  const [bizName, setBizName] = useState<string | null>(null)

  useEffect(() => {
    if (value === 'business') return   // already loaded below
    api.wallet.getProfile()
      .then(p => { if (p.business_name) setBizName(p.business_name) })
      .catch(() => {})
  }, [value])

  const options: { mode: PaymentMode; icon: string; label: string; soon?: boolean }[] = [
    { mode: 'personal', icon: '💳', label: 'אישי' },
    { mode: 'business', icon: '🏢', label: 'עסקי' },
    { mode: 'family',   icon: '👨‍👩‍👧', label: 'משפחה', soon: true },
  ]

  return (
    <div className="sws">
      <style>{CSS}</style>
      <p className="sws-label">תשלום עבור</p>
      <div className="sws-row">
        {options.map(opt => (
          <button
            key={opt.mode}
            className={`sws-btn${value === opt.mode ? ' active' : ''}${opt.soon ? ' disabled' : ''}`}
            onClick={() => { if (!opt.soon) onChange(opt.mode) }}
            title={opt.soon ? 'בקרוב' : undefined}
          >
            <span className="sws-icon">{opt.icon}</span>
            {opt.label}
            {opt.soon && <span className="sws-soon">בקרוב</span>}
          </button>
        ))}
      </div>

      {value === 'business' && (
        <div className="sws-biz-hint">
          🧾 חשבונית מס תישלח אוטומטית
          {bizName ? <strong> ל{bizName}</strong> : ' לחברה שלך'}
          {' '}בסיום הנסיעה
        </div>
      )}
    </div>
  )
}
