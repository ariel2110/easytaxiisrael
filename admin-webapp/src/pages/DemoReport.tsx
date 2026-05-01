import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { DemoReportData } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────
const SPECIAL_COLORS: Record<string, string> = {
  normal:       'var(--text-secondary)',
  wait:         '#f59e0b',
  address_change: '#8b5cf6',
  night:        '#3b82f6',
  traffic:      '#f97316',
  cancelled:    'var(--danger)',
  minimum:      '#22c55e',
  shabbat:      '#eab308',
  intercity:    '#0ea5e9',
}

const STATUS_STEPS = [
  { key: 'requested', label: 'הוזמן', icon: '📍' },
  { key: 'accepted',  label: 'אישר נהג', icon: '✋' },
  { key: 'started',   label: 'בנסיעה', icon: '🚗' },
  { key: 'completed', label: 'הושלם', icon: '✅' },
]
const CANCELLED_STEPS = [
  { key: 'requested', label: 'הוזמן', icon: '📍' },
  { key: 'accepted',  label: 'אישר נהג', icon: '✋' },
  { key: 'cancelled', label: 'בוטל', icon: '❌' },
]

function Stars({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>—</span>
  return (
    <span style={{ fontSize: '0.85rem', letterSpacing: '1px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= score ? '#fbbf24' : 'var(--border)' }}>★</span>
      ))}
    </span>
  )
}

