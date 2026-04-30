// ── Admin API types ────────────────────────────────────────────────

export interface AdminUser {
  id: string
  phone: string
  role: 'driver' | 'passenger' | 'admin'
  driver_type: 'licensed_taxi' | 'rideshare' | null
  auth_status: string | null
  is_active: boolean
  full_name: string | null
  created_at: string
}

export interface DriverAdminRead {
  id: string
  phone: string
  is_active: boolean
  wallet_balance: number | null
  average_rating: number | null
  total_ratings: number
  created_at: string
}

export interface PlatformStats {
  total_users: number
  total_drivers: number
  total_passengers: number
  active_drivers: number
  total_rides: number
  completed_rides: number
  cancelled_rides: number
  pending_rides: number
  total_revenue: number
  total_payments: number
}

export interface AdminRide {
  id: string
  status: string
  passenger_id: string
  driver_id: string | null
  pickup_address: string | null
  dropoff_address: string | null
  created_at: string | null
  completed_at: string | null
}

export interface AIAgent {
  id: string
  name: string
  icon: string
  enabled: boolean
  key_masked: string
  models: string[]
  default_model: string
}

export interface AIChatResponse {
  reply: string
  model: string
  agent_id: string
}

export interface AIKeyUpdateResponse {
  success: boolean
  agent_id: string
  key_masked: string
}

export interface AIChatHistory {
  id: string
  timestamp: string
  message: string
  reply: string
  model: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  detail: string | null
  created_at: string
}

export interface VehicleCheckResult {
  found: boolean
  is_active: boolean
  is_removed: boolean
  is_taxi: boolean
  manufacturer?: string | null
  model?: string | null
  color?: string | null
  year?: string | null
  ownership?: string | null
  test_expiry?: string | null
  last_test_date?: string | null
  chassis?: string | null
  fuel_type?: string | null
  warnings: string[]
  message?: string
}

export interface SumsubApplicant {
  id: string
  driver_id: string
  sumsub_applicant_id: string
  level_name: string
  status: string
  review_result: string | null
  reject_labels: string[] | null
  created_at: string
  updated_at: string
}

export interface SumsubApplicantsResponse {
  total: number
  applicants: SumsubApplicant[]
}
