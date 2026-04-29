import { useState, useEffect, useCallback } from 'react'
import type { AdminUser } from '../types'
import { api } from '../services/api'

export function useAuth() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('admin_token')
    if (!t) { setLoading(false); return }
    api.auth.me()
      .then(u => { setUser(u); setLoading(false) })
      .catch(() => { localStorage.removeItem('admin_token'); setLoading(false) })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.auth.login(username, password)
    localStorage.setItem('admin_token', res.access_token)
    const u = await api.auth.me()
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token')
    setUser(null)
  }, [])

  return { user, loading, login, logout }
}
