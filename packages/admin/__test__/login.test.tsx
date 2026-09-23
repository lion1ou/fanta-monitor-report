import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { TOKEN_KEY } from '../src/api/client'
import { APPS, mockStatsFetch, overviewFixture, pagesFixture, devicesFixture } from './fixtures'

describe('登录门', () => {
  it('没有 token 时显示登录页，提交后进入后台并保存 token', async () => {
    mockStatsFetch({ '/apps': APPS, '/overview': overviewFixture, '/pages': pagesFixture, '/devices': devicesFixture })
    render(<App />)
    expect(screen.getByRole('heading', { name: '登录管理后台' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('访问令牌'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: '进入' }))

    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('secret')
    expect(await screen.findByRole('navigation', { name: '板块导航' })).toBeInTheDocument()
  })

  it('接口返回 401 时清除 token 并回到登录页', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stale')
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: '登录管理后台' })).toBeInTheDocument()
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
