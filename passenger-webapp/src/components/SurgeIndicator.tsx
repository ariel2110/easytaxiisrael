interface Props {
  surge: { surge_multiplier: string; demand_level: string }
}

const demandColor: Record<string, string> = {
  low:       'surge-1x',
  medium:    'surge-1x',
  high:      'surge-2x',
  very_high: 'surge-3x',
}

const demandIcon: Record<string, string> = {
  low:       '😌',
  medium:    '🚗',
  high:      '🔥',
  very_high: '⚡',
}

export default function SurgeIndicator({ surge }: Props) {
  const mult = parseFloat(surge.surge_multiplier)
  if (mult <= 1.05) return null

  const colorClass = demandColor[surge.demand_level] ?? 'surge-2x'
  const icon = demandIcon[surge.demand_level] ?? '🔥'

  return (
    <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
      <span className={`surge-badge ${colorClass}`}>
        {icon} {mult.toFixed(1)}× surge
      </span>
      <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
        High demand — fares are higher than usual
      </span>
    </div>
  )
}
