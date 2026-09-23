import { useEffect, useState } from 'react'

export const SECTIONS = [
  { id: 'overview', label: '概览' },
  { id: 'pages', label: '页面' },
  { id: 'devices', label: '访客与设备' },
  { id: 'performance', label: '性能' },
  { id: 'errors', label: '错误' },
  { id: 'events', label: '事件明细' }
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

const readRoute = (): SectionId => {
  const id = window.location.hash.replace(/^#\/?/, '')
  return SECTIONS.find((s) => s.id === id)?.id ?? 'overview'
}

export const hrefOf = (id: SectionId) => `#/${id}`

export const useHashRoute = (): SectionId => {
  const [route, setRoute] = useState<SectionId>(readRoute)
  useEffect(() => {
    const onChange = () => { setRoute(readRoute()); }
    window.addEventListener('hashchange', onChange)
    return () => { window.removeEventListener('hashchange', onChange); }
  }, [])
  return route
}
