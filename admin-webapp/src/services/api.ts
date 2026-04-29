import type { AdminUser, DriverAdminRead, PlatformStats, AdminRide, AuditLog, AIAgent, AIChatResponse, AIKeyUpdateResponse } from '../types'

const BASE = '/api'

function getToken() { return localStorage.getItem('admin_token') }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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
      req<AIChatResponse>('POST', `/admin/ai-agents/${agentId}/chat`, { message, model }),
    updateKey: (agentId: string, api_key: string) =>
      req<AIKeyUpdateResponse>('PUT', `/admin/ai-agents/${agentId}/key`, { api_key }),
    disable: (agentId: string) => req<{ success: boolean }>('DELETE', `/admin/ai-agents/${agentId}/key`),
  },
}
