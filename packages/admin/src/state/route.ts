import { useEffect, useState } from 'react'

export const SECTIONS = [
  { id: 'global', label: '全局总览' },
  { id: 'overview', label: '概览' },
  { id: 'pages', label: '页面' },
  { id: 'sources', label: '来源' },
  { id: 'visitors', label: '访客' },
  { id: 'devices', label: '设备与地域' },
  { id: 'performance', label: '性能' },
  { id: 'errors', label: '错误' },
  { id: 'events', label: '事件明细' }
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export interface Route {
  section: SectionId
  // 访客详情：#/visitors/<visitorKey>
  visitor: string | null
}

const readRoute = (): Route => {
  const [id, ...rest] = window.location.hash.replace(/^#\/?/, '').split('/')
  const section = SECTIONS.find((s) => s.id === id)?.id ?? 'global'
  const visitor = section === 'visitors' && rest.length > 0 ? decodeURIComponent(rest.join('/')) : null
  return { section, visitor }
}

export const hrefOf = (id: SectionId) => `#/${id}`
export const visitorHref = (visitorKey: string) => `#/visitors/${encodeURIComponent(visitorKey)}`

export const useHashRoute = (): Route => {
  const [route, setRoute] = useState<Route>(readRoute)
  useEffect(() => {
    const onChange = () => { setRoute(readRoute()); }
    window.addEventListener('hashchange', onChange)
    return () => { window.removeEventListener('hashchange', onChange); }
  }, [])
  return route
}
