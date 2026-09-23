import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Global, pivotSeries } from '../src/pages/Global'
import { Visitors } from '../src/pages/Visitors'
import { Sources } from '../src/pages/Sources'
import { Devices } from '../src/pages/Devices'
import { Pages } from '../src/pages/Pages'
import { FilterBar } from '../src/components/FilterBar'
import { parseFilters, serializeFilters } from '../src/state/filters'
import { devicesFixture, filtersFixture, globalFixture, mockStatsFetch, pageProps, pagesFixture, sourcesFixture, visitorDetailFixture, visitorsFixture } from './fixtures'

beforeEach(() => { window.location.hash = '' })

describe('全局总览', () => {
  it('渲染每个应用一张卡片，点击卡片切换应用并跳转概览', async () => {
    const onFilter = vi.fn()
    const fetchMock = mockStatsFetch({ '/global': globalFixture })
    render(<Global filters={filtersFixture} {...pageProps} onFilter={onFilter} />)

    const demo = await screen.findByRole('button', { name: 'demo' })
    expect(within(demo).getByText('1,234')).toBeInTheDocument()
    expect(within(demo).getAllByText('+23.4%')).toHaveLength(2) // PV 与 UV 环比
    const blog = screen.getByRole('button', { name: 'blog' })
    expect(within(blog).getByText('300')).toBeInTheDocument()
    expect(within(blog).getAllByText('新增')).toHaveLength(2)

    // 全局接口不带 app，但带 tagged
    const call = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/global'))
    expect(call).not.toContain('app=')
    expect(call).toContain('tagged=exclude')

    await userEvent.click(blog)
    expect(onFilter).toHaveBeenCalledWith({ app: 'blog' })
    expect(window.location.hash).toBe('#/overview')
  })

  it('pivotSeries 按 bucket 透视为每应用一列', () => {
    const rows = pivotSeries(globalFixture.apps, 'uv')
    expect(rows).toEqual([
      { bucket: '2026-09-20T00:00:00.000Z', demo: 200, blog: 50 },
      { bucket: '2026-09-21T00:00:00.000Z', demo: 417, blog: 100 }
    ])
  })
})

describe('访客与标签', () => {
  it('列表显示标签与排除状态，点击行进入详情路由', async () => {
    mockStatsFetch({ '/visitors': visitorsFixture })
    render(<Visitors filters={filtersFixture} {...pageProps} />)
    expect(await screen.findByText('本人 · 已排除')).toBeInTheDocument()
    await userEvent.click(screen.getByText('uuid-bbbb-22…'))
    expect(window.location.hash).toBe('#/visitors/uuid-bbbb-2222')
  })

  it('详情抽屉保存标签调用 PUT，删除调用 DELETE', async () => {
    const savedTag = { visitorKey: 'uuid-bbbb-2222', label: '测试机', isExcluded: true, note: '', updatedAt: '2026-09-22T00:00:00.000Z' }
    const fetchMock = mockStatsFetch({ '/visitors': visitorsFixture, '/visitors/uuid-bbbb-2222': visitorDetailFixture, '/v1/visitors/uuid-bbbb-2222/tag': savedTag })
    render(<Visitors filters={filtersFixture} {...pageProps} visitor="uuid-bbbb-2222" />)
    const dialog = await screen.findByRole('dialog', { name: '访客详情' })
    expect(within(dialog).getByText('demo, blog')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('标签名'), '测试机')
    await userEvent.click(within(dialog).getByLabelText('从统计中排除'))
    await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')
    expect(String(put?.[0])).toBe('/v1/visitors/uuid-bbbb-2222/tag')
    expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ label: '测试机', isExcluded: true, note: '' })
    expect(await within(dialog).findByText('已保存')).toBeInTheDocument()
  })

  it('已有标签时可删除', async () => {
    const detail = { ...visitorDetailFixture, profile: { ...visitorDetailFixture.profile, tag: visitorsFixture.visitors[0].tag } }
    const fetchMock = mockStatsFetch({ '/visitors': visitorsFixture, '/visitors/uuid-bbbb-2222': detail, '/v1/visitors/uuid-bbbb-2222/tag': {} })
    render(<Visitors filters={filtersFixture} {...pageProps} visitor="uuid-bbbb-2222" />)
    const dialog = await screen.findByRole('dialog', { name: '访客详情' })
    await userEvent.click(await within(dialog).findByRole('button', { name: '删除标签' }))
    const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE')
    expect(String(del?.[0])).toBe('/v1/visitors/uuid-bbbb-2222/tag')
    expect(await within(dialog).findByText('已删除标签')).toBeInTheDocument()
  })
})

