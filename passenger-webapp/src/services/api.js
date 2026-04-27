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
export const api = {
    auth: {
        requestWaAuth: (phone, role = 'passenger') => request('POST', '/auth/wa/request', { phone, role }, false),
        pollWaAuth: (session_id) => request('GET', `/auth/wa/poll/${session_id}`, undefined, false),
        me: () => request('GET', '/auth/me'),
        logout: () => request('POST', '/auth/logout', { refresh_token: localStorage.getItem('refresh_token') ?? '' }),
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
