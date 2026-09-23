import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Performance } from '../src/pages/Performance'
import { Devices } from '../src/pages/Devices'
import { devicesFixture, mockStatsFetch, performanceFixture, filtersFixture, pageProps } from './fixtures'

const filters = filtersFixture

describe('性能板块', () => {
  it('指标卡按 p75 评级着色，并显示评级分段与样本数', async () => {
    mockStatsFetch({ '/performance': performanceFixture })
    render(<Performance filters={filters} {...pageProps} />)

    const lcp = await screen.findByRole('region', { name: 'LCP' })
    const value = within(lcp).getByText('2.75 s')
    expect(value).toHaveClass('rating-needsImprovement')
    expect(within(lcp).getByText('10 样本')).toBeInTheDocument()
    expect(within(lcp).getByRole('img', { name: '良好 60.0%，待改进 30.0%，较差 10.0%' })).toBeInTheDocument()

    const inp = screen.getByRole('region', { name: 'INP' })
    expect(within(inp).getByText('650 ms')).toHaveClass('rating-poor')

    const load = screen.getByRole('region', { name: 'Load' })
    expect(within(load).getByText('3.00 s')).toHaveClass('rating-none')

    const domReady = screen.getByRole('region', { name: 'DOM Ready' })
    expect(within(domReady).getByText('—')).toBeInTheDocument()
  })

  it('按页面表渲染 p75', async () => {
    mockStatsFetch({ '/performance': performanceFixture })
    render(<Performance filters={filters} {...pageProps} />)
    const table = await screen.findByRole('table')
    expect(within(table).getByText('/')).toBeInTheDocument()
    expect(within(table).getByText('1.20 s')).toBeInTheDocument()
  })
})

describe('访客与设备板块', () => {
  it('渲染六组分布与爬虫面板', async () => {
    mockStatsFetch({ '/devices': devicesFixture })
    render(<Devices filters={filters} {...pageProps} />)
    expect(await screen.findByText('Mac OS X')).toBeInTheDocument()
    expect(screen.getByText('1920x1080')).toBeInTheDocument()
    const bots = screen.getByRole('region', { name: '爬虫识别' })
    expect(within(bots).getByText('Googlebot/2.1')).toBeInTheDocument()
    expect(within(bots).getByText('UA 库命中')).toBeInTheDocument()
  })

  it('渲染国家/省份/城市三级地域分布', async () => {
    mockStatsFetch({ '/devices': devicesFixture })
    render(<Devices filters={filters} {...pageProps} />)
    expect(await screen.findByText('深圳市')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '国家' })).getByText('United States')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '省份' })).getByText('广东省')).toBeInTheDocument()
    // 北京市同时出现在省份与城市列表
    expect(screen.getAllByText('北京市')).toHaveLength(2)
  })
})
