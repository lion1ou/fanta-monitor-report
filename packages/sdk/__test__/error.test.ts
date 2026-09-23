import { describe, it, expect, vi } from 'vitest'
import { startErrorCapture, normalizeError } from '../src/h5/h5Error'

describe('normalizeError', () => {
  it('Error 对象取 name/message/stack', () => {
    const err = new TypeError('boom')
    const data = normalizeError(err)
    expect(data).toMatchObject({ kind: 'js', name: 'TypeError', message: 'boom' })
    expect(typeof data.stack).toBe('string')
  })

  it('非 Error 值转字符串', () => {
    expect(normalizeError('plain')).toMatchObject({ kind: 'js', name: 'Error', message: 'plain', stack: '' })
    expect(normalizeError({ code: 1 })).toMatchObject({ message: '{"code":1}' })
  })

  it('stack 截断到 4000 字符', () => {
    const err = new Error('x')
    err.stack = 'a'.repeat(6000)
    expect(normalizeError(err).stack).toHaveLength(4000)
  })
})

describe('startErrorCapture', () => {
  it('捕获 window error 事件并上报 js 错误', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const event = new ErrorEvent('error', { message: 'bad', filename: 'a.js', lineno: 3, colno: 7, error: new Error('bad') })
    window.dispatchEvent(event)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'js', message: 'bad', filename: 'a.js', lineno: 3, colno: 7
    }))
  })

  it('捕获 unhandledrejection 并标记 promise', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const event = new Event('unhandledrejection') as Event & { reason?: unknown }
    event.reason = new Error('rejected')
    window.dispatchEvent(event)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ kind: 'promise', message: 'rejected' }))
  })

  it('捕获资源加载失败并记录标签与地址', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const img = document.createElement('img')
    img.src = 'http://localhost/missing.png'
    document.body.appendChild(img)
    img.dispatchEvent(new Event('error', { bubbles: false }))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'resource', tagName: 'IMG', url: 'http://localhost/missing.png'
    }))
  })

  it('同一错误 1 秒内只上报一次', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const make = () => new ErrorEvent('error', { message: 'dup', filename: 'b.js', lineno: 1, colno: 1, error: new Error('dup') })
    window.dispatchEvent(make())
    window.dispatchEvent(make())
    expect(report).toHaveBeenCalledTimes(1)
  })
})