describe('下钻', () => {
  it('来源页点击 referrer 写入 referrerHost，(direct) 不下钻', async () => {
    const onFilter = vi.fn()
    mockStatsFetch({ '/sources': sourcesFixture })
    render(<Sources filters={filtersFixture} {...pageProps} onFilter={onFilter} />)
    await userEvent.click(await screen.findByText('google.com'))
    expect(onFilter).toHaveBeenCalledWith({ referrerHost: 'google.com' })
    await userEvent.click(screen.getByText('(direct)'))
    expect(onFilter).toHaveBeenCalledTimes(1)
    expect(screen.getByText('wechat')).toBeInTheDocument()
  })

  it('设备页点击城市/浏览器分布写入维度；屏幕分辨率不可点击', async () => {
    const onFilter = vi.fn()
    mockStatsFetch({ '/devices': devicesFixture })
    render(<Devices filters={filtersFixture} {...pageProps} onFilter={onFilter} />)
    const city = await screen.findByRole('region', { name: '城市' })
    await userEvent.click(within(city).getByText('深圳市'))
    expect(onFilter).toHaveBeenCalledWith({ city: '深圳市' })
    await userEvent.click(within(screen.getByRole('region', { name: '浏览器' })).getByText('Chrome'))
    expect(onFilter).toHaveBeenCalledWith({ browser: 'Chrome' })
    expect(within(screen.getByRole('region', { name: '屏幕分辨率' })).queryByRole('button')).toBeNull()
  })

  it('页面表点击路径写入 path，并渲染主机名表', async () => {
    const onFilter = vi.fn()
    mockStatsFetch({ '/pages': pagesFixture })
    render(<Pages filters={filtersFixture} {...pageProps} onFilter={onFilter} />)
    await userEvent.click(await screen.findByText('/pricing'))
    expect(onFilter).toHaveBeenCalledWith({ path: '/pricing' })
    expect(screen.getByText('https://demo.example.com')).toBeInTheDocument()
  })

  it('FilterBar 展示维度 chip，移除时把该键置空；全局页隐藏应用下拉', async () => {
    const onChange = vi.fn()
    const filters = { ...filtersFixture, browser: 'Chrome', city: '深圳市' }
    const { rerender } = render(<FilterBar filters={filters} apps={['demo']} showApp onChange={onChange} onRefresh={() => {}} />)
    expect(screen.getByLabelText('应用')).toBeInTheDocument()
    expect(screen.getByText('Chrome')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '移除 浏览器 条件' }))
    expect(onChange).toHaveBeenCalledWith({ browser: undefined })
    await userEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(onChange).toHaveBeenCalledWith({ browser: undefined, city: undefined })
    await userEvent.click(screen.getByRole('button', { name: '包含标记访客' }))
    expect(onChange).toHaveBeenCalledWith({ tagged: 'include' })

    rerender(<FilterBar filters={filters} apps={['demo']} showApp={false} onChange={onChange} onRefresh={() => {}} />)
    expect(screen.queryByLabelText('应用')).toBeNull()
  })

  it('filters 维度与 tagged 往返 URL', () => {
    const search = serializeFilters({ ...filtersFixture, tagged: 'include', browser: 'Safari', referrerHost: 'google.com' })
    expect(search).toContain('tagged=include')
    expect(search).toContain('browser=Safari')
    const parsed = parseFilters(search)
    expect(parsed.tagged).toBe('include')
    expect(parsed.browser).toBe('Safari')
    expect(parsed.referrerHost).toBe('google.com')
    expect(parsed.city).toBeUndefined()
    expect(parseFilters('?bots=exclude').tagged).toBe('exclude')
  })
})
