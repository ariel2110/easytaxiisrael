import type { ComplianceProgress } from '../types'

interface Props {
  compliance: ComplianceProgress
}

const statusColor: Record<string, string> = {
  approved: 'var(--success)',
  warning:  'var(--warning)',
  blocked:  'var(--danger)',
}

export default function ComplianceBar({ compliance }: Props) {
  const color = statusColor[compliance.status] ?? 'var(--text-secondary)'

  if (compliance.status === 'approved') return null   // no noise when fully compliant

  return (
    <div className="card slide-in" style={{
      borderColor: color,
      marginBottom: '1rem',
      background: `${color}11`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, color }}>
          {compliance.status === 'blocked' ? '⛔ Account Blocked' : '⚠️ Action Required'}
        </span>
        <span style={{ fontSize: '0.875rem', color }}>
          {compliance.compliance_score}%
        </span>
      </div>
      <div style={{
        height: 6,
        background: 'var(--bg-elevated)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: '0.5rem',
      }}>
        <div style={{
          height: '100%',
          width: `${compliance.progress_pct}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 600ms ease',
        }} />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {compliance.steps_completed}/{compliance.steps_total} steps completed
        {compliance.expired_documents > 0 && (
          <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>
            · {compliance.expired_documents} expired document{compliance.expired_documents > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
