import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { clearToken, getToken, setToken } from './api/client'
import { AuthContext, useAuth } from './state/auth'
import { useFilters, type Filters } from './state/filters'
import { useHashRoute, type SectionId } from './state/route'
import { useStats } from './hooks/useStats'
import { Sidebar } from './components/Sidebar'
import { FilterBar } from './components/FilterBar'
import { ErrorState } from './components/Primitives'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Pages } from './pages/Pages'
import { Devices } from './pages/Devices'
import { Performance } from './pages/Performance'
import { Errors } from './pages/Errors'
import { Events } from './pages/Events'

export interface PageProps {
  filters: Filters
  reloadKey: number
}

const PAGES: Record<SectionId, ComponentType<PageProps>> = {
  overview: Overview,
  pages: Pages,
  devices: Devices,
  performance: Performance,
  errors: Errors,
  events: Events
}

const Shell = () => {
  const route = useHashRoute()
  const { filters, update } = useFilters()
  const [reloadKey, setReloadKey] = useState(0)
  const apps = useStats<{ apps: string[] }>('/apps', {}, reloadKey)
  const { logout } = useAuth()

  // 首次加载或当前应用不在列表里时，落到第一个有数据的应用
  useEffect(() => {
    const list = apps.data?.apps ?? []
    if (list.length > 0 && !list.includes(filters.app)) update({ app: list[0] })
  }, [apps.data, filters.app, update])

  const refresh = useCallback(() => {
    update({})
    setReloadKey((k) => k + 1)
  }, [update])

  const Page = PAGES[route]
  return (
    <div className="app">
      <Sidebar active={route} onLogout={logout} />
      <div className="main">
        <FilterBar filters={filters} apps={apps.data?.apps ?? []} onChange={update} onRefresh={refresh} />
        <main className="content">
          {apps.error && <ErrorState message={apps.error} onRetry={refresh} />}
          <Page filters={filters} reloadKey={reloadKey} />
        </main>
      </div>
    </div>
  )
}

export const App = () => {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
  }, [])

  if (!token) {
    return <Login onSubmit={(value) => { setToken(value); setTokenState(value) }} />
  }
  return (
    <AuthContext.Provider value={{ logout }}>
      <Shell />
    </AuthContext.Provider>
  )
}
