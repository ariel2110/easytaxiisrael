import { useState, useCallback, useEffect, useRef } from 'react'
import type { User } from '../types'
import { api } from '../services/api'
import type { WaAuthLinkResponse } from '../services/api'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

interface WaSession {
  session_id: string
  whatsapp_link: string
  kyc_url?: string
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })
  const [waSession, setWaSession] = useState<WaSession | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setState({ user: null, loading: false, error: null })
      return
    }
    api.auth
      .me()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setState({ user: null, loading: false, error: null })
      })
  }, [])

  const _stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  /** Request a WA auth session and start polling */
  const requestWaAuth = useCallback(async (phone: string) => {
    setState((s) => ({ ...s, error: null }))
    const res: WaAuthLinkResponse = await api.auth.requestWaAuth(phone, 'driver')
    setWaSession({ session_id: res.session_id, whatsapp_link: res.whatsapp_link })

    _stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const poll = await api.auth.pollWaAuth(res.session_id)
        if (poll.status === 'completed' && poll.access_token && poll.refresh_token) {
          _stopPolling()
          localStorage.setItem('access_token', poll.access_token)
          localStorage.setItem('refresh_token', poll.refresh_token)
          if (poll.kyc_url) localStorage.setItem('kyc_url', poll.kyc_url)
          const user = await api.auth.me()
          setWaSession(prev => prev ? { ...prev, kyc_url: poll.kyc_url } : null)
          setState({ user, loading: false, error: null })
        } else if (poll.status === 'expired') {
          _stopPolling()
          setWaSession(null)
          setState((s) => ({ ...s, error: 'פג תוקף הקישור. אנא נסה שוב.' }))
        }
      } catch { /* keep polling on network error */ }
    }, 2000)

    return res
  }, [_stopPolling])

  const cancelWaAuth = useCallback(() => {
    _stopPolling()
    setWaSession(null)
    setState((s) => ({ ...s, error: null }))
  }, [_stopPolling])

  const logout = useCallback(async () => {
    _stopPolling()
    await api.auth.logout().catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('kyc_url')
    setState({ user: null, loading: false, error: null })
  }, [_stopPolling])

  return { ...state, waSession, requestWaAuth, cancelWaAuth, logout }
}
