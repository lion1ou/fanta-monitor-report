import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventQueue, type QueueOptions } from '../src/common/queue'
import type { SendResult } from '../src/common/transport'
import { makeEvent } from './helpers'

const storageKey = 'test-queue'

const buildQueue = (send: QueueOptions['send'], overrides: Partial<QueueOptions> = {}) =>
  new EventQueue({ send, batchSize: 3, flushInterval: 5000, storageKey, maxStored: 5, maxAttempts: 3, ...overrides })

const mockSend = (result: SendResult) => vi.fn<QueueOptions['send']>().mockResolvedValue(result)

describe('EventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('达到 batchSize 立即发送整批', async () => {
    const send = mockSend('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent({ trackId: '1' }))
    queue.push(makeEvent({ trackId: '2' }))
    expect(send).not.toHaveBeenCalled()
    queue.push(makeEvent({ trackId: '3' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].map((e) => e.trackId)).toEqual(['1', '2', '3'])
    expect(queue.size()).toBe(0)
  })

  it('未达到 batchSize 时在 flushInterval 后发送', async () => {
    const send = mockSend('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent())
    await vi.advanceTimersByTimeAsync(4999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('入队后 localStorage 有镜像，发送成功后清空', async () => {
    const send = mockSend('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent({ trackId: 'x' }))
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')).toHaveLength(1)
    await queue.flush()
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')).toHaveLength(0)
  })

  it('超过 maxStored 时丢弃最旧事件', () => {
    const send = mockSend('retry')
    const queue = buildQueue(send, { batchSize: 100 })
    for (let i = 0; i < 7; i++) queue.push(makeEvent({ trackId: String(i) }))
    const stored: Array<{ trackId: string }> = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    expect(stored.map((e) => e.trackId)).toEqual(['2', '3', '4', '5', '6'])
  })

  it('新实例回放上次遗留的事件', async () => {
    window.localStorage.setItem(storageKey, JSON.stringify([makeEvent({ trackId: 'old' })]))
    const send = mockSend('sent')
    buildQueue(send)
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0][0].trackId).toBe('old')
  })

  it('retry 结果放回队列，累计 3 次后丢弃', async () => {
    const send = mockSend('retry')
    const queue = buildQueue(send, { batchSize: 1 })
    queue.push(makeEvent())
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.size()).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(3)
    expect(queue.size()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('drop 结果直接丢弃不重试', async () => {
    const send = mockSend('drop')
    const queue = buildQueue(send, { batchSize: 1 })
    queue.push(makeEvent())
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.size()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('pagehide 触发发送', async () => {
    const send = mockSend('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent())
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
