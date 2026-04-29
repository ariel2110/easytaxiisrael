const BASE = '/api';
function getToken() { return localStorage.getItem('access_token'); }
async function request(method, path, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const t = getToken();
        if (t)
            headers['Authorization'] = `Bearer ${t}`;
    }
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(e.detail ?? 'Request failed');
    }
    return res.json();
}
async function uploadFile(path, file) {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(e.detail ?? 'Upload failed');
    }
    return res.json();
}
export const api = {
    auth: {
        requestWaAuth: (phone, role = 'passenger') => request('POST', '/auth/wa/request', { phone, role }, false),
        pollWaAuth: (session_id) => request('GET', `/auth/wa/poll/${session_id}`, undefined, false),
        otpRequest: (phone) => request('POST', '/auth/otp/request', { phone }, false),
        otpVerify: (phone, otp, role = 'passenger') => request('POST', '/auth/otp/verify', { phone, otp, role }, false),
        me: () => request('GET', '/auth/me'),
        driverKycStatus: () => request('GET', '/auth/driver/kyc-status'),
        logout: () => request('POST', '/auth/logout', { refresh_token: localStorage.getItem('refresh_token') ?? '' }),
        updateProfile: (data) => request('PATCH', '/auth/profile', data),
    },
    compliance: {
        uploadFile: (file) => uploadFile('/compliance/upload', file),
        fileUrl: (key) => `${BASE}/compliance/files/${key}`,
        getProfile: () => request('GET', '/compliance/profile'),
        listDocs: () => request('GET', '/compliance/documents'),
        submitDoc: (doc_type, file_key, expiry_date, notes) => request('POST', '/compliance/documents', { document_type: doc_type, file_key, expiry_date: expiry_date || null, notes: notes || null }),
    },
    admin: {
        listDrivers: (skip = 0, limit = 50) => request('GET', `/compliance/admin/drivers?skip=${skip}&limit=${limit}`),
        getDriverProfile: (driverId) => request('GET', `/compliance/admin/drivers/${driverId}/profile`),
        getDriverDocs: (driverId) => request('GET', `/compliance/admin/drivers/${driverId}/documents`),
        reviewDoc: (docId, status, rejection_reason) => request('PATCH', `/compliance/admin/documents/${docId}/review`, { status, rejection_reason: rejection_reason || null }),
        approveDriver: (driverId) => request('POST', `/compliance/admin/drivers/${driverId}/approve`),
    },
    rides: {
        request: (data) => request('POST', '/rides', data),
        list: () => request('GET', '/rides'),
        get: (id) => request('GET', `/rides/${id}`),
        cancel: (id) => request('POST', `/rides/${id}/cancel`),
        fare: (id) => request('GET', `/rides/${id}/fare`),
    },
    ai: {
        intelligence: () => request('GET', '/ai/intelligence'),
    },
};
