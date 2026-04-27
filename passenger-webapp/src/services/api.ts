import type { User, Ride, FareEstimate, RideRequest } from '../types'

const BASE = '/api'

function getToken() { return localStorage.getItem('access_token') }

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) { const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}` }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail ?? 'Request failed') }
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

export const api = {
  auth: {
    requestWaAuth: (phone: string, role: string = 'passenger') =>
      request<WaAuthLinkResponse>('POST', '/auth/wa/request', { phone, role }, false),
    pollWaAuth: (session_id: string) =>
      request<WaPollResponse>('GET', `/auth/wa/poll/${session_id}`, undefined, false),
    me: () => request<User>('GET', '/auth/me'),
    logout: () => request<{ message: string }>('POST', '/auth/logout', { refresh_token: localStorage.getItem('refresh_token') ?? '' }),
  },
  rides: {
    request: (data: RideRequest) => request<Ride>('POST', '/rides', data),
    list:    () => request<Ride[]>('GET', '/rides'),
    get:     (id: string) => request<Ride>('GET', `/rides/${id}`),
    cancel:  (id: string) => request<Ride>('POST', `/rides/${id}/cancel`),
    fare:    (id: string) => request<FareEstimate>('GET', `/rides/${id}/fare`),
  },
  ai: {
    intelligence: () => request<{ surge_multiplier: string; demand_level: string }>('GET', '/ai/intelligence'),
  },
}
