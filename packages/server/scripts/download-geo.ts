import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { verifyFromFile } from 'ip2region.js'
import { defaultGeoXdbDir } from '../src/config.js'
import { XDB_FILES } from '../src/geo.js'

// 从官方仓库下载 ip2region xdb 数据到 GEO_XDB_DIR；先写临时文件、校验通过后再替换，避免运行中的服务读到半截文件
const BASE_URL = process.env.GEO_XDB_BASE_URL ?? 'https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data'
const dir = process.env.GEO_XDB_DIR ?? defaultGeoXdbDir()

await mkdir(dir, { recursive: true })
for (const file of Object.values(XDB_FILES)) {
  const url = `${BASE_URL}/${file}`
  const target = join(dir, file)
  const temp = `${target}.downloading`
  console.log(`下载 ${url}`)
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`下载失败 ${url}: HTTP ${response.status}`)
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temp))
    verifyFromFile(temp)
    await rename(temp, target)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  console.log(`已保存 ${target}（${response.headers.get('content-length') ?? '?'} 字节）`)
}
