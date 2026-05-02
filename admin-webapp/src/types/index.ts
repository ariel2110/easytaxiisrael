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
  pending_approvals: number
}

export interface PendingApprovalItem {
  id: string
  phone: string
  full_name: string | null
  driver_type: 'licensed_taxi' | 'rideshare' | null
  auth_status: string
  auth_status_label: string
  is_active: boolean
  created_at: string
  // Sumsub data (optional)
  sumsub_id?: string
  level?: string
  sumsub_status?: string
  review_result?: string | null
  reject_labels?: string[]
  sumsub_updated_at?: string
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

// ── System Health ────────────────────────────────────────────────
export interface SystemHealthAgent {
  id: string
  name: string
  icon: string
  model: string
  enabled: boolean
  key_field: string
  key_configured: boolean
}

export interface SystemHealth {
  overall: 'ok' | 'degraded' | 'error'
  timestamp: string
  services: {
    database: { status: string; users: number; drivers: number; rides: number }
    redis:    { status: string; memory: string }
    whatsapp: {
      status: string
      provider: string
      state: string
      phone: string | null
      profile_name: string | null
      quality_rating: string
      phone_number_id: string
    }
  }
  llm_keys: Record<string, boolean>
  agents: SystemHealthAgent[]
  agents_enabled_count: number
  agents_total_count: number
}

// ── Daily AI Report ──────────────────────────────────────────────
export interface KPI {
  name: string
  value: string | number
  benchmark: string | number
  status: 'good' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
}

export interface TopAction {
  priority: number
  title: string
  description: string
  timeframe: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

export interface Bottleneck {
  area: string
  description: string
  impact_level: 'low' | 'medium' | 'high'
  affected_party: 'driver' | 'passenger' | 'platform' | 'all'
}

export interface GrowthOpportunity {
  title: string
  description: string
  potential_revenue_ils_monthly: number | null
  complexity: 'low' | 'medium' | 'high'
}

export interface TechHealth {
  score: number
  strong_points: string[]
  weak_points: string[]
  recommendations: string[]
}

export interface DailyReport {
  executive_summary: string
  overall_health_score: number
  health_label: string
  kpis: KPI[]
  bottlenecks: Bottleneck[]
  top_actions: TopAction[]
  growth_opportunities: GrowthOpportunity[]
  tech_health: TechHealth
  generated_at: string
  model_used?: string
}

// ── Demo Report ────────────────────────────────────────────────────

export interface DemoDoc {
  name: string
  doc_number: string
  expiry: string
  type: string
}

export interface DemoDriver {
  number: number
  name: string
  phone: string
  city: string
  vehicle_number: string
  driver_type: 'licensed_taxi' | 'rideshare'
  docs: DemoDoc[]
  doc_count: number
  audit_logs_created: number
}

export interface DemoPassenger {
  number: number
  name: string
  phone: string
}

export interface DemoAddressChange {
  original_dropoff: string
  new_dropoff: string
  original_km: number
  new_km: number
}

export interface DemoRideTimeline {
  requested: string
  assigned: string
  accepted: string
  started: string | null
  completed: string | null
  cancelled: string | null
}

export interface DemoRide {
  scenario_id: number
  status: 'completed' | 'cancelled'
  special: string
  special_code: string
  passenger: string
  driver: string
  driver_city: string
  driver_vehicle: string
  pickup: string
  dropoff: string
  distance_km: number
  ride_minutes: number
  wait_minutes: number
  traffic_minutes: number
  multiplier: number
  total_fare: number
  platform_fee: number
  driver_earnings: number
  passenger_rating: number | null
  driver_rating: number | null
  passenger_comment: string | null
  driver_comment: string | null
  address_change: DemoAddressChange | null
  timeline: DemoRideTimeline
}

export interface DemoSummary {
  drivers_created: number
  passengers_created: number
  rides_created: number
  rides_completed: number
  rides_cancelled: number
  total_revenue_ils: number
  total_platform_fee_ils: number
  audit_logs_created: number
}

export interface Lead {
  id: string
  phone: string | null
  name: string | null
  status: string
  source: string
  whatsapp_capable: boolean
  message_text: string | null
  area: string | null
  business_type: string | null
  email: string | null
  website: string | null
  notes: string | null
  approved_at: string | null
  sent_at: string | null
  created_at: string
}

export interface FindLeadsResponse {
  found: number
  inserted: number
  skipped_duplicate: number
  skipped_no_phone: number
  whatsapp_capable: number
  with_email: number
}

export interface LeadsListResponse {
  total: number
  page: number
  page_size: number
  total_pages: number
  items: Lead[]
}

export interface DemoReportData {
  seeded?: boolean
  already_seeded?: boolean
  message?: string
  summary: DemoSummary
  drivers: DemoDriver[]
  passengers: DemoPassenger[]
  rides: DemoRide[]
  generated_at: string
}


export interface DriverApplicationItem {
  id: string
  user_id: string
  driver_type: string
  status: 'submitted' | 'sumsub_pending' | 'docs_required' | 'ai_review' | 'pending_admin' | 'approved' | 'rejected'
  status_label: string
  next_step: string
  has_vehicle: boolean
  vehicle_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  years_driving: number | null
  motivation: string | null
  rejection_reason: string | null
  admin_notes: string | null
  phone: string
  full_name: string | null
  user_role: string | null
  auth_status: string | null
  created_at: string
}
