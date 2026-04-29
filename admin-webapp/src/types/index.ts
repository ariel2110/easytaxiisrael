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
