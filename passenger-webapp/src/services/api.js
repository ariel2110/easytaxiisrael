const BASE = '/api';
const ADMIN_KEY = 'e78a16747d74f1074e2c590d0cc4a074db43b4bc90ac19e2';
function getToken() { return localStorage.getItem('access_token'); }
async function tryRefresh() {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh)
        return false;
    try {
        const res = await fetch(`${BASE}/auth/token/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok)
            return false;
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        return true;
    }
    catch {
        return false;
    }
}
async function request(method, path, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const t = getToken();
        if (t)
            headers['Authorization'] = `Bearer ${t}`;
    }
    let res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    // Auto-refresh on 401
    if (res.status === 401 && auth) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            const t = getToken();
            if (t)
                headers['Authorization'] = `Bearer ${t}`;
            res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
        }
    }
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
        deleteRequest: () => request('POST', '/auth/delete-request'),
    },
    sumsub: {
        getMyData: () => request('GET', '/sumsub/my-data'),
    },
    compliance: {
        uploadFile: (file) => uploadFile('/compliance/upload', file),
        fileUrl: (key) => `${BASE}/compliance/files/${key}`,
        getProfile: () => request('GET', '/compliance/profile'),
        listDocs: () => request('GET', '/compliance/documents'),
        submitDoc: (doc_type, file_key, expiry_date, notes) => request('POST', '/compliance/documents', { document_type: doc_type, file_key, expiry_date: expiry_date || null, notes: notes || null }),
    },
    admin: {
        listDrivers: (skip = 0, limit = 50) => fetch(`${BASE}/compliance/admin/drivers?skip=${skip}&limit=${limit}`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        getDriverProfile: (driverId) => fetch(`${BASE}/compliance/admin/drivers/${driverId}/profile`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        getDriverDocs: (driverId) => fetch(`${BASE}/compliance/admin/drivers/${driverId}/documents`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        reviewDoc: (docId, status, rejection_reason) => fetch(`${BASE}/compliance/admin/documents/${docId}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY }, body: JSON.stringify({ status, rejection_reason: rejection_reason || null }) }).then(r => r.json()),
        approveDriver: (driverId) => fetch(`${BASE}/compliance/admin/drivers/${driverId}/approve`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
    },
    whatsapp: {
        status: () => fetch(`${BASE}/whatsapp/status`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        qr: () => fetch(`${BASE}/whatsapp/qr`, { headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        reconnect: () => fetch(`${BASE}/whatsapp/reconnect`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        fixWebhook: () => fetch(`${BASE}/whatsapp/fix-webhook`, { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY } }).then(r => r.json()),
        testSend: (phone) => fetch(`${BASE}/whatsapp/test-send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY }, body: JSON.stringify({ phone }) }).then(r => r.json()),
    },
    vehicle: {
        check: (vehicle_number) => request('POST', '/driver/vehicle-check', { vehicle_number }),
    },
    rides: {
        request: (data) => request('POST', '/rides', data),
        list: () => request('GET', '/rides'),
        get: (id) => request('GET', `/rides/${id}`),
        cancel: (id) => request('POST', `/rides/${id}/cancel`),
        fare: (id) => request('GET', `/rides/${id}/fare`),
        rateDriver: (id, payload) => request('POST', `/rides/${id}/ratings/driver`, payload),
        ratePassenger: (id, payload) => request('POST', `/rides/${id}/ratings/passenger`, payload),
    },
    ai: {
        intelligence: () => request('GET', '/ai/intelligence'),
    },
    wallet: {
        get: () => request('GET', '/passenger/wallet'),
        topup: (amount_ils, payment_method_id) => request('POST', '/passenger/wallet/topup', { amount_ils, payment_method_id }),
        listMethods: () => request('GET', '/passenger/payment-methods'),
        addMethod: (grow_token, card_last4, card_brand, card_expiry) => request('POST', '/passenger/payment-methods', { grow_token, card_last4, card_brand, card_expiry }),
        setDefault: (id) => request('PUT', `/passenger/payment-methods/${id}/default`, {}),
        removeMethod: (id) => fetch(`/api/passenger/payment-methods/${id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` }
        }).then(r => { if (!r.ok)
            throw new Error('שגיאה במחיקת כרטיס'); }),
        getProfile: () => request('GET', '/passenger/payment-profile'),
        updateProfile: (data) => request('PATCH', '/passenger/payment-profile', data),
    },
};
