import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Events } from '../src/pages/Events'
import { Errors } from '../src/pages/Errors'
import { errorsFixture, eventsFixture, mockStatsFetch, filtersFixture, pageProps } from './fixtures'

const filters = filtersFixture

describe('事件明细板块', () => {
  it('分页按钮改变 offset 并重新请求', async () => {
    const fetchMock = mockStatsFetch({ '/events': (url: URL) => eventsFixture(Number(url.searchParams.get('offset') ?? 0)) })
    render(<Events filters={filters} {...pageProps} />)
    expect(await screen.findByText('/p0')).toBeInTheDocument()
    expect(screen.getByText('共 120 条 · 第 1–50 条')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(await screen.findByText('/p50')).toBeInTheDocument()
    const last = fetchMock.mock.calls.at(-1)?.[0]
    expect(String(last)).toContain('offset=50')
    expect(screen.getByText('共 120 条 · 第 51–100 条')).toBeInTheDocument()
  })

  it('地域列：省·市、内网与未知', async () => {
    mockStatsFetch({ '/events': (url: URL) => eventsFixture(Number(url.searchParams.get('offset') ?? 0)) })
    render(<Events filters={filters} {...pageProps} />)
    expect(await screen.findByText('/p0')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('广东省 · 深圳市')).toBeInTheDocument()
    expect(within(rows[2]).getByText('内网')).toBeInTheDocument()
    expect(within(rows[3]).getByText('未知')).toBeInTheDocument()
  })

  it('类型过滤带入请求，点击行展开 trackData', async () => {
    const fetchMock = mockStatsFetch({ '/events': (url: URL) => eventsFixture(Number(url.searchParams.get('offset') ?? 0)) })
    render(<Events filters={filters} {...pageProps} />)
    await screen.findByText('/p0')
    await userEvent.selectOptions(screen.getByLabelText('事件类型'), 'Error')
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('type=Error')

    await userEvent.click(screen.getByText('/p0'))
    expect(screen.getByText(/"trigger": "init"/)).toBeInTheDocument()
  })
})

describe('错误板块', () => {
  it('渲染分组表，点击行加载最近明细', async () => {
    mockStatsFetch({
      '/errors': errorsFixture,
      '/errors/occurrences': { items: [{ trackId: 'x', trackTime: '2026-09-21T01:00:00.000Z', path: '/pricing', browser: 'Chrome', browserVersion: '120', os: 'Mac OS X', osVersion: '14', userId: 'u1', visitor: 'fpA', trackData: { stack: 'Error: boom\n  at a.js:1' } }] }
    })
    render(<Errors filters={filters} {...pageProps} />)
    const row = await screen.findByText('boom')
    expect(within(screen.getByRole('region', { name: '错误数' })).getByText('12')).toBeInTheDocument()
    await userEvent.click(row)
    expect(await screen.findByText(/at a\.js:1/)).toBeInTheDocument()
    expect(screen.getByText('Chrome 120')).toBeInTheDocument()
  })
})
