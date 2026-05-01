import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import type { SystemHealth } from '../types'

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--success)',
  warning: '#f59e0b',
  error: 'var(--danger)',
  unknown: 'var(--text-secondary)',
}

const STATUS_ICON: Record<string, string> = {
  ok: '✅',
  warning: '⚠️',
  error: '❌',
  unknown: '❓',
}

const QUALITY_COLOR: Record<string, string> = {
  GREEN: 'var(--success)',
  YELLOW: '#f59e0b',
  RED: 'var(--danger)',
  UNKNOWN: 'var(--text-secondary)',
}

function ServiceCard({ title, status, details }: { title: string; status: string; details: Record<string, string | number | null | undefined> }) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.unknown
  const icon = STATUS_ICON[status] ?? '❓'
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
        <span style={{ marginRight: 'auto', fontSize: '0.72rem', color, fontWeight: 600, background: `${color}18`, padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
          {status.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {Object.entries(details).map(([k, v]) => v != null && (
          <div key={k} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)', minWidth: '110px' }}>{k}:</span>
            <span style={{ fontWeight: 500 }}>{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: SystemHealth['agents'][number] }) {
  const color = agent.enabled ? 'var(--success)' : 'var(--text-secondary)'
  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${agent.enabled ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
      borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem' }}>{agent.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{agent.name}</div>
          <div style={{ fontSize: '0.7rem', color }}>{agent.enabled ? '● פעיל' : '○ מושבת'}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--background)', borderRadius: '4px', padding: '0.2rem 0.4rem' }}>
        {agent.model}
      </div>
    </div>
  )
}

export default function ControlCenter() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [testWaStatus, setTestWaStatus] = useState<string | null>(null)
  const [testWaSending, setTestWaSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.systemHealth.get()
      setHealth(data)
      setLastRefresh(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  async function handleTestWa() {
    setTestWaSending(true)
    setTestWaStatus(null)
    try {
      const result = await api.whatsapp.testSend('e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2', '972546363350')
      setTestWaStatus(result.success ? '✅ הודעת בדיקה נשלחה!' : '❌ שליחה נכשלה')
    } catch (e: any) {
      setTestWaStatus(`❌ ${e.message}`)
    }
    setTestWaSending(false)
  }

  async function handleFixWebhook() {
    try {
      await api.whatsapp.fixWebhook('e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2')
      setTestWaStatus('✅ Webhook עודכן')
    } catch (e: any) {
      setTestWaStatus(`❌ ${e.message}`)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)' }}>
      <span className="spin" style={{ fontSize: '1.5rem' }}>↻</span>
    </div>
  )

  if (error && !health) return (
    <div className="card" style={{ color: 'var(--danger)' }}>❌ שגיאה: {error}</div>
  )

  const wa = health?.services.whatsapp
  const db = health?.services.database
  const redis = health?.services.redis

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>🛡️ מרכז שליטה</h1>
        <span style={{
          padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
          background: health?.overall === 'ok' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          color: health?.overall === 'ok' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${health?.overall === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        }}>
          {health?.overall === 'ok' ? '● מערכת תקינה' : '⚠️ בעיות זוהו'}
        </span>
        <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {lastRefresh ? `עדכון אחרון: ${lastRefresh.toLocaleTimeString('he-IL')}` : ''} · מתרענן כל 30 שניות
        </span>
        <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={load}>
          ↻ רענן
        </button>
      </div>

      {/* Services */}
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>שירותי תשתית</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          <ServiceCard
            title="מסד נתונים (PostgreSQL)"
            status={db?.status || 'unknown'}
            details={{ משתמשים: db?.users, נהגים: db?.drivers, נסיעות: db?.rides }}
          />
          <ServiceCard
            title="Redis (Cache)"
            status={redis?.status || 'unknown'}
            details={{ זיכרון: redis?.memory || 'N/A' }}
          />
          <ServiceCard
            title={`WhatsApp (${wa?.provider || '—'})`}
            status={wa?.status || 'unknown'}
            details={{
              מצב: wa?.state,
              מספר: wa?.phone,
              פרופיל: wa?.profile_name,
              'איכות': wa?.quality_rating,
              'Phone ID': wa?.phone_number_id,
            }}
          />
        </div>
      </div>

      {/* Agents */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>סוכני AI</h2>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700,
            color: (health?.agents_enabled_count ?? 0) === (health?.agents_total_count ?? 0) ? 'var(--success)' : '#f59e0b',
          }}>
            {health?.agents_enabled_count}/{health?.agents_total_count} פעילים
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {(health?.agents || []).map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      </div>

      {/* LLM Keys */}
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>מפתחות LLM</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {Object.entries(health?.llm_keys || {}).map(([k, v]) => (
            <div key={k} style={{
              padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
              background: v ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
              color: v ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${v ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
            }}>
              {v ? '✅' : '❌'} {k}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>פעולות מהירות</h2>
        <div className="card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.82rem' }}
            onClick={handleTestWa}
            disabled={testWaSending}
          >
            💬 {testWaSending ? 'שולח...' : 'בדוק WhatsApp'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem' }}
            onClick={handleFixWebhook}
          >
            🔗 עדכן Webhook
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.82rem' }}
            onClick={load}
          >
            ↻ רענן מצב
          </button>
          {testWaStatus && (
            <span style={{
              fontSize: '0.82rem',
              color: testWaStatus.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600,
            }}>
              {testWaStatus}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
        {health?.timestamp ? `נתונים מ: ${new Date(health.timestamp).toLocaleString('he-IL')}` : ''}
      </div>
    </div>
  )
}
