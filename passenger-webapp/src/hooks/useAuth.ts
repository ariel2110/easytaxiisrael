import { useState, useCallback, useEffect, useRef } from 'react'
import type { User } from '../types'
import { api } from '../services/api'
import type { WaAuthLinkResponse } from '../services/api'

interface WaSession {
  session_id: string
  whatsapp_link: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [waSession, setWaSession] = useState<WaSession | null>(null)
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibilityCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    api.auth.me()
      .then(u => { setUser(u); setLoading(false) })
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setLoading(false)
      })
  }, [])

  const _stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (visibilityCleanupRef.current) { visibilityCleanupRef.current(); visibilityCleanupRef.current = null }
  }, [])

  /** Request a WA auth session and start polling for token */
  const requestWaAuth = useCallback(async (phone: string, role: string = 'passenger') => {
    setError(null)
    const res: WaAuthLinkResponse = await api.auth.requestWaAuth(phone, role)
    const session = { session_id: res.session_id, whatsapp_link: res.whatsapp_link }
    setWaSession(session)

    async function doPoll() {
      try {
        const poll = await api.auth.pollWaAuth(res.session_id)
        if (poll.status === 'completed' && poll.access_token && poll.refresh_token) {
          _stopPolling()
          localStorage.setItem('access_token', poll.access_token)
          localStorage.setItem('refresh_token', poll.refresh_token)
          if (poll.role) localStorage.setItem('auth_role', poll.role)
          else           localStorage.removeItem('auth_role')
          if (poll.kyc_url) localStorage.setItem('kyc_url', poll.kyc_url)
          else              localStorage.removeItem('kyc_url')
          try {
            const u = await api.auth.me()
            setUser(u)
            setWaSession(null)
          } catch {
            // Tokens are saved — reload so the initial effect re-fetches the user
            window.location.reload()
          }
        } else if (poll.status === 'expired') {
          _stopPolling()
          setWaSession(null)
          setError('פג תוקף הקישור. אנא נסה שוב.')
        }
      } catch { /* network hiccup — keep polling */ }
    }

    // Start polling every 3s
    _stopPolling()
    pollRef.current = setInterval(doPoll, 3000)

    // Poll immediately when tab becomes visible (user returns from WA app on mobile)
    function onVisible() {
      if (document.visibilityState === 'visible') doPoll()
    }
    document.addEventListener('visibilitychange', onVisible)
    visibilityCleanupRef.current = () => document.removeEventListener('visibilitychange', onVisible)

    return session
  }, [_stopPolling])

  const cancelWaAuth = useCallback(() => {
    _stopPolling()
    setWaSession(null)
    setError(null)
  }, [_stopPolling])

  // ---------------------------------------------------------------------------
  // OTP flow (sends code TO user's WhatsApp — no incoming message needed)
  // ---------------------------------------------------------------------------

  const requestOtp = useCallback(async (phone: string) => {
    setError(null)
    await api.auth.otpRequest(phone)
    setOtpPhone(phone)
  }, [])

  const verifyOtp = useCallback(async (otp: string, role: string = 'passenger') => {
    if (!otpPhone) return
    setError(null)
    const res = await api.auth.otpVerify(otpPhone, otp, role)
    localStorage.setItem('access_token', res.access_token)
    localStorage.setItem('refresh_token', res.refresh_token)
    if (res.role) localStorage.setItem('auth_role', res.role)
    else          localStorage.removeItem('auth_role')
    if (res.kyc_url) localStorage.setItem('kyc_url', res.kyc_url)
    else             localStorage.removeItem('kyc_url')
    setOtpPhone(null)
    try {
      const u = await api.auth.me()
      setUser(u)
    } catch {
      window.location.reload()
    }
  }, [otpPhone])

  const cancelOtp = useCallback(() => {
    setOtpPhone(null)
    setError(null)
  }, [])

  const logout = useCallback(async () => {
    _stopPolling()
    await api.auth.logout().catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [_stopPolling])

  const updateUser = useCallback((updated: User) => {
    setUser(updated)
  }, [])

  return { user, loading, error, waSession, requestWaAuth, cancelWaAuth, otpPhone, requestOtp, verifyOtp, cancelOtp, logout, updateUser }
}
