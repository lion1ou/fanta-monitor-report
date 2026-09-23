import { getUUID } from './utils'
import log from './log'

export const SESSION_TIMEOUT = 30 * 60 * 1000
const SESSION_KEY = 'fanta-report-session'

interface SessionRecord {
  id: string
  lastActive: number
}

let memoryRecord: SessionRecord | null = null

const readRecord = (): SessionRecord | null => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as SessionRecord : null
  } catch (error) {
    log.warn('sessionStorage 不可用，会话只保存在内存', error)
    return memoryRecord
  }
}

const writeRecord = (record: SessionRecord) => {
  memoryRecord = record
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(record))
  } catch (error) {
    log.warn('sessionStorage 写入失败', error)
  }
}

// 返回当前会话 id；30 分钟无活动则新建；每次调用刷新活跃时间
export const touchSession = (now: number = Date.now()): string => {
  const current = readRecord()
  const record: SessionRecord = current && now - current.lastActive <= SESSION_TIMEOUT
    ? { id: current.id, lastActive: now }
    : { id: getUUID(), lastActive: now }
  writeRecord(record)
  return record.id
}
