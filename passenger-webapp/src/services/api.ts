import type { TokenPair, User, Ride, FareEstimate, RideRequest } from '../types'

const BASE = '/api'

function getToken() { return localStorage.getItem('access_token') }

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) { const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}` }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail ?? 'Request failed') }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    requestOtp: (phone: string) => request<{ message: string }>('POST', '/auth/otp/request', { phone }, false),
    verifyOtp:  (phone: string, otp: string) => request<TokenPair>('POST', '/auth/otp/verify', { phone, otp }, false),
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
