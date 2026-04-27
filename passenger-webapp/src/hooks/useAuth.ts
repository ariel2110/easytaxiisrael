import { useState, useCallback, useEffect } from 'react'
import type { User, TokenPair } from '../types'
import { api } from '../services/api'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    api.auth.me()
      .then(u => { setUser(u); setLoading(false) })
      .catch(() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setLoading(false) })
  }, [])

  const requestOtp = useCallback(async (phone: string) => {
    setError(null)
    await api.auth.requestOtp(phone)
  }, [])

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    setLoading(true); setError(null)
    try {
      const tokens: TokenPair = await api.auth.verifyOtp(phone, otp)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      const u = await api.auth.me()
      setUser(u); setLoading(false)
    } catch (e) {
      setError((e as Error).message); setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  return { user, loading, error, requestOtp, verifyOtp, logout }
}
