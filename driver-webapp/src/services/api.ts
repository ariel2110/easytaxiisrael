import type { User, Ride, FareEstimate, WalletEntry, ComplianceProgress, OnboardingProgress, PersonaInquiryResponse } from '../types'

const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return false
  try {
    const res = await fetch(`${BASE}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return true
  } catch { return false }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  let res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  // Auto-refresh on 401
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export interface WaAuthLinkResponse {
  session_id: string
  whatsapp_link: string
  message_preview: string
  expires_in_seconds: number
}

export interface WaPollResponse {
  status: 'pending' | 'completed' | 'expired'
  access_token?: string
  refresh_token?: string
  role?: string
  kyc_url?: string
}

// ----- Auth -----
export const api = {
  auth: {
    requestWaAuth: (phone: string, role: string = 'driver') =>
      request<WaAuthLinkResponse>('POST', '/auth/wa/request', { phone, role }, false),

    pollWaAuth: (session_id: string) =>
      request<WaPollResponse>('GET', `/auth/wa/poll/${session_id}`, undefined, false),

    me: () => request<User>('GET', '/auth/me'),

    logout: () =>
      request<{ message: string }>('POST', '/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token') ?? '',
      }),

    updateProfile: (data: { full_name?: string; email?: string }) =>
      request<User>('PATCH', '/auth/profile', data),
  },

  // ----- Rides -----
  rides: {
    list: () => request<Ride[]>('GET', '/rides'),
    get: (id: string) => request<Ride>('GET', `/rides/${id}`),
    accept: (id: string) => request<Ride>('POST', `/rides/${id}/accept`),
    reject: (id: string) => request<Ride>('POST', `/rides/${id}/reject`),
    start: (id: string) => request<Ride>('POST', `/rides/${id}/start`),
    end: (id: string) => request<Ride>('POST', `/rides/${id}/end`),
    fare: (id: string) => request<FareEstimate>('GET', `/rides/${id}/fare`),
  },

  // ----- Tracking -----
  tracking: {
    postLocation: (rideId: string, lat: number, lng: number) =>
      request<unknown>('POST', `/rides/${rideId}/location`, { lat, lng }),
  },

  // ----- Wallet -----
  wallet: {
    get: () => request<{ balance: string }>('GET', '/wallet'),
    transactions: () => request<WalletEntry[]>('GET', '/wallet/transactions'),
  },

  // ----- Compliance -----
  compliance: {
    progress: () => request<ComplianceProgress>('GET', '/driver/compliance/progress'),
    status: () => request<ComplianceProgress>('GET', '/driver/compliance'),
  },

  // ----- Onboarding -----
  onboarding: {
    progress: () => request<OnboardingProgress>('GET', '/compliance/progress'),
  },

  // ----- Persona KYC -----
  persona: {
    startInquiry: () => request<PersonaInquiryResponse>('POST', '/persona/inquiry'),
    getStatus: () => request<PersonaInquiryResponse>('GET', '/persona/inquiry/status'),
  },

  // ----- Vehicle -----
  vehicle: {
    startInquiry: () => request<PersonaInquiryResponse>('POST', '/vehicle/inquiry'),
    getStatus: () => request<{ persona_inquiry_id: string; status: string; hosted_flow_url: string | null } | null>('GET', '/vehicle/inquiry/status'),
  },
}
