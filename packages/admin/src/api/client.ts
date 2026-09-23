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
const BASE = '/v1/stats'

export const apiGet = async <T>(path: string, params: QueryParams = {}): Promise<T> => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  const response = await window.fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
    headers: { authorization: `Bearer ${getToken() ?? ''}` }
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
  return await response.json() as T
}
