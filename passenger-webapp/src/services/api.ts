import type { User, Ride, FareEstimate, RideRequest } from '../types'

const BASE = '/api'
const ADMIN_KEY = 'e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2'

function getToken() { return localStorage.getItem('access_token') }

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

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) { const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}` }
  let res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  // Auto-refresh on 401
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}`
      res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
    }
  }
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail ?? 'Request failed') }
  return res.json() as Promise<T>
}

async function uploadFile(path: string, file: File): Promise<{ file_key: string; filename: string; size: number }> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail ?? 'Upload failed') }
  return res.json()
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

export interface OtpVerifyResponse {
  access_token: string
  refresh_token: string
  role: string
  kyc_url?: string | null
}

export interface DocumentRead {
  id: string
  driver_id: string
  document_type: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  file_key: string
  expiry_date: string | null
  rejection_reason: string | null
  notes: string | null
  uploaded_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface ComplianceProfile {
  driver_id: string
  compliance_status: 'approved' | 'warning' | 'blocked'
  compliance_score: number
  auto_blocked: boolean
  block_reason: string | null
  last_evaluated_at: string | null
  documents: { document_type: string; status: string; expiry_date: string | null; days_until_expiry: number | null }[]
  missing_required: string[]
  progress_pct: number
}

export interface AdminDriverItem {
  driver_id: string
  phone: string
  full_name: string | null
  auth_status: string
  compliance_status: string
  compliance_score: number
  pending_docs: number
  total_docs: number
}

export const api = {
  auth: {
    requestWaAuth: (phone: string, role: string = 'passenger') =>
      request<WaAuthLinkResponse>('POST', '/auth/wa/request', { phone, role }, false),
    pollWaAuth: (session_id: string) =>
      request<WaPollResponse>('GET', `/auth/wa/poll/${session_id}`, undefined, false),
    otpRequest: (phone: string) =>
      request<{ message: string }>('POST', '/auth/otp/request', { phone }, false),
    otpVerify: (phone: string, otp: string, role: string = 'passenger') =>
      request<OtpVerifyResponse>('POST', '/auth/otp/verify', { phone, otp, role }, false),
    me: () => request<User>('GET', '/auth/me'),
    driverKycStatus: () => request<{ kyc_status: string; inquiry_id: string | null; kyc_url: string | null; auth_status: string }>('GET', '/auth/driver/kyc-status'),
    logout: () => request<{ message: string }>('POST', '/auth/logout', { refresh_token: localStorage.getItem('refresh_token') ?? '' }),
    updateProfile: (data: { full_name?: string; email?: string }) =>
      request<User>('PATCH', '/auth/profile', data),
    deleteRequest: () => request<{ ok: boolean; message: string }>('POST', '/auth/delete-request'),
  },
  sumsub: {
    getMyData: () => request<{
      status: string
      review_result: string | null
      level_name: string | null
      auth_status: string
      full_name: string | null
      extracted: {
        first_name: string | null
        last_name: string | null
        date_of_birth: string | null
        id_number: string | null
        id_expiry: string | null
        issuing_country: string | null
        license_number: string | null
        license_class: string | null
        gov_id_passed: boolean
        selfie_passed: boolean
      }
    }>('GET', '/sumsub/my-data'),
  },
  compliance: {
    uploadFile: (file: File) => uploadFile('/compliance/upload', file),
    fileUrl: (key: string) => `${BASE}/compliance/files/${key}`,
    getProfile: () => request<ComplianceProfile>('GET', '/compliance/profile'),
    listDocs: () => request<DocumentRead[]>('GET', '/compliance/documents'),
    submitDoc: (doc_type: string, file_key: string, expiry_date?: string, notes?: string) =>
      request<DocumentRead>('POST', '/compliance/documents', { document_type: doc_type, file_key, expiry_date: expiry_date || null, notes: notes || null }),
  },
  admin: {
    listDrivers: (skip = 0, limit = 50) =>
      fetch(`${BASE}/compliance/admin/drivers?skip=${skip}&limit=${limit}`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()) as Promise<AdminDriverItem[]>,
    getDriverProfile: (driverId: string) =>
      fetch(`${BASE}/compliance/admin/drivers/${driverId}/profile`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()) as Promise<ComplianceProfile>,
    getDriverDocs: (driverId: string) =>
      fetch(`${BASE}/compliance/admin/drivers/${driverId}/documents`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()) as Promise<DocumentRead[]>,
    reviewDoc: (docId: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
      fetch(`${BASE}/compliance/admin/documents/${docId}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY }, body: JSON.stringify({ status, rejection_reason: rejection_reason || null }) }).then(r => r.json()) as Promise<DocumentRead>,
    approveDriver: (driverId: string) =>
      fetch(`${BASE}/compliance/admin/drivers/${driverId}/approve`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()) as Promise<{ driver_id: string; auth_status: string }>,
  },
  whatsapp: {
    status: () => fetch(`${BASE}/whatsapp/status`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
    qr: () => fetch(`${BASE}/whatsapp/qr`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
    reconnect: () => fetch(`${BASE}/whatsapp/reconnect`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
    fixWebhook: () => fetch(`${BASE}/whatsapp/fix-webhook`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
    testSend: (phone: string) => fetch(`${BASE}/whatsapp/test-send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY }, body: JSON.stringify({ phone }) }).then(r => r.json()),
  },
  vehicle: {
    check: (vehicle_number: string) =>
      request<{ found: boolean; is_active: boolean; is_removed: boolean; is_taxi: boolean; manufacturer?: string; model?: string; color?: string; year?: string; test_expiry?: string; warnings: string[] }>('POST', '/driver/vehicle-check', { vehicle_number }),
  },
  rides: {
    request: (data: RideRequest) => request<Ride>('POST', '/rides', data),
    list:    () => request<Ride[]>('GET', '/rides'),
    get:     (id: string) => request<Ride>('GET', `/rides/${id}`),
    cancel:  (id: string) => request<Ride>('POST', `/rides/${id}/cancel`),
    fare:    (id: string) => request<FareEstimate>('GET', `/rides/${id}/fare`),
    rateDriver:    (id: string, payload: { score: number; comment?: string }) =>
      request<unknown>('POST', `/rides/${id}/ratings/driver`, payload),
    ratePassenger: (id: string, payload: { score: number; comment?: string }) =>
      request<unknown>('POST', `/rides/${id}/ratings/passenger`, payload),
  },
  ai: {
    intelligence: () => request<{ surge_multiplier: string; demand_level: string }>('GET', '/ai/intelligence'),
  },
}
