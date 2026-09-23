export const TOKEN_KEY = 'fantaAdminToken'

export class UnauthorizedError extends Error {
  constructor () { super('访问令牌无效或已失效') }
}

export class ApiError extends Error {
  constructor (public readonly status: number, message: string) { super(message) }
}

export const getToken = (): string | null => window.localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => { window.localStorage.setItem(TOKEN_KEY, token) }
export const clearToken = () => { window.localStorage.removeItem(TOKEN_KEY) }

export type QueryParams = Record<string, string | number | undefined>

// 统计接口与后台同源：开发期由 Vite 代理，生产由 server 托管
const STATS_BASE = '/v1/stats'

const request = async (url: string, init: RequestInit): Promise<Response> => {
  const response = await window.fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${getToken() ?? ''}` }
  })
  if (response.status === 401) throw new UnauthorizedError()
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const body = await response.json() as { message?: string, error?: string }
      message = body.message ?? body.error ?? message
    } catch { /* 非 JSON 响应，保留默认文案 */ }
    throw new ApiError(response.status, message)
  }
  return response
}

export const apiGet = async <T>(path: string, params: QueryParams = {}): Promise<T> => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  const response = await request(`${STATS_BASE}${path}${query ? `?${query}` : ''}`, {})
  return await response.json() as T
}

const tagUrl = (visitorKey: string) => `/v1/visitors/${encodeURIComponent(visitorKey)}/tag`

export const putVisitorTag = async <T>(visitorKey: string, body: { label: string, isExcluded: boolean, note: string }): Promise<T> => {
  const response = await request(tagUrl(visitorKey), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return await response.json() as T
}

export const deleteVisitorTag = async (visitorKey: string): Promise<void> => {
  await request(tagUrl(visitorKey), { method: 'DELETE' })
}
