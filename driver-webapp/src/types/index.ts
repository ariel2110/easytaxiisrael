export interface User {
  id: string
  phone: string
  role: 'driver' | 'passenger' | 'admin'
  is_active: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export type RideStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Ride {
  id: string
  passenger_id: string
  driver_id: string | null
  status: RideStatus
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
  requested_at: string
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface FareEstimate {
  base_fare: number
  distance_km: number
  distance_fare: number
  subtotal: number
  platform_fee: number
  tax_amount: number
  driver_earnings: number
  total: number
  surge_multiplier: string
}

export interface WalletEntry {
  id: string
  amount: string
  balance_after: string
  description: string
  created_at: string
}

export interface ComplianceProgress {
  driver_id: string
  compliance_score: number
  status: 'approved' | 'warning' | 'blocked'
  progress_pct: number
  steps_completed: number
  steps_total: number
  steps: Array<{
    step_name: string
    step_order: number
    completed: boolean
    completed_at: string | null
  }>
  pending_documents: number
  expired_documents: number
}

export interface LocationPayload {
  lat: number
  lng: number
  timestamp: string
}
