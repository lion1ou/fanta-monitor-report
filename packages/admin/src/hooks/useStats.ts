import { useEffect, useState } from 'react'
import { UnauthorizedError, apiGet, type QueryParams } from '../api/client'
import { useAuth } from '../state/auth'

export interface StatsState<T> {
  data?: T
  error?: string
  loading: boolean
}

// path 为 null 时不请求（例如尚未选定应用）；params 变化即重新请求；401 统一登出
export const useStats = <T,>(path: string | null, params: QueryParams, reloadKey = 0): StatsState<T> => {
  const { logout } = useAuth()
  const key = path === null ? null : `${path}|${JSON.stringify(params)}|${reloadKey}`
  const [state, setState] = useState<StatsState<T>>({ loading: path !== null })

  useEffect(() => {
    if (key === null || path === null) return
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: undefined }))
    apiGet<T>(path, params).then(
      (data) => { if (!cancelled) setState({ data, loading: false }) },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof UnauthorizedError) { logout(); return }
        setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : String(error) }))
      }
    )
    return () => { cancelled = true }
  }, [key]) // key 已包含 path、params 与 reloadKey

  return state
}
