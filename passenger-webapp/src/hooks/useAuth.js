import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';
export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [waSession, setWaSession] = useState(null);
    const pollRef = useRef(null);
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            setLoading(false);
            return;
        }
        api.auth.me()
            .then(u => { setUser(u); setLoading(false); })
            .catch(() => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setLoading(false);
        });
    }, []);
    const _stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);
    /** Request a WA auth session and start polling for token */
    const requestWaAuth = useCallback(async (phone) => {
        setError(null);
        const res = await api.auth.requestWaAuth(phone, 'passenger');
        setWaSession({ session_id: res.session_id, whatsapp_link: res.whatsapp_link });
        // Start polling every 2s
        _stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const poll = await api.auth.pollWaAuth(res.session_id);
                if (poll.status === 'completed' && poll.access_token && poll.refresh_token) {
                    _stopPolling();
                    localStorage.setItem('access_token', poll.access_token);
                    localStorage.setItem('refresh_token', poll.refresh_token);
                    const u = await api.auth.me();
                    setUser(u);
                    setWaSession(null);
                }
                else if (poll.status === 'expired') {
                    _stopPolling();
                    setWaSession(null);
                    setError('פג תוקף הקישור. אנא נסה שוב.');
                }
            }
            catch { /* network hiccup — keep polling */ }
        }, 2000);
    }, [_stopPolling]);
    const cancelWaAuth = useCallback(() => {
        _stopPolling();
        setWaSession(null);
        setError(null);
    }, [_stopPolling]);
    const logout = useCallback(async () => {
        _stopPolling();
        await api.auth.logout().catch(() => { });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    }, [_stopPolling]);
    return { user, loading, error, waSession, requestWaAuth, cancelWaAuth, logout };
}
