export interface User {
  id: string
  phone: string
  role: 'driver' | 'passenger' | 'admin'
  is_active: boolean
  auth_status: 'pending' | 'whatsapp_verified' | 'persona_in_progress' | 'persona_completed' | 'approved'
  full_name: string | null
  email: string | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export type RideStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'

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

export interface RideRequest {
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
}

export interface LocationPayload {
  lat: number
  lng: number
  timestamp: string
}
