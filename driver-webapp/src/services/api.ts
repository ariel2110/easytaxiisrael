import type { User, Ride, FareEstimate, WalletEntry, ComplianceProgress } from '../types'

const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('access_token')
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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
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
    /** New primary auth: request a wa.me deep link */
    requestWaAuth: (phone: string, role: string = 'driver') =>
      request<WaAuthLinkResponse>('POST', '/auth/wa/request', { phone, role }, false),

    /** Poll for token completion */
    pollWaAuth: (session_id: string) =>
      request<WaPollResponse>('GET', `/auth/wa/poll/${session_id}`, undefined, false),

    me: () => request<User>('GET', '/auth/me'),

    logout: () =>
      request<{ message: string }>('POST', '/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token') ?? '',
      }),
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
}
