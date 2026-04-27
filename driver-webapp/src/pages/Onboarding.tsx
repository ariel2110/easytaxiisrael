import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { OnboardingProgress, OnboardingStep } from '../types'

const doneStatuses = new Set(['approved', 'completed', 'ready'])

const statusLabel: Record<string, string> = {
  not_started: 'לא התחיל',
  pending: 'ממתין לאישור',
  approved: 'הושלם',
  completed: 'הושלם',
  ready: 'מוכן',
  declined: 'נדחה',
  rejected: 'נדחה',
  expired: 'פג תוקף',
}

const statusColor: Record<string, string> = {
  not_started: 'var(--text-secondary)',
  pending: 'var(--warning)',
  approved: 'var(--success)',
  completed: 'var(--success)',
  ready: 'var(--success)',
  declined: 'var(--danger)',
  rejected: 'var(--danger)',
  expired: 'var(--danger)',
}

function isCompleted(step: OnboardingStep): boolean {
  return doneStatuses.has(step.status)
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const data = await api.onboarding.progress()
      setProgress(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const requiredComplete = useMemo(() => {
    if (!progress) return false
    return progress.steps
      .filter((step) => step.required)
      .every((step) => isCompleted(step))
  }, [progress])

  useEffect(() => {
    if (requiredComplete) {
      navigate('/home', { replace: true })
    }
  }, [requiredComplete, navigate])

  async function runIdentityKyc() {
    setBusyStep('identity_kyc')
    setError(null)
    try {
      const res = await api.persona.startInquiry()
      if (res.hosted_flow_url) {
        window.open(res.hosted_flow_url, '_blank', 'noopener,noreferrer')
      }
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyStep(null)
    }
  }

  async function runVehicleCompliance() {
    setBusyStep('vehicle_compliance')
    setError(null)
    try {
      const res = await api.vehicle.startInquiry()
      if (res.hosted_flow_url) {
        window.open(res.hosted_flow_url, '_blank', 'noopener,noreferrer')
      }
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyStep(null)
    }
  }

  function renderAction(step: OnboardingStep): JSX.Element | null {
    if (isCompleted(step)) return null

    if (step.id === 'identity_kyc') {
      return (
        <button className="btn btn-primary" disabled={busyStep !== null} onClick={runIdentityKyc}>
          {busyStep === 'identity_kyc' ? 'פותח אימות…' : 'התחל אימות זהות'}
        </button>
      )
    }

    if (step.id === 'vehicle_compliance') {
      return (
        <button className="btn btn-primary" disabled={busyStep !== null} onClick={runVehicleCompliance}>
          {busyStep === 'vehicle_compliance' ? 'פותח אימות…' : 'המשך אימות רכב'}
        </button>
      )
    }

    if (step.id === 'compliance_docs') {
      return (
        <button className="btn" disabled={refreshing} onClick={() => refresh()}>
          רענן סטטוס מסמכים
        </button>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          טוען סטטוס אימות…
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
      <div className="card slide-in" style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '.25rem' }}>🧾</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>השלמת אימות נהג</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '.25rem' }}>
            אחרי האימות הראשוני, משלימים כאן את כל שלבי הנהג.
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.35rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>התקדמות כללית</span>
            <span style={{ fontWeight: 600 }}>{progress?.overall_pct ?? 0}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress?.overall_pct ?? 0}%`,
                background: 'linear-gradient(90deg, #22c55e, #f59e0b)',
                transition: 'width 400ms ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {progress?.steps.map((step) => {
            const color = statusColor[step.status] ?? 'var(--text-secondary)'
            const label = statusLabel[step.status] ?? step.status
            return (
              <div
                key={step.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '.85rem',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{step.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>
                      {step.required ? 'שלב חובה' : 'שלב אופציונלי'}
                    </div>
                  </div>
                  <div style={{ color, fontWeight: 600, fontSize: '.85rem' }}>{label}</div>
                </div>
                {renderAction(step)}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="fade-in" style={{ marginTop: '1rem', padding: '.75rem', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
          <button className="btn" onClick={() => refresh()} disabled={refreshing || busyStep !== null}>
            {refreshing ? 'מרענן…' : 'רענן סטטוס'}
          </button>
          <button className="btn" onClick={() => navigate('/home')}>
            המשך לדשבורד
          </button>
        </div>
      </div>
    </div>
  )
}
