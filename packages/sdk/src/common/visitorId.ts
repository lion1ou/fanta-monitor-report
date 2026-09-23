import { UUID_LOCAL_KEY } from './constant'
import { getLocal, getUUID, setLocal } from './utils'
import log from './log'

export const VISITOR_COOKIE = 'fanta_uid'
const TWO_YEARS_SECONDS = 2 * 365 * 24 * 60 * 60

// 注册域取主机名末两段（a.b.lion1ou.tech → .lion1ou.tech），让同主域下的站点共享一个访客 id；
// localhost、IP 与单段主机名无法设置带 Domain 的 cookie，返回 null
export const cookieDomainOf = (hostname: string): string | null => {
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || /^\[?[0-9a-f:]+\]?$/i.test(hostname)) return null
  const labels = hostname.split('.').filter(Boolean)
  if (labels.length < 2) return null
  return `.${labels.slice(-2).join('.')}`
}

const readCookie = (): string | null => {
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
  return match ? decodeURIComponent(match.slice(VISITOR_COOKIE.length + 1)) || null : null
}

const writeCookie = (id: string, domain: string) => {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  try {
    document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(id)}; Domain=${domain}; Path=/; Max-Age=${TWO_YEARS_SECONDS}; SameSite=Lax${secure}`
  } catch (error) {
    log.warn('访客 cookie 写入失败，仅使用 localStorage', error)
  }
}

// 访客 id：cookie（跨站共享）→ localStorage（历史 id）→ 新生成；解析结果同步写回两处
export const resolveVisitorId = (cookieDomain?: string): string => {
  const domain = cookieDomain ?? cookieDomainOf(location.hostname)
  const fromCookie = domain ? readCookie() : null
  const id: string = fromCookie ?? (getLocal(UUID_LOCAL_KEY)) ?? getUUID()
  setLocal(UUID_LOCAL_KEY, id)
  if (domain) writeCookie(id, domain)
  return id
}
