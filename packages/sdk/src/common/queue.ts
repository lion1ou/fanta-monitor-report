import type { TrackEvent } from '@fanta/shared'
import type { SendBatch } from './transport'
import { getLocal, setLocal } from './utils'
import log from './log'

export interface QueueOptions {
  send: SendBatch
  batchSize: number
  flushInterval: number
  storageKey: string
  maxStored: number // 本地最多暂存条数，超出丢弃最旧
  maxAttempts: number // 单条事件最多失败次数
}

// 事件队列：内存与 localStorage 同步，按批发送，失败放回重试
export class EventQueue {
  private readonly pending: TrackEvent[]
  private readonly attempts = new Map<string, number>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private isFlushing = false

  constructor (private readonly options: QueueOptions) {
    const stored: unknown = getLocal(options.storageKey)
    this.pending = Array.isArray(stored) ? stored as TrackEvent[] : []
    window.addEventListener('pagehide', () => { void this.flush() })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush()
    })
    if (this.pending.length > 0) void this.flush()
  }

  size (): number {
    return this.pending.length
  }

  push (event: TrackEvent) {
    this.pending.push(event)
    if (this.pending.length > this.options.maxStored) {
      this.pending.splice(0, this.pending.length - this.options.maxStored)
    }
    this.persist()
    if (this.pending.length >= this.options.batchSize) {
      void this.flush()
      return
    }
    this.schedule()
  }

  // 按批发送直到队列为空；某批需要重试时停止，等待下次触发
  async flush (): Promise<void> {
    if (this.isFlushing || this.pending.length === 0) return
    this.isFlushing = true
    this.clearTimer()
    try {
      while (this.pending.length > 0) {
        const batch = this.pending.splice(0, this.options.batchSize)
        this.persist()
        const result = await this.options.send(batch)
        if (result === 'sent') {
          batch.forEach((event) => this.attempts.delete(event.trackId))
          continue
        }
        if (result === 'drop') {
          log.error('事件被服务端拒绝，已丢弃', batch.length)
          continue
        }
        this.requeue(batch)
        break
      }
    } finally {
      this.isFlushing = false
      if (this.pending.length > 0) this.schedule()
    }
  }

  private requeue (batch: TrackEvent[]) {
    const kept = batch.filter((event) => {
      const count = (this.attempts.get(event.trackId) ?? 0) + 1
      if (count >= this.options.maxAttempts) {
        this.attempts.delete(event.trackId)
        return false
      }
      this.attempts.set(event.trackId, count)
      return true
    })
    if (kept.length < batch.length) log.error('事件重试次数耗尽，已丢弃', batch.length - kept.length)
    this.pending.unshift(...kept)
    this.persist()
  }

  private schedule () {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.options.flushInterval)
  }

  private clearTimer () {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
  }

  private persist () {
    setLocal(this.options.storageKey, this.pending)
  }
}
