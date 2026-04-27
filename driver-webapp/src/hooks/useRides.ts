import { useState, useEffect, useCallback } from 'react'
import type { Ride } from '../types'
import { api } from '../services/api'

export function useRides() {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.rides.list()
      setRides(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [refresh])

  const accept = useCallback(
    async (id: string) => {
      await api.rides.accept(id)
      await refresh()
    },
    [refresh]
  )

  const reject = useCallback(
    async (id: string) => {
      await api.rides.reject(id)
      await refresh()
    },
    [refresh]
  )

  const start = useCallback(
    async (id: string) => {
      await api.rides.start(id)
      await refresh()
    },
    [refresh]
  )

  const end = useCallback(
    async (id: string) => {
      await api.rides.end(id)
      await refresh()
    },
    [refresh]
  )

  return { rides, loading, error, refresh, accept, reject, start, end }
}
