import type { AdminUser, DriverAdminRead, PlatformStats, AdminRide, AuditLog, AIAgent, AIChatResponse, AIChatHistory, AIKeyUpdateResponse, VehicleCheckResult, SumsubApplicantsResponse, SystemHealth, DailyReport, DemoReportData, Lead, FindLeadsResponse, LeadsListResponse } from '../types'

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
  systemHealth: {
    get: () => req<SystemHealth>('GET', '/admin/system-health'),
  },
  dailyReport: {
    get:      () => req<DailyReport>('GET',  '/admin/daily-report'),
    generate: () => req<DailyReport>('POST', '/admin/daily-report/generate'),
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

  demoReport: {
    get:  ()              => req<DemoReportData>('GET',  '/admin/demo-report'),
    seed: (force = false) => req<DemoReportData>('POST', `/admin/seed-demo${force ? '?force=true' : ''}`),
  },

  leads: {
    list: (params?: { status?: string; whatsapp_only?: boolean; area?: string; search?: string; page?: number; page_size?: number }) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.whatsapp_only) qs.set('whatsapp_only', 'true')
      if (params?.area) qs.set('area', params.area)
      if (params?.search) qs.set('search', params.search)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.page_size) qs.set('page_size', String(params.page_size))
      const query = qs.toString() ? `?${qs}` : ''
      return req<LeadsListResponse>('GET', `/admin/leads${query}`)
    },
    find: (params?: { region?: string; city?: string; max_results?: number; google_api_key?: string; scrape_websites?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.region) qs.set('region', params.region)
      if (params?.city) qs.set('city', params.city)
      if (params?.max_results) qs.set('max_results', String(params.max_results))
      if (params?.google_api_key) qs.set('google_api_key', params.google_api_key)
      if (params?.scrape_websites === false) qs.set('scrape_websites', 'false')
      const query = qs.toString() ? `?${qs}` : ''
      return req<FindLeadsResponse>('POST', `/admin/leads/find${query}`)
    },
    generateMessages: () => req<{ generated: number }>('POST', '/admin/leads/generate-messages'),
    generateMessage:  (id: string) => req<{ id: string; message_text: string }>('POST', `/admin/leads/${id}/generate-message`),
    updateMessage:    (id: string, message_text: string) => req<{ id: string; message_text: string }>('PATCH', `/admin/leads/${id}/message`, { message_text }),
    approve:  (id: string) => req<{ id: string; status: string }>('POST', `/admin/leads/${id}/approve`),
    reject:   (id: string) => req<{ id: string; status: string }>('POST', `/admin/leads/${id}/reject`),
    sendApproved: () => req<{ sent: number; failed: number; total: number }>('POST', '/admin/leads/send-approved'),
  },
}
