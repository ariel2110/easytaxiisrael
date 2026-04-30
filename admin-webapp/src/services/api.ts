import type { AdminUser, DriverAdminRead, PlatformStats, AdminRide, AuditLog, AIAgent, AIChatResponse, AIChatHistory, AIKeyUpdateResponse, VehicleCheckResult, SumsubApplicantsResponse } from '../types'

const BASE = '/api'
const ADMIN_KEY = 'e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2'

function getToken() { return localStorage.getItem('admin_token') }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY }
  const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(e.detail ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      req<{ access_token: string; refresh_token: string; role: string }>(
        'POST', '/auth/admin/login', { username, password }
      ),
    me: () => req<AdminUser>('GET', '/auth/me'),
  },
  stats: {
    get: () => req<PlatformStats>('GET', '/admin/stats'),
  },
  users: {
    list: (skip = 0, limit = 100, role?: string) =>
      req<AdminUser[]>('GET', `/admin/users?skip=${skip}&limit=${limit}${role ? `&role=${role}` : ''}`),
    activate:   (id: string) => req<AdminUser>('PATCH', `/admin/users/${id}/activate`),
    deactivate: (id: string) => req<AdminUser>('PATCH', `/admin/users/${id}/deactivate`),
    approve:    (id: string) => req<AdminUser>('PATCH', `/admin/users/${id}/approve`),
    setDriverType: (id: string, driver_type: string) =>
      req<AdminUser>('PATCH', `/admin/users/${id}/driver-type`, { driver_type }),
  },
  vehicleCheck: {
    get:  (driverId: string) => req<VehicleCheckResult>('GET',  `/admin/vehicle-check/${driverId}`),
    run:  (driverId: string) => req<VehicleCheckResult>('POST', `/admin/vehicle-check/${driverId}/run`),
  },
  sumsub: {
    applicants: (status?: string) =>
      req<SumsubApplicantsResponse>('GET', `/admin/sumsub/applicants${status ? `?filter_status=${status}` : ''}`),
  },
  drivers: {
    list: (skip = 0, limit = 100) =>
      req<DriverAdminRead[]>('GET', `/admin/drivers?skip=${skip}&limit=${limit}`),
  },
  rides: {
    list: (skip = 0, limit = 100, status?: string) =>
      req<AdminRide[]>('GET', `/admin/rides?skip=${skip}&limit=${limit}${status ? `&status=${status}` : ''}`),
  },
  audit: {
    list: (skip = 0, limit = 100) =>
      req<AuditLog[]>('GET', `/admin/audit-logs?skip=${skip}&limit=${limit}`),
  },
  aiAgents: {
    list: () => req<AIAgent[]>('GET', '/admin/ai-agents'),
    chat: (agentId: string, message: string, model?: string) =>
      req<AIChatResponse>('POST', `/admin/ai-agents/${agentId}/chat`, { message, model }),    history: (agentId: string) => req<AIChatHistory[]>('GET', `/admin/ai-agents/${agentId}/history`),    updateKey: (agentId: string, api_key: string) =>
      req<AIKeyUpdateResponse>('PUT', `/admin/ai-agents/${agentId}/key`, { api_key }),
    disable: (agentId: string) => req<{ success: boolean }>('DELETE', `/admin/ai-agents/${agentId}/key`),
  },
  whatsapp: {
    config: () => req<{ api_key: string; instance: string; evolution_url: string }>('GET', '/whatsapp/config'),
    status: (adminKey: string) => fetch(`${BASE}/whatsapp/status`, {
      headers: { 'X-Admin-Key': adminKey, 'Authorization': `Bearer ${getToken()}` },
    }).then(r => r.json()),
    qr: (adminKey: string) => fetch(`${BASE}/whatsapp/qr`, {
      headers: { 'X-Admin-Key': adminKey, 'Authorization': `Bearer ${getToken()}` },
    }).then(r => r.json()),
    reconnect: (adminKey: string) => fetch(`${BASE}/whatsapp/reconnect`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey, 'Authorization': `Bearer ${getToken()}` },
    }).then(r => r.json()),
    fixWebhook: (adminKey: string) => fetch(`${BASE}/whatsapp/fix-webhook`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey, 'Authorization': `Bearer ${getToken()}` },
    }).then(r => r.json()),
    testSend: (adminKey: string, phone: string) => fetch(`${BASE}/whatsapp/test-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey, 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ phone }),
    }).then(r => r.json()),
  },
}
