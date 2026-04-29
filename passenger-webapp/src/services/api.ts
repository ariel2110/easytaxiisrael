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
      request<AdminDriverItem[]>('GET', `/compliance/admin/drivers?skip=${skip}&limit=${limit}`),
    getDriverProfile: (driverId: string) =>
      request<ComplianceProfile>('GET', `/compliance/admin/drivers/${driverId}/profile`),
    getDriverDocs: (driverId: string) =>
      request<DocumentRead[]>('GET', `/compliance/admin/drivers/${driverId}/documents`),
    reviewDoc: (docId: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
      request<DocumentRead>('PATCH', `/compliance/admin/documents/${docId}/review`, { status, rejection_reason: rejection_reason || null }),
    approveDriver: (driverId: string) =>
      request<{ driver_id: string; auth_status: string }>('POST', `/compliance/admin/drivers/${driverId}/approve`),
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