function RideTimeline({ ride }: { ride: DemoReportData['rides'][number] }) {
  const isCancelled = ride.status === 'cancelled'
  const steps = isCancelled ? CANCELLED_STEPS : STATUS_STEPS
  const timeline = ride.timeline

  return (
    <div style={{ display: 'flex', gap: '0', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.4rem' }}>
      {steps.map((step, i) => {
        const ts = timeline[step.key as keyof typeof timeline]
        const active = Boolean(ts)
        const color = active ? (step.key === 'cancelled' ? 'var(--danger)' : 'var(--success)') : 'var(--border)'
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', opacity: active ? 1 : 0.35 }}>{step.icon}</div>
              <div style={{ fontSize: '0.62rem', color, fontWeight: active ? 700 : 400 }}>{step.label}</div>
              {ts && (
                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)' }}>
                  {new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '24px', height: '2px', background: color, margin: '0 4px', marginBottom: '14px', opacity: active ? 1 : 0.2 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RideCard({ ride, index }: { ride: DemoReportData['rides'][number]; index: number }) {
  const isCancelled = ride.status === 'cancelled'
  const specialColor = SPECIAL_COLORS[ride.special_code] ?? 'var(--text-secondary)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isCancelled ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        background: isCancelled ? 'rgba(248,113,113,0.06)' : 'var(--background)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: isCancelled ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.12)',
          color: isCancelled ? 'var(--danger)' : 'var(--success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.85rem',
        }}>
          {index}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
            {ride.passenger} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>← → </span> {ride.driver}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {ride.driver_city} | 🚗 {ride.driver_vehicle}
          </div>
        </div>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '20px',
          background: `${specialColor}18`, color: specialColor, border: `1px solid ${specialColor}30`,
          whiteSpace: 'nowrap',
        }}>
          {ride.special}
        </span>
        <span style={{
          fontSize: '0.82rem', fontWeight: 800,
          color: isCancelled ? 'var(--danger)' : 'var(--accent)',
        }}>
          ₪{ride.total_fare.toFixed(2)}
        </span>
      </div>

      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {/* Route */}
        <div style={{ fontSize: '0.82rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1px' }}>🔴</span>
          <span>{ride.pickup}</span>
        </div>
        <div style={{ fontSize: '0.82rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1px' }}>🏁</span>
          <span>{ride.dropoff}</span>
        </div>

        {/* Address change badge */}
        {ride.address_change && (
          <div style={{
            fontSize: '0.75rem', padding: '0.35rem 0.6rem', borderRadius: '6px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
            color: '#8b5cf6',
          }}>
            🔄 יעד שונה: <strong>{ride.address_change.original_dropoff}</strong> →{' '}
            <strong>{ride.address_change.new_dropoff}</strong>{' '}
            ({ride.address_change.original_km}km → {ride.address_change.new_km}km)
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {ride.distance_km > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              📏 <strong style={{ color: 'var(--text-primary)' }}>{ride.distance_km} ק״מ</strong>
            </div>
          )}
          {ride.ride_minutes > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              ⏱ <strong style={{ color: 'var(--text-primary)' }}>{ride.ride_minutes + ride.traffic_minutes} דק׳</strong>
            </div>
          )}
          {ride.wait_minutes > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#f59e0b' }}>
              ⏳ המתנה: <strong>{ride.wait_minutes} דק׳</strong>
            </div>
          )}
          {ride.traffic_minutes > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#f97316' }}>
              🚦 פקק: <strong>+{ride.traffic_minutes} דק׳</strong>
            </div>
          )}
          {ride.multiplier !== 1 && (
            <div style={{ fontSize: '0.78rem', color: '#eab308' }}>
              ×<strong>{ride.multiplier}</strong>
            </div>
          )}
        </div>

        {/* Fare breakdown */}
        <div style={{
          background: 'var(--background)', borderRadius: '6px', padding: '0.5rem 0.75rem',
          fontSize: '0.75rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap',
        }}>
          <span>סה״כ: <strong>₪{ride.total_fare.toFixed(2)}</strong></span>
          <span style={{ color: 'var(--text-secondary)' }}>פלטפורמה: <strong>₪{ride.platform_fee.toFixed(2)}</strong></span>
          <span style={{ color: 'var(--success)' }}>לנהג: <strong>₪{ride.driver_earnings.toFixed(2)}</strong></span>
        </div>

        {/* Timeline */}
        <RideTimeline ride={ride} />

        {/* Ratings */}
        {!isCancelled && (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>נוסע→נהג:</span>
              <Stars score={ride.passenger_rating} />
              {ride.passenger_comment && (
                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  "{ride.passenger_comment}"
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DriverCard({ driver }: { driver: DemoReportData['drivers'][number] }) {
  const isLicensed = driver.driver_type === 'licensed_taxi'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,215,0,0.12)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.8rem',
        }}>
          {driver.number}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{driver.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            📍 {driver.city} · 🚗 {driver.vehicle_number}
          </div>
        </div>
        <span style={{
          marginRight: 'auto', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
          background: isLicensed ? 'rgba(234,179,8,0.12)' : 'rgba(59,130,246,0.1)',
          color: isLicensed ? '#eab308' : '#3b82f6',
          border: `1px solid ${isLicensed ? 'rgba(234,179,8,0.25)' : 'rgba(59,130,246,0.2)'}`,
        }}>
          {isLicensed ? '🚕 מונית' : '🚗 שיתופי'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {driver.docs.map((doc, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.72rem', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--success)', flexShrink: 0 }}>✅</span>
            <div>
              <span style={{ fontWeight: 600 }}>{doc.type}</span>
              <span style={{ color: 'var(--text-secondary)' }}> · {doc.doc_number} · עד {doc.expiry}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DemoReport() {
  const [report, setReport] = useState<DemoReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'rides' | 'drivers' | 'passengers'>('rides')

  useEffect(() => { loadReport() }, [])

  async function loadReport() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.demoReport.get()
      setReport(data)
    } catch (e: any) {
      if (e.message?.includes('404') || e.message?.includes('לא נמצא')) {
        setError('אין דמו זמין. לחץ "הרץ דמו" ליצירת נתוני הדגמה.')
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  async function runSeed(force = false) {
    setSeeding(true)
    setError(null)
    try {
      const data = await api.demoReport.seed(force)
      setReport(data)
    } catch (e: any) {
      setError(`שגיאה בהרצת הדמו: ${e.message}`)
    }
    setSeeding(false)
  }

  const s = report?.summary

  const tabs: { key: 'rides' | 'drivers' | 'passengers'; label: string; count?: number }[] = [
    { key: 'rides',      label: '🛣️ נסיעות',   count: report?.rides.length },
    { key: 'drivers',    label: '🚗 נהגים',    count: report?.drivers.length },
    { key: 'passengers', label: '👤 נוסעים',   count: report?.passengers.length },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>🎭 דמו המערכת — נתוני הדגמה</h1>
        <div style={{ marginRight: 'auto', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => runSeed(false)}
            disabled={seeding || Boolean(report)}
            style={{ fontSize: '0.82rem' }}
          >
            {seeding ? '⏳ מייצר...' : '▶ הרץ דמו'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => runSeed(true)}
            disabled={seeding}
            style={{ fontSize: '0.82rem' }}
          >
            🔄 הרץ מחדש
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '1.5rem' }}>↻</span>
        </div>
      )}

      {seeding && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎭</div>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>מייצר נתוני דמו...</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            יוצר 10 נהגים מאומתים, 10 נוסעים ו-10 נסיעות עם תשלומים, דירוגים ולוגי ביקורת
          </div>
        </div>
      )}

      {error && !report && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎭</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>
          <button className="btn btn-primary" onClick={() => runSeed(false)} disabled={seeding}>
            {seeding ? '⏳ מייצר...' : '▶ הרץ דמו'}
          </button>
        </div>
      )}

      {report && !seeding && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'נהגים', value: s?.drivers_created, icon: '🚗', color: 'var(--accent)' },
              { label: 'נוסעים', value: s?.passengers_created, icon: '👤', color: '#3b82f6' },
              { label: 'נסיעות', value: s?.rides_created, icon: '🛣️', color: 'var(--success)' },
              { label: 'הושלמו', value: s?.rides_completed, icon: '✅', color: 'var(--success)' },
              { label: 'בוטלו', value: s?.rides_cancelled, icon: '❌', color: 'var(--danger)' },
              { label: 'הכנסות', value: `₪${(s?.total_revenue_ils || 0).toFixed(0)}`, icon: '💰', color: '#22c55e' },
              { label: 'לוגים', value: s?.audit_logs_created, icon: '📋', color: '#8b5cf6' },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                padding: '0.75rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{card.icon}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Metadata */}
          {report.generated_at && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              🕐 נוצר: {new Date(report.generated_at).toLocaleString('he-IL')}
              {report.seeded === true && ' · ✅ הוכנס למסד הנתונים בהצלחה'}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.5rem 1rem', border: 'none', cursor: 'pointer',
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
                  fontSize: '0.88rem', transition: 'all 0.15s',
                  marginBottom: '-1px',
                }}
              >
                {tab.label} {tab.count != null && <span style={{ fontSize: '0.72rem', background: 'var(--background)', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'rides' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {report.rides.map((ride, i) => (
                <RideCard key={ride.scenario_id} ride={ride} index={i + 1} />
              ))}
            </div>
          )}

          {activeTab === 'drivers' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {report.drivers.map(driver => (
                <DriverCard key={driver.number} driver={driver} />
              ))}
            </div>
          )}

          {activeTab === 'passengers' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {report.passengers.map(p => (
                <div key={p.number} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.85rem',
                  }}>
                    {p.number}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace', direction: 'ltr' }}>{p.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
