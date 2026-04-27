import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function EarningsPanel() {
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    api.wallet.get().then((w) => setBalance(w.balance)).catch(() => {})
  }, [])

  return (
    <div className="card slide-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Wallet Balance</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }}>
          {balance != null ? `$${parseFloat(balance).toFixed(2)}` : '—'}
        </div>
      </div>
      <div style={{ fontSize: '2rem' }}>💰</div>
    </div>
  )
}
