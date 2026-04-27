import { useState, useCallback, useEffect } from 'react'
import type { User, TokenPair } from '../types'
import { api } from '../services/api'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

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

  const requestOtp = useCallback(async (phone: string) => {
    setState((s) => ({ ...s, error: null }))
    await api.auth.requestOtp(phone)
  }, [])

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const tokens: TokenPair = await api.auth.verifyOtp(phone, otp)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      const user = await api.auth.me()
      setState({ user, loading: false, error: null })
    } catch (e) {
      setState({ user: null, loading: false, error: (e as Error).message })
    }
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setState({ user: null, loading: false, error: null })
  }, [])

  return { ...state, requestOtp, verifyOtp, logout }
}
