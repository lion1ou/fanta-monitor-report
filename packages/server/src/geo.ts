import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { IPv4, IPv6, loadContentFromFile, newWithBuffer, verifyFromFile } from 'ip2region.js'
import { GEO_INTERNAL, type GeoRegion } from '@fanta/shared'

export const EMPTY_GEO: GeoRegion = { country: '', province: '', city: '' }
const INTERNAL_GEO: GeoRegion = { country: GEO_INTERNAL, province: '', city: '' }

// 只依赖 ip2region.js Searcher 的 search 方法，便于测试注入桩；其类型声明为同步、运行时实际为 async，两者都接受
export interface RegionSearcher {
  search: (ip: string) => string | Promise<string>
}

export type GeoResolver = (ip: string) => Promise<GeoRegion>

export const XDB_FILES = { v4: 'ip2region_v4.xdb', v6: 'ip2region_v6.xdb' } as const

// xdb 区域串格式：国家|省|市|ISP|国家码，缺失段为 0；私有与保留地址为 Reserved
export const parseRegion = (region: string): GeoRegion => {
  if (!region) return EMPTY_GEO
  const [country = '', province = '', city = ''] = region.split('|').map((part) => (part === '0' ? '' : part))
  if (country === 'Reserved') return INTERNAL_GEO
  return { country, province, city }
}

const IPV4_MAPPED_PREFIX = '::ffff:'

type WarnLog = (message: string) => void

// 单个 IP 查询失败不影响事件写入：记录告警，地域留空即「未知」
export const createGeoResolver = (v4: RegionSearcher, v6: RegionSearcher, warn: WarnLog = console.warn): GeoResolver => async (rawIp) => {
  const ip = rawIp.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) ? rawIp.slice(IPV4_MAPPED_PREFIX.length) : rawIp
  if (ip === '::1') return INTERNAL_GEO
  const version = isIP(ip)
  if (version === 0) return EMPTY_GEO
  try {
    return parseRegion(await (version === 4 ? v4 : v6).search(ip))
  } catch (error) {
    warn(`IP 地域查询失败 ${ip}: ${error instanceof Error ? error.message : String(error)}`)
    return EMPTY_GEO
  }
}

// 从目录加载两份 xdb 到内存；任一文件缺失返回 null，由调用方决定是否禁用解析
export const loadGeoResolver = (dir: string, warn: WarnLog = console.warn): GeoResolver | null => {
  const paths = { v4: join(dir, XDB_FILES.v4), v6: join(dir, XDB_FILES.v6) }
  if (!existsSync(paths.v4) || !existsSync(paths.v6)) return null
  verifyFromFile(paths.v4)
  verifyFromFile(paths.v6)
  return createGeoResolver(
    newWithBuffer(IPv4, loadContentFromFile(paths.v4)),
    newWithBuffer(IPv6, loadContentFromFile(paths.v6)),
    warn
  )
}
