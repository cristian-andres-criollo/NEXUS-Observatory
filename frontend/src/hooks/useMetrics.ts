import { useState, useEffect, useCallback } from 'react'
import { metricsAPI, GlobalMetrics, LatencyPoint, CostPoint } from '../lib/api'

// ── useMetrics ─────────────────────────────────────────────────────────────────
export function useMetrics(isPersonal = false, autoRefresh = true, intervalMs = 10000) {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // isPersonal incluido como dependencia para que el toggle global/personal recargue datos
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await metricsAPI.global(isPersonal)
      setMetrics(res.data)
      setError(null)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Error cargando métricas'
      setError(msg)
      console.error('[useMetrics] Error:', msg)
    } finally {
      setLoading(false)
    }
  }, [isPersonal])

  useEffect(() => {
    setLoading(true)
    fetchMetrics()
    if (autoRefresh) {
      const id = setInterval(fetchMetrics, intervalMs)
      return () => clearInterval(id)
    }
  }, [fetchMetrics, autoRefresh, intervalMs])

  return { metrics, loading, error, refetch: fetchMetrics }
}

// ── useLatencyHistory ──────────────────────────────────────────────────────────
export function useLatencyHistory(isPersonal = false, limit = 25) {
  const [data, setData] = useState<LatencyPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchLatency = useCallback(async () => {
    try {
      const res = await metricsAPI.latency(isPersonal, limit)
      setData(res.data)
      setError(null)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Error cargando historial de latencia'
      setError(msg)
      console.warn('[useLatencyHistory] Error:', msg)
    }
  }, [isPersonal, limit])

  useEffect(() => {
    fetchLatency()
    const id = setInterval(fetchLatency, 15000)
    return () => clearInterval(id)
  }, [fetchLatency])

  return { data, error }
}

// ── useCostHistory ─────────────────────────────────────────────────────────────
export function useCostHistory(isPersonal = false, limit = 25) {
  const [data, setData] = useState<CostPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchCost = useCallback(async () => {
    try {
      const res = await metricsAPI.cost(isPersonal, limit)
      setData(res.data)
      setError(null)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Error cargando historial de costos'
      setError(msg)
      console.warn('[useCostHistory] Error:', msg)
    }
  }, [isPersonal, limit])

  useEffect(() => {
    fetchCost()
    const id = setInterval(fetchCost, 15000)
    return () => clearInterval(id)
  }, [fetchCost])

  return { data, error }
}
