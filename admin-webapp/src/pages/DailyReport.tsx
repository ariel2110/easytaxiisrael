import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { DailyReport } from '../types'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'var(--danger)',
  medium: '#f59e0b',
  low:    'var(--success)',
}
const PRIORITY_LABELS: Record<string, string> = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' }
const EFFORT_LABELS: Record<string, string>   = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' }
const IMPACT_LABELS: Record<string, string>   = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' }
const STATUS_COLORS: Record<string, string>   = { good: 'var(--success)', warning: '#f59e0b', critical: 'var(--danger)' }
const STATUS_ICONS: Record<string, string>    = { good: '✅', warning: '⚠️', critical: '🔴' }
const TREND_ICONS: Record<string, string>     = { up: '↑', down: '↓', stable: '→' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.95rem' }}>
        {title}
      </div>
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  )
}

export default function DailyReport() {
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadReport() }, [])

  async function loadReport() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.dailyReport.get()
      setReport(data)
    } catch (e: any) {
      if (e.message?.includes('404') || e.message?.includes('אין')) {
        setError('אין דוח זמין עדיין. לחץ "צור דוח חדש" ליצירת הדוח הראשון.')
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  async function generateReport() {
    setGenerating(true)
    setError(null)
    try {
      const data = await api.dailyReport.generate()
      setReport(data)
    } catch (e: any) {
      setError(`שגיאה בייצור הדוח: ${e.message}`)
    }
    setGenerating(false)
  }

  const healthScore = report?.overall_health_score ?? 0
  const healthColor = healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? '#f59e0b' : 'var(--danger)'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>📈 דוח יומי AI — האדריכל האסטרטגי</h1>
        <button
          className="btn btn-primary"
          onClick={generateReport}
          disabled={generating}
          style={{ marginRight: 'auto', fontSize: '0.82rem' }}
        >
          {generating ? '⏳ מייצר דוח...' : '✨ צור דוח חדש'}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)' }}>
          <span className="spin" style={{ fontSize: '1.5rem' }}>↻</span>
        </div>
      )}

      {error && !report && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>
          <button className="btn btn-primary" onClick={generateReport} disabled={generating}>
            {generating ? '⏳ מייצר...' : '✨ צור דוח ראשון'}
          </button>
        </div>
      )}

      {generating && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧠</div>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>מנתח את המערכת...</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ה-AI מעבד את נתוני הפלטפורמה ומייצר המלצות אסטרטגיות</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>עשוי לקחת 15-30 שניות</div>
        </div>
      )}

      {report && !generating && (
        <>
          {/* Meta info */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              🕐 נוצר: {report.generated_at ? new Date(report.generated_at).toLocaleString('he-IL') : '—'}
            </span>
            {report.model_used && (
              <span style={{ fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                🤖 {report.model_used}
              </span>
            )}
          </div>

          {/* Health Score */}
          <Section title={`🏥 בריאות כללית — ${report.health_label || ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <svg viewBox="0 0 36 36" style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={healthColor} strokeWidth="3"
                    strokeDasharray={`${healthScore} 100`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800, fontSize: '1.1rem', color: healthColor }}>
                  {healthScore}
                </div>
              </div>
              <div style={{ flex: 1, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {report.executive_summary}
              </div>
            </div>
          </Section>

          {/* KPIs */}
          {report.kpis?.length > 0 && (
            <Section title="📊 מדדי ביצוע (KPIs)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {report.kpis.map((kpi, i) => (
                  <div key={i} style={{
                    background: 'var(--background)', borderRadius: '8px', padding: '0.75rem',
                    border: `1px solid ${STATUS_COLORS[kpi.status] || 'var(--border)'}30`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <span>{STATUS_ICONS[kpi.status] || '•'}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{kpi.name}</span>
                      <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: TREND_ICONS[kpi.trend] === '↑' ? 'var(--success)' : kpi.trend === 'down' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {TREND_ICONS[kpi.trend] || ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: STATUS_COLORS[kpi.status] || 'var(--text-primary)' }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      יעד: {kpi.benchmark}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Top Actions */}
          {report.top_actions?.length > 0 && (
            <Section title="🚀 פעולות מומלצות (לפי עדיפות)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {report.top_actions.map((action, i) => (
                  <div key={i} style={{
                    background: 'var(--background)', borderRadius: '8px', padding: '0.85rem',
                    borderRight: `4px solid ${PRIORITY_COLORS[action.impact] || 'var(--border)'}`,
                    display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: `${PRIORITY_COLORS[action.impact] || 'var(--border)'}20`,
                      color: PRIORITY_COLORS[action.impact] || 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.9rem',
                    }}>
                      {action.priority}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{action.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{action.description}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          ⏱ {action.timeframe}
                        </span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          💪 מאמץ: {EFFORT_LABELS[action.effort] || action.effort}
                        </span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: `${PRIORITY_COLORS[action.impact] || 'var(--border)'}15`, color: PRIORITY_COLORS[action.impact], border: `1px solid ${PRIORITY_COLORS[action.impact] || 'var(--border)'}30` }}>
                          📈 השפעה: {IMPACT_LABELS[action.impact] || action.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Bottlenecks */}
          {report.bottlenecks?.length > 0 && (
            <Section title="⚡ צווארי בקבוק ובעיות">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {report.bottlenecks.map((b, i) => (
                  <div key={i} style={{
                    background: 'var(--background)', borderRadius: '8px', padding: '0.75rem',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                    borderRight: `3px solid ${PRIORITY_COLORS[b.impact_level] || 'var(--border)'}`,
                  }}>
                    <span style={{ fontSize: '1rem' }}>{b.impact_level === 'high' ? '🔴' : b.impact_level === 'medium' ? '🟡' : '🟢'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{b.area}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                        משפיע על: {b.affected_party === 'all' ? 'כולם' : b.affected_party === 'platform' ? 'הפלטפורמה' : b.affected_party === 'driver' ? 'נהגים' : 'נוסעים'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Growth Opportunities */}
          {report.growth_opportunities?.length > 0 && (
            <Section title="💡 הזדמנויות צמיחה">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {report.growth_opportunities.map((g, i) => (
                  <div key={i} style={{
                    background: 'var(--background)', borderRadius: '8px', padding: '0.85rem',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.35rem' }}>{g.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>{g.description}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {g.potential_revenue_ils_monthly != null && (
                        <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(74,222,128,0.1)', color: 'var(--success)', border: '1px solid rgba(74,222,128,0.2)' }}>
                          💰 עד ₪{g.potential_revenue_ils_monthly?.toLocaleString('he-IL')}/חודש
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        מורכבות: {EFFORT_LABELS[g.complexity] || g.complexity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Tech Health */}
          {report.tech_health && (
            <Section title={`🔧 בריאות טכנית — ${report.tech_health.score}/100`}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--success)', marginBottom: '0.5rem' }}>✅ נקודות חוזק</div>
                  {report.tech_health.strong_points?.map((p, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0', borderBottom: '1px solid var(--border)', lineHeight: 1.4 }}>
                      {p}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠️ נקודות חולשה</div>
                  {report.tech_health.weak_points?.map((p, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0', borderBottom: '1px solid var(--border)', lineHeight: 1.4 }}>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
              {report.tech_health.recommendations?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem' }}>💡 המלצות טכניות</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {report.tech_health.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  )
}
