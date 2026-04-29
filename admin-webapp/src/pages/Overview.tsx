import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { PlatformStats } from '../types'

interface StatCardProps { label: string; value: string | number; icon: string; color?: string }

function StatCard({ label, value, icon, color = 'var(--accent)' }: StatCardProps) {
  return (
    <div className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 'var(--radius-md)',
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{label}</div>
      </div>
    </div>
  )
}

export default function Overview() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.stats.get()
      .then(s => { setStats(s); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)' }}>
      <span className="spin" style={{ fontSize: '1.5rem' }}>↻</span>
    </div>
  )

  if (error) return (
    <div className="card" style={{ color: 'var(--danger)' }}>שגיאה: {error}</div>
  )

  if (!stats) return null

  const completionRate = stats.total_rides > 0
    ? Math.round((stats.completed_rides / stats.total_rides) * 100)
    : 0

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>סקירה כללית</h1>

      {/* Primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="סה״כ משתמשים" value={stats.total_users} icon="👥" color="var(--info)" />
        <StatCard label="נהגים" value={stats.total_drivers} icon="🚗" color="var(--accent)" />
        <StatCard label="נהגים פעילים" value={stats.active_drivers} icon="🟢" color="var(--success)" />
        <StatCard label="נוסעים" value={stats.total_passengers} icon="🧑" color="var(--info)" />
      </div>

      {/* Ride stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="סה״כ נסיעות" value={stats.total_rides} icon="🛣️" color="var(--text-primary)" />
        <StatCard label="נסיעות שהושלמו" value={stats.completed_rides} icon="✅" color="var(--success)" />
        <StatCard label="נסיעות שבוטלו" value={stats.cancelled_rides} icon="❌" color="var(--danger)" />
        <StatCard label="נסיעות ממתינות" value={stats.pending_rides} icon="⏳" color="var(--warning)" />
      </div>

      {/* Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <StatCard label="הכנסות פלטפורמה (₪)" value={`₪${stats.total_revenue.toFixed(2)}`} icon="💰" color="var(--success)" />
        <StatCard label="סה״כ תשלומים" value={stats.total_payments} icon="💳" color="var(--info)" />
        <StatCard label="אחוז השלמת נסיעות" value={`${completionRate}%`} icon="📊" color={completionRate > 75 ? 'var(--success)' : 'var(--warning)'} />
      </div>
    </div>
  )
}
