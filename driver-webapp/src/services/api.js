const BASE = '/api';
function getToken() {
    return localStorage.getItem('access_token');
}
async function request(method, path, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const token = getToken();
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
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
