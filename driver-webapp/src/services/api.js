const BASE = '/api';
function getToken() {
    return localStorage.getItem('access_token');
}
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
        const token = getToken();
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
    }
    let res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    // Auto-refresh on 401
    if (res.status === 401 && auth) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            const token = getToken();
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            res = await fetch(`${BASE}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        }
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? 'Request failed');
    }
    return res.json();
}
// ----- Auth -----
export const api = {
    auth: {
        requestWaAuth: (phone, role = 'driver') => request('POST', '/auth/wa/request', { phone, role }, false),
        pollWaAuth: (session_id) => request('GET', `/auth/wa/poll/${session_id}`, undefined, false),
        me: () => request('GET', '/auth/me'),
        logout: () => request('POST', '/auth/logout', {
            refresh_token: localStorage.getItem('refresh_token') ?? '',
        }),
        updateProfile: (data) => request('PATCH', '/auth/profile', data),
    },
    // ----- Rides -----
    rides: {
        list: () => request('GET', '/rides'),
        get: (id) => request('GET', `/rides/${id}`),
        accept: (id) => request('POST', `/rides/${id}/accept`),
        reject: (id) => request('POST', `/rides/${id}/reject`),
        start: (id) => request('POST', `/rides/${id}/start`),
        end: (id) => request('POST', `/rides/${id}/end`),
        fare: (id) => request('GET', `/rides/${id}/fare`),
        ratePassenger: (id, payload) => request('POST', `/rides/${id}/ratings/passenger`, payload),
    },
    // ----- Tracking -----
    tracking: {
        postLocation: (rideId, lat, lng) => request('POST', `/rides/${rideId}/location`, { lat, lng }),
    },
    // ----- Wallet -----
    wallet: {
        get: () => request('GET', '/wallet'),
        transactions: () => request('GET', '/wallet/transactions'),
    },
    // ----- Compliance -----
    compliance: {
        progress: () => request('GET', '/driver/compliance/progress'),
        status: () => request('GET', '/driver/compliance'),
    },
    // ----- Onboarding -----
    onboarding: {
        progress: () => request('GET', '/compliance/progress'),
    },
    // ----- Persona KYC -----
    persona: {
        startInquiry: () => request('POST', '/persona/inquiry'),
        getStatus: () => request('GET', '/persona/inquiry/status'),
    },
    // ----- Vehicle -----
    vehicle: {
        startInquiry: () => request('POST', '/vehicle/inquiry'),
        getStatus: () => request('GET', '/vehicle/inquiry/status'),
    },
};
