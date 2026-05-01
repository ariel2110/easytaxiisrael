import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { PlatformStats } from '../types'

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  color?: string
  to?: string
  badge?: number | null
}

function StatCard({ label, value, icon, color = 'var(--accent)', to, badge }: StatCardProps) {
  const navigate = useNavigate()
  const clickable = !!to
  return (
    <div
      className="card fade-in"
      onClick={clickable ? () => navigate(to!) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (clickable) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)' } }}
      onMouseLeave={e => { if (clickable) { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' } }}
    >
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
      {clickable && (
        <span style={{ position: 'absolute', top: '0.5rem', left: '0.75rem', fontSize: '0.65rem', color, opacity: 0.7 }}>↗</span>
      )}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: '-6px', right: '-6px',
          background: '#ef4444', color: '#fff', borderRadius: '100px',
          padding: '2px 7px', fontSize: '0.68rem', fontWeight: 800,
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}>{badge}</span>
      )}
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
        <StatCard label="סה״כ משתמשים" value={stats.total_users} icon="👥" color="var(--info)" to="/admin/users" />
        <StatCard label="נהגים" value={stats.total_drivers} icon="🚗" color="var(--accent)" to="/admin/drivers" />
        <StatCard label="נהגים פעילים" value={stats.active_drivers} icon="🟢" color="var(--success)" to="/admin/drivers" />
        <StatCard label="נוסעים" value={stats.total_passengers} icon="🧑" color="var(--info)" to="/admin/users" />
      </div>

      {/* Ride stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="סה״כ נסיעות" value={stats.total_rides} icon="🛣️" color="var(--text-primary)" to="/admin/rides" />
        <StatCard label="נסיעות שהושלמו" value={stats.completed_rides} icon="✅" color="var(--success)" to="/admin/rides" />
        <StatCard label="נסיעות שבוטלו" value={stats.cancelled_rides} icon="❌" color="var(--danger)" to="/admin/rides" />
        <StatCard label="נסיעות ממתינות" value={stats.pending_rides} icon="⏳" color="var(--warning)" to="/admin/rides" />
      </div>

      {/* Revenue + approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <StatCard label="הכנסות פלטפורמה (₪)" value={`₪${stats.total_revenue.toFixed(2)}`} icon="💰" color="var(--success)" />
        <StatCard label="סה״כ תשלומים" value={stats.total_payments} icon="💳" color="var(--info)" />
        <StatCard label="אחוז השלמת נסיעות" value={`${completionRate}%`} icon="📊" color={completionRate > 75 ? 'var(--success)' : 'var(--warning)'} />
        <StatCard
          label="ממתינים לאישור"
          value={stats.pending_approvals ?? 0}
          icon="⏳"
          color={stats.pending_approvals > 0 ? '#f59e0b' : 'var(--success)'}
          to="/admin/pending"
          badge={stats.pending_approvals > 0 ? stats.pending_approvals : null}
        />
      </div>
    </div>
  )
}
