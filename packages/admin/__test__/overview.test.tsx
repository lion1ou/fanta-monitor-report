import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Overview } from '../src/pages/Overview'
import { Pages } from '../src/pages/Pages'
import type { Filters } from '../src/state/filters'
import { APPS, devicesFixture, emptyOverview, mockStatsFetch, overviewFixture, pagesFixture } from './fixtures'

const filters: Filters = { app: 'demo', preset: '7d', bots: 'exclude', from: Date.parse('2026-09-16T00:00:00Z'), to: Date.parse('2026-09-22T12:00:00Z') }

describe('概览板块', () => {
  it('渲染 6 张 KPI 与环比', async () => {
    const fetchMock = mockStatsFetch({ '/apps': APPS, '/overview': overviewFixture, '/pages': pagesFixture, '/devices': devicesFixture })
    render(<Overview filters={filters} reloadKey={0} />)

    const pv = await screen.findByRole('region', { name: 'PV' })
    expect(within(pv).getByText('1,234')).toBeInTheDocument()
    expect(within(pv).getByText('+23.4%')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'UV' })).getByText('617')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '错误率' })).getByText('0.1%')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '爬虫占比' })).getByText('0.2%')).toBeInTheDocument()

    // 请求携带筛选参数
    const overviewCall = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/overview'))
    expect(overviewCall).toContain('app=demo')
    expect(overviewCall).toContain('bots=exclude')
    expect(overviewCall).toContain(`from=${filters.from}`)
  })

  it('没有数据时显示空态', async () => {
    mockStatsFetch({ '/apps': APPS, '/overview': emptyOverview, '/pages': { paths: [], entries: [], referrers: [] }, '/devices': { ...devicesFixture, deviceType: [] } })
    render(<Overview filters={filters} reloadKey={0} />)
    expect(await screen.findAllByText('所选区间内没有数据')).not.toHaveLength(0)
  })
})

describe('页面板块', () => {
  it('渲染路径、入口与来源三张表', async () => {
    mockStatsFetch({ '/pages': pagesFixture })
    render(<Pages filters={filters} reloadKey={0} />)
    expect(await screen.findByText('/pricing')).toBeInTheDocument()
    expect(screen.getByText('google.com')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
  })
})
