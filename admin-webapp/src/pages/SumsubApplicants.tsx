import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { SumsubApplicant } from '../types'

const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-gray',
  pending:     'badge-yellow',
  approved:    'badge-green',
  rejected:    'badge-red',
  on_hold:     'badge-yellow',
  awaiting:    'badge-blue',
}

const REVIEW_BADGE: Record<string, string> = {
  GREEN: 'badge-green',
  RED:   'badge-red',
  YELLOW: 'badge-yellow',
}

const RISK_LABEL_DESCRIPTIONS: Record<string, string> = {
  manyAccountDuplicates: 'כפילויות חשבונות מרובות',
  docExpired:            'מסמך פג תוקף',
  docUnreadable:         'מסמך לא קריא',
  faceNotMatch:          'פנים לא תואמות',
  selfieAttack:          'ניסיון תקיפת סלפי',
  screenedOut:           'סונן החוצה',
  unknownClient:         'לקוח לא מוכר',
  fraudulent:            'חשד להונאה',
  compromised:           'חשבון נפרץ',
}

function RiskBadge({ label }: { label: string }) {
  return (
    <span
      title={RISK_LABEL_DESCRIPTIONS[label] ?? label}
      style={{
        display: 'inline-block',
        background: 'var(--danger)',
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '0.7rem',
        fontWeight: 700,
        marginRight: '4px',
        marginBottom: '3px',
        cursor: 'default',
      }}
    >
      ⚠ {RISK_LABEL_DESCRIPTIONS[label] ?? label}
    </span>
  )
}

export default function SumsubApplicants() {
  const [applicants, setApplicants] = useState<SumsubApplicant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await api.sumsub.applicants(statusFilter || undefined)
      setApplicants(data.applicants)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const withRisk = applicants.filter(a => a.reject_labels && a.reject_labels.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Sumsub KYC</h1>
          {withRisk.length > 0 && (
            <span className="badge badge-red" style={{ marginTop: '0.3rem', display: 'inline-block' }}>
              {withRisk.length} עם סימוני סיכון
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">כל הסטטוסים</option>
            <option value="not_started">לא התחיל</option>
            <option value="pending">בתהליך</option>
            <option value="approved">אושר</option>
            <option value="rejected">נדחה</option>
            <option value="on_hold">בהמתנה</option>
          </select>
          <button className="btn btn-ghost" onClick={load}>↻</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>שגיאה: {error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}><span className="spin">↻</span></div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Sumsub ID</th>
                  <th>Driver ID</th>
                  <th>רמה</th>
                  <th>סטטוס</th>
                  <th>תוצאה</th>
                  <th>סימוני סיכון</th>
                  <th>עודכן</th>
                </tr>
              </thead>
              <tbody>
                {applicants.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>אין נתונים</td></tr>
                )}
                {applicants.map(a => (
                  <tr key={a.id} className="fade-in" style={a.reject_labels && a.reject_labels.length > 0 ? { background: 'rgba(220,50,50,0.05)' } : undefined}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.sumsub_applicant_id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.driver_id.slice(0, 8)}…</td>
                    <td style={{ fontSize: '0.8rem' }}>{a.level_name}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-gray'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.review_result
                        ? <span className={`badge ${REVIEW_BADGE[a.review_result] ?? 'badge-gray'}`}>{a.review_result}</span>
                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      }
                    </td>
                    <td style={{ minWidth: 200 }}>
                      {a.reject_labels && a.reject_labels.length > 0
                        ? a.reject_labels.map(label => <RiskBadge key={label} label={label} />)
                        : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>
                      }
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(a.updated_at).toLocaleString('he-IL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {applicants.length} רשומות
        </div>
      </div>
    </div>
  )
}
