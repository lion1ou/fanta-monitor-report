# 埋点 SDK 与采集服务实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `fanta-monitor-report` 改造为 monorepo，SDK 升级到 0.1.0（队列、会话、自动错误/PV/性能采集、统一契约），并新建 Fastify + PostgreSQL 采集服务。

**Architecture:** `packages/shared` 用 `as const` JSON Schema 定义事件契约并推导 TypeScript 类型；`packages/sdk` 通过队列把事件批量以 `text/plain` JSON 发给 `POST /v1/track`，降级到 `fetch keepalive` 与 `<img>` 像素；`packages/server` 用 Fastify 复用同一 schema 校验、白名单过滤后以单条 SQL 批量写入 `track_events`。

**Tech Stack:** npm workspaces、TypeScript 5、rollup 3、vitest 5 + jsdom、Fastify 5、@fastify/cors、ajv 8、pg 8、json-schema-to-ts 3、tsx 4、PostgreSQL 15。

**Spec:** `docs/superpowers/specs/2026-09-22-monitor-report-design.md`

## Global Constraints

- Node 22.21、npm 10；registry 使用仓库 `.npmrc` 中的 npmmirror。
- 包名固定：`@fanta/shared`（private）、`fanta-monitor-report`（0.1.0）、`@fanta/server`（private）。
- 事件契约只能在 `packages/shared/src/index.ts` 定义；SDK 与服务端不得另写一份字段列表。
- 上报请求体 `Content-Type` 为 `text/plain`；服务端请求体上限 256 KB；一批最多 50 条。
- 数据库唯一约束 `(app_name, track_id)`；写入用单条 SQL，禁止循环内查询。
- 环境变量：`DATABASE_URL`、`ALLOWED_APPS` 必填；`PORT=5001`、`CORS_ORIGIN=*`、`TRUST_PROXY=false`、`LOG_LEVEL=info` 可选。
- 测试目录：各包根目录 `__test__/`，不放进 `src/`。
- 禁止空 `catch`、无理由 `any`、非空断言；错误日志不输出事件正文。
- 本计划的 commit 步骤仅在用户明确要求提交时执行；默认只改工作区。

---

### Task 1: monorepo 骨架与共享契约包

**Files:**
- Create: `package.json`（根）、`packages/shared/package.json`、`packages/shared/tsconfig.json`、`packages/shared/src/index.ts`、`packages/sdk/package.json`
- Move: `src/ → packages/sdk/src/`，`rollup.config.mjs → packages/sdk/`，`tsconfig.json → packages/sdk/`，`example/ → packages/sdk/example/`
- Modify: `.eslintrc.js`、`.gitignore`、`packages/sdk/rollup.config.mjs`、`packages/sdk/tsconfig.json`
- Delete: `package-lock.json`（重新生成）

**Interfaces:**
- Produces: `TRACK_TYPES`、`TrackType`、`TRACK_BATCH_MAX`、`trackEventSchema`、`trackBatchSchema`、`TrackEvent`、`TrackBatch`（`@fanta/shared`）。

- [ ] **Step 1: 移动 SDK 文件到 `packages/sdk`**

```bash
cd /Users/lion1ou/Space/Code/fanta-monitor-report
mkdir -p packages/sdk packages/shared/src packages/server
git mv src packages/sdk/src
git mv rollup.config.mjs packages/sdk/rollup.config.mjs
git mv tsconfig.json packages/sdk/tsconfig.json
git mv example packages/sdk/example
git mv package.json packages/sdk/package.json
git rm -q package-lock.json
```

- [ ] **Step 2: 写根 `package.json`**

```json
{
  "name": "fanta-monitor",
  "private": true,
  "license": "MIT",
  "workspaces": [
    "packages/shared",
    "packages/sdk",
    "packages/server"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint --ext .ts packages/shared/src packages/sdk/src packages/server/src --fix",
    "dev:sdk": "npm run build -w packages/shared && npm run dev -w packages/sdk",
    "dev:server": "npm run build -w packages/shared && npm run dev -w packages/server",
    "migrate": "npm run migrate -w packages/server --"
  },
  "precommit": "lint"
}
```

- [ ] **Step 3: 改写 `packages/sdk/package.json`**

保留 `description / repository / keywords / author / license / bugs / homepage`，其余替换为：

```json
{
  "name": "fanta-monitor-report",
  "version": "0.1.0",
  "main": "dist/fanta-report.cjs.js",
  "module": "dist/fanta-report.es.js",
  "unpkg": "dist/fanta-report.umd.js",
  "files": ["dist"],
  "scripts": {
    "build": "NODE_ENV='pro' rollup -c",
    "dev": "NODE_ENV='dev' rollup -c -w",
    "test": "vitest run"
  },
  "dependencies": {
    "blueimp-md5": "^2.19.0"
  },
  "devDependencies": {
    "@babel/plugin-transform-runtime": "^7.22.15",
    "@babel/preset-env": "^7.22.20",
    "@fanta/shared": "0.1.0",
    "@rollup/plugin-babel": "^6.0.3",
    "@rollup/plugin-commonjs": "^25.0.4",
    "@rollup/plugin-json": "^6.0.0",
    "@rollup/plugin-node-resolve": "^15.2.1",
    "@rollup/plugin-replace": "^5.0.5",
    "@rollup/plugin-terser": "^0.4.3",
    "@types/blueimp-md5": "^2.18.2",
    "rollup": "^3.29.3",
    "rollup-plugin-serve": "^2.0.2",
    "rollup-plugin-typescript2": "^0.35.0"
  }
}
```

删除原 `devDependencies` 中的 eslint 系列、`pre-commit`、`typescript`、`rollup-plugin-generate-html-template`（它们移到根或不再使用）。

- [ ] **Step 4: 写 `packages/shared/package.json` 与 `tsconfig.json`**

```json
{
  "name": "@fanta/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "json-schema-to-ts": "^3.1.1"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: 写 `packages/shared/src/index.ts`**

```ts
import type { FromSchema } from 'json-schema-to-ts'

export const TRACK_TYPES = ['PageView', 'Click', 'Error', 'Custom', 'Performance'] as const
export type TrackType = (typeof TRACK_TYPES)[number]

export const TRACK_BATCH_MAX = 50

const text = { type: 'string' } as const
const int = { type: 'integer' } as const

// 单条事件契约：SDK 产出与服务端校验都以此为准
export const trackEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'trackId', 'trackType', 'trackTime', 'trackData',
    'appName', 'uuid', 'sessionId', 'sdkVersion', 'sdkEnv',
    'pageOrigin', 'pagePath', 'pageSearch', 'pageProtocol', 'pageTitle', 'referrer',
    'userAgent', 'deviceType', 'mobileBrand', 'mobileModel', 'os', 'osVersion',
    'browser', 'browserVersion', 'browserEngine', 'isBot', 'isWebview', 'language', 'orientation',
    'screenWidth', 'screenHeight', 'viewportWidth', 'viewportHeight',
    'networkType', 'networkEffectiveType', 'fingerPrint', 'fingerPrintCanvas'
  ],
  properties: {
    trackId: { type: 'string', minLength: 1, maxLength: 64 },
    trackType: { type: 'string', enum: TRACK_TYPES },
    trackTime: int,
    trackData: { type: 'object' },
    appName: { type: 'string', minLength: 1, maxLength: 100 },
    appVersion: text,
    userId: text,
    uuid: text,
    sessionId: text,
    sdkVersion: text,
    sdkEnv: text,
    pageOrigin: text,
    pagePath: text,
    pageSearch: text,
    pageProtocol: text,
    pageTitle: text,
    referrer: text,
    userAgent: text,
    deviceType: text,
    mobileBrand: text,
    mobileModel: text,
    os: text,
    osVersion: text,
    browser: text,
    browserVersion: text,
    browserEngine: text,
    isBot: { type: 'boolean' },
    isWebview: { type: 'boolean' },
    language: text,
    orientation: text,
    screenWidth: int,
    screenHeight: int,
    viewportWidth: int,
    viewportHeight: int,
    networkType: text,
    networkEffectiveType: text,
    fingerPrint: text,
    fingerPrintCanvas: text,
    coordinates: text
  }
} as const

export type TrackEvent = FromSchema<typeof trackEventSchema>

export const trackBatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: { type: 'array', minItems: 1, maxItems: TRACK_BATCH_MAX, items: trackEventSchema }
  }
} as const

export type TrackBatch = FromSchema<typeof trackBatchSchema>
```

- [ ] **Step 6: 根 `.eslintrc.js` 增加 `parserOptions.project`，`.gitignore` 增加 `.env`**

`.eslintrc.js` 的 `parserOptions` 改为：

```js
parserOptions: {
  ecmaVersion: 'latest',
  sourceType: 'module',
  project: ['./packages/*/tsconfig.json'],
  tsconfigRootDir: __dirname
},
```

`.gitignore` 追加两行：

```
.env
coverage
```

- [ ] **Step 7: 修正 `packages/sdk/rollup.config.mjs` 与 `tsconfig.json`**

rollup：`import pkg from './package.json' assert { type: 'json' }` 改为 `with { type: 'json' }`（Node 22 不再支持 `assert`）；`output` 三个 `file` 改为 `dist/fanta-report.cjs.js`、`dist/fanta-report.es.js`、`dist/fanta-report.umd.js`；`replace` 中删除 `__BUILDTIME__` 一行；`serve` 的 `open: true` 改为 `open: false`。

tsconfig 的 `include` 改为 `["src/**/*.ts"]`。

- [ ] **Step 8: 安装依赖**

```bash
cd /Users/lion1ou/Space/Code/fanta-monitor-report
npm i -D typescript@^5 vitest jsdom eslint@^8 eslint-config-standard-with-typescript@^39 @typescript-eslint/eslint-plugin@^6 eslint-plugin-import eslint-plugin-n@^16 eslint-plugin-promise pre-commit
npm install
```

- [ ] **Step 9: 验证 shared 与 sdk 都能构建**

Run: `npm run build -w packages/shared && ls packages/shared/dist && npm run build -w packages/sdk && ls packages/sdk/dist`
Expected: `index.js index.d.ts`；`fanta-report.cjs.js fanta-report.es.js fanta-report.umd.js`（此时 SDK 仍是旧代码，仅验证工作区与构建链路）。

- [ ] **Step 10: Commit（仅在用户要求提交时）**

```bash
git add -A && git commit -m "refactor: 改造为 npm workspaces monorepo 并新增 @fanta/shared 契约包"
```

---

### Task 2: SDK 类型收紧、Store 拆分配置与上下文、移除客户端 IP 与强制定位

**Files:**
- Modify: `packages/sdk/src/types/index.ts`、`packages/sdk/src/types/enum.ts`、`packages/sdk/src/common/store.ts`、`packages/sdk/src/common/constant.ts`、`packages/sdk/src/h5/h5BaseInfo/index.ts`、`packages/sdk/src/h5/h5BaseInfo/location.ts`、`packages/sdk/src/h5/h5BaseInfo/other.ts`、`packages/sdk/src/h5/h5BaseInfo/fingerprint.ts`、`packages/sdk/src/h5/h5BaseInfo/device.ts:289-294`
- Delete: `packages/sdk/src/common/request.ts`
- Create: `packages/sdk/vitest.config.ts`、`packages/sdk/__test__/helpers.ts`、`packages/sdk/__test__/store.test.ts`

**Interfaces:**
- Consumes: `TrackEvent`（Task 1）。
- Produces: `InitParams`、`SdkConfig`、`PageInfo`、`DeviceInfo`、`EventContext`、`TrackData`；`Store.init(params, sdk)`、`Store.getContext()`、`Store.setUserId()`、`Store.getDebug()`、`Store.config`；`getPageInfo(): PageInfo`；`makeEvent(overrides)` 测试工具。

- [ ] **Step 1: 写 `packages/sdk/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@fanta/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) }
  },
  test: {
    environment: 'jsdom',
    include: ['__test__/**/*.test.ts'],
    restoreMocks: true
  }
})
```

- [ ] **Step 2: 写 `packages/sdk/__test__/helpers.ts`**

```ts
import type { TrackEvent } from '@fanta/shared'

export const makeEvent = (overrides: Partial<TrackEvent> = {}): TrackEvent => ({
  trackId: 'evt-1',
  trackType: 'PageView',
  trackTime: 1_700_000_000_000,
  trackData: { page: 'home' },
  appName: 'demo',
  uuid: 'uuid-1',
  sessionId: 'sess-1',
  sdkVersion: '0.1.0',
  sdkEnv: 'test',
  pageOrigin: 'http://localhost',
  pagePath: '/',
  pageSearch: '',
  pageProtocol: 'http:',
  pageTitle: 'Home',
  referrer: '',
  userAgent: 'vitest',
  deviceType: 'Desktop',
  mobileBrand: '',
  mobileModel: '',
  os: 'Mac OS X',
  osVersion: '14',
  browser: 'Chrome',
  browserVersion: '120',
  browserEngine: 'Blink',
  isBot: false,
  isWebview: false,
  language: 'zh-CN',
  orientation: 'landscape',
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1200,
  viewportHeight: 800,
  networkType: 'wifi',
  networkEffectiveType: '4g',
  fingerPrint: 'fp',
  fingerPrintCanvas: 'fpc',
  ...overrides
})
```

- [ ] **Step 3: 写失败测试 `packages/sdk/__test__/store.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Store from '../src/common/store'

const sdk = { version: '0.1.0', env: 'test' }

describe('Store.init', () => {
  const getCurrentPosition = vi.fn()

  beforeEach(() => {
    getCurrentPosition.mockReset()
    Object.defineProperty(window.navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
  })

  it('默认不请求地理位置授权，enableGeo 为 true 时才请求', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo' }, sdk)
    expect(getCurrentPosition).not.toHaveBeenCalled()

    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', enableGeo: true }, sdk)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('上下文只包含事件字段，初始化配置不混入', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', appVersion: '1.2.3', batchSize: 3 }, sdk)
    const context: Record<string, unknown> = { ...Store.getContext() }
    expect(context.appName).toBe('demo')
    expect(context.appVersion).toBe('1.2.3')
    expect(context.sdkVersion).toBe('0.1.0')
    expect(context.uuid).toBeTruthy()
    expect(context).not.toHaveProperty('reportHost')
    expect(context).not.toHaveProperty('batchSize')
    expect(context).not.toHaveProperty('ip')
  })

  it('配置合并默认值，autoTrack 局部覆盖', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', autoTrack: { error: false } }, sdk)
    expect(Store.config.batchSize).toBe(10)
    expect(Store.config.flushInterval).toBe(5000)
    expect(Store.config.autoTrack).toEqual({ pageView: true, error: false, performance: true })
  })

  it('setUserId 更新上下文', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo' }, sdk)
    Store.setUserId('u-9')
    expect(Store.getContext().userId).toBe('u-9')
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npm test -w packages/sdk -- store`
Expected: FAIL（`Store.init` 不存在 / 类型不匹配）。

- [ ] **Step 5: 重写 `packages/sdk/src/types/index.ts`**

```ts
import type { TrackEvent } from '@fanta/shared'

export interface AutoTrackOptions {
  pageView: boolean
  error: boolean
  performance: boolean
}

export interface InitParams {
  reportHost: string
  appName: string
  appVersion?: string
  userId?: string
  debug?: boolean
  enableGeo?: boolean
  autoTrack?: Partial<AutoTrackOptions>
  batchSize?: number
  flushInterval?: number
  enableImgFallback?: boolean
}

// 填充默认值后的配置
export interface SdkConfig {
  reportHost: string
  appName: string
  appVersion: string
  userId: string
  debug: boolean
  enableGeo: boolean
  autoTrack: AutoTrackOptions
  batchSize: number
  flushInterval: number
  enableImgFallback: boolean
}

// 页面信息，每次上报时实时读取
export type PageInfo = Pick<TrackEvent, 'pageOrigin' | 'pagePath' | 'pageSearch' | 'pageProtocol' | 'pageTitle' | 'referrer'>

// 设备与浏览器信息，初始化时读取一次
export type DeviceInfo = Pick<TrackEvent,
'userAgent' | 'deviceType' | 'mobileBrand' | 'mobileModel' | 'os' | 'osVersion' |
'browser' | 'browserVersion' | 'browserEngine' | 'isBot' | 'isWebview' | 'language' | 'orientation' |
'screenWidth' | 'screenHeight' | 'viewportWidth' | 'viewportHeight'>

// 事件公共上下文：TrackEvent 去掉事件体、会话与页面字段
export type EventContext = Omit<TrackEvent, 'trackId' | 'trackType' | 'trackTime' | 'trackData' | 'sessionId' | keyof PageInfo>

export type TrackData = Record<string, unknown>

export interface IGetOs {
  os: string
  osVersion: string
}

export interface IBrowser {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
}
```

- [ ] **Step 6: `types/enum.ts` 删除 `TrackType`，只保留 `DeviceType`**

```ts
export enum DeviceType {
  Mobile = 'Mobile',
  Tablet = 'Tablet',
  iPad = 'iPad',
  Desktop = 'Desktop'
}
```

- [ ] **Step 7: 重写 `common/constant.ts`**

```ts
export const UUID_LOCAL_KEY = 'fanta-report-uuid'
export const QUEUE_LOCAL_KEY = 'fanta-report-queue'
export const QUEUE_MAX_STORED = 200
export const QUEUE_MAX_ATTEMPTS = 3
```

- [ ] **Step 8: 重写 `h5/h5BaseInfo/location.ts`**

```ts
import type { PageInfo } from '../../types'

export const getPageInfo = (): PageInfo => ({
  pageOrigin: window.location.origin,
  pagePath: window.location.pathname,
  pageSearch: window.location.search.replace(/^\?/, ''),
  pageProtocol: window.location.protocol,
  pageTitle: document.title,
  referrer: document.referrer
})
```

- [ ] **Step 9: 修改 `h5/h5BaseInfo/other.ts`：删除 IP 获取，网络信息类型化**

删除 `getIp`、`ajaxGet` 导入、`declare const navigator: any`；`isWifi` 与 `getNetworkType` 改为：

```ts
interface NetworkInformationLike {
  type?: string
  effectiveType?: string
}

const getConnection = (): NetworkInformationLike | undefined => {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike
    mozConnection?: NetworkInformationLike
    webkitConnection?: NetworkInformationLike
  }
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

const isWifi = (): boolean => {
  const ua = navigator.userAgent
  if (ua.includes('MicroMessenger')) return ua.includes('WIFI')
  return getConnection()?.type === 'wifi'
}

export const getNetworkType = async (): Promise<{ networkType: string, networkEffectiveType: string }> => {
  const connection = getConnection()
  return {
    networkType: isWifi() ? 'wifi' : connection?.type ?? 'unknown',
    networkEffectiveType: connection?.effectiveType ?? 'unknown'
  }
}
```

`getLocation`（定位）与 `getGeo`、`uuid` 保持不变，但 `geoShowPosition(position: any)` 改为 `(position: GeolocationPosition)`，`geoShowError(error: any)` 改为 `(error: GeolocationPositionError)`。

- [ ] **Step 10: 修改 `h5/h5BaseInfo/fingerprint.ts` 去掉 `any`**

```ts
import md5 from 'blueimp-md5'

export interface CanvasFingerprint {
  hash: string
  fingerPrint: string
}

// canvas 绘制结果的 md5 作为设备指纹；拼接 UA 与语言得到浏览器指纹
export default function fingerprinting (): CanvasFingerprint {
  const { userAgent, language } = window.navigator
  const canvas = document.createElement('canvas')
  canvas.width = 2000
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) return { hash: '', fingerPrint: md5(userAgent + language) }
  // …原有绘制语句保持不变，删除 options、result.canvasWinding、result.rawData …
  const rawData = canvas.toDataURL()
  return { hash: md5(rawData), fingerPrint: md5(rawData + userAgent + language) }
}
```

原有 `ctx.rect / fillText / arc / fill` 等绘制语句原样保留在 `if (!ctx)` 之后。

- [ ] **Step 11: 修改 `h5/h5BaseInfo/device.ts` 的 `getOrientation`（jsdom 与部分浏览器无 `screen.orientation`）**

```ts
export const getOrientation = (): string => {
  const type = window.screen.orientation?.type ?? ''
  if (type) return type.startsWith('portrait') ? 'portrait' : 'landscape'
  return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape'
}
```

- [ ] **Step 12: 重写 `h5/h5BaseInfo/index.ts`**

```ts
import { getBrower, getOS, getDeviceType, getBrowerEngine, getOrientation, getScreenInfo, getMobileModel } from './device'
import { getNetworkType, getGeo, uuid } from './other'
import type { DeviceInfo } from '../../types'
import log from '../../common/log'
import fingerprinting from './fingerprint'

export const getBaseInfo = (): DeviceInfo => {
  const { userAgent, language } = window.navigator
  const result: DeviceInfo = {
    userAgent,
    language,
    ...getOS(),
    ...getBrower(),
    browserEngine: getBrowerEngine(),
    deviceType: getDeviceType(),
    orientation: getOrientation(),
    ...getScreenInfo(),
    ...getMobileModel()
  }
  log.info('getBaseInfo', result)
  return result
}

export const getFingerPrint = async (): Promise<{ fingerPrint: string, fingerPrintCanvas: string }> => {
  const { hash, fingerPrint } = fingerprinting()
  return { fingerPrintCanvas: hash, fingerPrint }
}

export const generateUuid = (): string => uuid()

// 经纬度，逗号分隔 `经度,纬度`；获取失败返回空字符串
export const getGeoInfo = async (): Promise<string> => {
  const res = await getGeo()
  return res?.flag === 'success' ? `${res.location.lng},${res.location.lat}` : ''
}

export const getNetwork = getNetworkType
```

- [ ] **Step 13: 重写 `common/store.ts`**

```ts
import type { EventContext, InitParams, SdkConfig } from '../types'
import { getBaseInfo, generateUuid, getGeoInfo, getNetwork, getFingerPrint } from '../h5/h5BaseInfo'
import log from './log'

const DEFAULT_CONFIG: SdkConfig = {
  reportHost: '',
  appName: '',
  appVersion: '',
  userId: '',
  debug: false,
  enableGeo: false,
  autoTrack: { pageView: true, error: true, performance: true },
  batchSize: 10,
  flushInterval: 5000,
  enableImgFallback: true
}

const EMPTY_CONTEXT: EventContext = {
  appName: '', appVersion: '', userId: '', uuid: '', sdkVersion: '', sdkEnv: '',
  userAgent: '', deviceType: '', mobileBrand: '', mobileModel: '', os: '', osVersion: '',
  browser: '', browserVersion: '', browserEngine: '', isBot: false, isWebview: false,
  language: '', orientation: '', screenWidth: 0, screenHeight: 0, viewportWidth: 0, viewportHeight: 0,
  networkType: '', networkEffectiveType: '', fingerPrint: '', fingerPrintCanvas: ''
}

const Store = {
  config: DEFAULT_CONFIG,
  context: EMPTY_CONTEXT,

  // 合并配置、同步采集设备信息；网络、指纹、坐标异步补充
  init (params: InitParams, sdk: { version: string, env: string }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...params,
      appVersion: params.appVersion ?? '',
      userId: params.userId ?? '',
      autoTrack: { ...DEFAULT_CONFIG.autoTrack, ...params.autoTrack }
    }
    this.context = {
      ...EMPTY_CONTEXT,
      ...getBaseInfo(),
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      userId: this.config.userId,
      uuid: generateUuid(),
      sdkVersion: sdk.version,
      sdkEnv: sdk.env
    }
    getNetwork().then((network) => { this.context = { ...this.context, ...network } }, (error) => log.error('get network error', error))
    getFingerPrint().then((fingerprint) => { this.context = { ...this.context, ...fingerprint } }, (error) => log.error('get finger print error', error))
    if (this.config.enableGeo) {
      getGeoInfo().then((coordinates) => { this.context = { ...this.context, coordinates } }, (error) => log.error('get geo info error', error))
    }
  },

  getContext (): EventContext {
    return this.context
  },

  setUserId (userId: string) {
    this.config = { ...this.config, userId }
    this.context = { ...this.context, userId }
  },

  getDebug (): boolean {
    return this.config.debug
  }
}

export default Store
```

- [ ] **Step 14: 删除 `common/request.ts`**

```bash
git rm -q packages/sdk/src/common/request.ts
```

- [ ] **Step 15: 运行测试确认通过**

Run: `npm test -w packages/sdk -- store`
Expected: PASS 4 tests。（`main.ts`、`report.ts` 此时仍引用旧类型，构建会失败，Task 9 处理。）

- [ ] **Step 16: Commit（仅在用户要求提交时）**

```bash
git add -A && git commit -m "refactor(sdk): 拆分配置与上下文，移除客户端 IP 获取，地理位置改为 opt-in"
```

---

### Task 3: 会话 `session.ts`

**Files:**
- Create: `packages/sdk/src/common/session.ts`、`packages/sdk/__test__/session.test.ts`

**Interfaces:**
- Consumes: `getUUID()`（`common/utils.ts`）。
- Produces: `touchSession(now?: number): string`、`SESSION_TIMEOUT`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { touchSession, SESSION_TIMEOUT } from '../src/common/session'

describe('touchSession', () => {
  beforeEach(() => { window.sessionStorage.clear() })

  it('连续调用返回同一会话 id', () => {
    const first = touchSession(1_000)
    expect(touchSession(2_000)).toBe(first)
  })

  it('超过 30 分钟无活动后生成新会话 id', () => {
    const first = touchSession(1_000)
    expect(touchSession(1_000 + SESSION_TIMEOUT + 1)).not.toBe(first)
  })

  it('每次调用刷新活跃时间，持续活动不过期', () => {
    const first = touchSession(0)
    touchSession(SESSION_TIMEOUT - 1)
    expect(touchSession(SESSION_TIMEOUT * 2 - 2)).toBe(first)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- session`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 `common/session.ts`**

```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- session`
Expected: PASS 3 tests。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/common/session.ts packages/sdk/__test__/session.test.ts && git commit -m "feat(sdk): 新增 30 分钟无活动过期的会话 id"
```

---

### Task 4: 传输层 `transport.ts`

**Files:**
- Create: `packages/sdk/src/common/transport.ts`、`packages/sdk/__test__/transport.test.ts`

**Interfaces:**
- Produces: `type SendResult = 'sent' | 'retry' | 'drop'`、`type SendBatch = (events: TrackEvent[]) => Promise<SendResult>`、`createTransport({ reportHost, enableImgFallback }): SendBatch`、`toBase64Url(text): string`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTransport, toBase64Url } from '../src/common/transport'
import { makeEvent } from './helpers'

const reportHost = 'http://localhost:5001/v1/track'

class FakeImage {
  static urls: string[] = []
  static shouldFail = false
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src (url: string) {
    FakeImage.urls.push(url)
    setTimeout(() => { (FakeImage.shouldFail ? this.onerror : this.onload)?.() }, 0)
  }
}

describe('createTransport', () => {
  const sendBeacon = vi.fn()
  const fetchMock = vi.fn()

  beforeEach(() => {
    FakeImage.urls = []
    FakeImage.shouldFail = false
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('Image', FakeImage)
  })

  it('sendBeacon 成功时返回 sent 且不调用 fetch', async () => {
    sendBeacon.mockReturnValue(true)
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('sent')
    expect(sendBeacon).toHaveBeenCalledWith(reportHost, JSON.stringify({ events: [makeEvent()] }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendBeacon 失败后 fetch 2xx 返回 sent，请求为 text/plain 的 POST', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('sent')
    expect(fetchMock).toHaveBeenCalledWith(reportHost, expect.objectContaining({
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }
    }))
  })

  it('fetch 返回 4xx 时返回 drop 且不走像素', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('drop')
    expect(FakeImage.urls).toHaveLength(0)
  })

  it('fetch 异常时逐条走像素，URL 指向 .gif 并携带 base64url 的 d 参数', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockRejectedValue(new Error('network'))
    const events = [makeEvent({ trackId: 'a' }), makeEvent({ trackId: 'b' })]
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send(events)).toBe('sent')
    expect(FakeImage.urls).toEqual([
      `${reportHost}.gif?d=${toBase64Url(JSON.stringify(events[0]))}`,
      `${reportHost}.gif?d=${toBase64Url(JSON.stringify(events[1]))}`
    ])
  })

  it('像素加载失败返回 retry', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    FakeImage.shouldFail = true
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('retry')
  })

  it('关闭像素降级且 fetch 异常时直接返回 retry', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockRejectedValue(new Error('network'))
    const send = createTransport({ reportHost, enableImgFallback: false })
    expect(await send([makeEvent()])).toBe('retry')
    expect(FakeImage.urls).toHaveLength(0)
  })
})

describe('toBase64Url', () => {
  it('输出不含 + / = 且能被 Node base64url 解码', () => {
    const text = JSON.stringify({ 中文: 'ok', n: 1 })
    const encoded = toBase64Url(text)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(Buffer.from(encoded, 'base64url').toString('utf8')).toBe(text)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- transport`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 `common/transport.ts`**

```ts
import type { TrackEvent } from '@fanta/shared'
import log from './log'

export type SendResult = 'sent' | 'retry' | 'drop'
export type SendBatch = (events: TrackEvent[]) => Promise<SendResult>

interface TransportOptions {
  reportHost: string
  enableImgFallback: boolean
}

// 浏览器端 base64url，像素上报用它把事件 JSON 放进 query
export const toBase64Url = (text: string): string => {
  let binary = ''
  new TextEncoder().encode(text).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const loadPixel = async (url: string): Promise<boolean> => await new Promise((resolve) => {
  const img = new Image(1, 1)
  img.onload = () => resolve(true)
  img.onerror = () => resolve(false)
  img.src = url
})

// 依次尝试 sendBeacon → fetch keepalive → img 像素；4xx 表示契约或白名单问题，不重试
export const createTransport = ({ reportHost, enableImgFallback }: TransportOptions): SendBatch => {
  const pixelUrl = `${reportHost.replace(/\/+$/, '')}.gif`
  return async (events) => {
    const body = JSON.stringify({ events })
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(reportHost, body)) return 'sent'

    if (typeof fetch === 'function') {
      try {
        const res = await fetch(reportHost, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
        if (res.ok) return 'sent'
        if (res.status >= 400 && res.status < 500) {
          log.error('上报被服务端拒绝', res.status)
          return 'drop'
        }
        log.warn('上报服务端异常', res.status)
      } catch (error) {
        log.warn('fetch 上报失败', error)
      }
    }

    if (!enableImgFallback) return 'retry'
    const results = await Promise.all(events.map(async (event) => await loadPixel(`${pixelUrl}?d=${toBase64Url(JSON.stringify(event))}`)))
    return results.every(Boolean) ? 'sent' : 'retry'
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- transport`
Expected: PASS 7 tests。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/common/transport.ts packages/sdk/__test__/transport.test.ts && git commit -m "feat(sdk): 新增 beacon/fetch/像素三级降级的批量传输"
```

---

### Task 5: 事件队列 `queue.ts`

**Files:**
- Create: `packages/sdk/src/common/queue.ts`、`packages/sdk/__test__/queue.test.ts`

**Interfaces:**
- Consumes: `SendBatch`、`SendResult`（Task 4）；`getLocal / setLocal`（`common/utils.ts`）。
- Produces: `class EventQueue { constructor(options: QueueOptions); push(event): void; flush(): Promise<void>; size(): number }`、`interface QueueOptions { send; batchSize; flushInterval; storageKey; maxStored; maxAttempts }`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventQueue, type QueueOptions } from '../src/common/queue'
import type { SendResult } from '../src/common/transport'
import { makeEvent } from './helpers'

const storageKey = 'test-queue'

const buildQueue = (send: QueueOptions['send'], overrides: Partial<QueueOptions> = {}) =>
  new EventQueue({ send, batchSize: 3, flushInterval: 5000, storageKey, maxStored: 5, maxAttempts: 3, ...overrides })

describe('EventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('达到 batchSize 立即发送整批', async () => {
    const send = vi.fn<[], Promise<SendResult>>().mockResolvedValue('sent')
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
    const send = vi.fn().mockResolvedValue('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent())
    await vi.advanceTimersByTimeAsync(4999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('入队后 localStorage 有镜像，发送成功后清空', async () => {
    const send = vi.fn().mockResolvedValue('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent({ trackId: 'x' }))
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')).toHaveLength(1)
    await queue.flush()
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')).toHaveLength(0)
  })

  it('超过 maxStored 时丢弃最旧事件', () => {
    const send = vi.fn().mockResolvedValue('retry')
    const queue = buildQueue(send, { batchSize: 100 })
    for (let i = 0; i < 7; i++) queue.push(makeEvent({ trackId: String(i) }))
    const stored: Array<{ trackId: string }> = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    expect(stored.map((e) => e.trackId)).toEqual(['2', '3', '4', '5', '6'])
  })

  it('新实例回放上次遗留的事件', async () => {
    window.localStorage.setItem(storageKey, JSON.stringify([makeEvent({ trackId: 'old' })]))
    const send = vi.fn().mockResolvedValue('sent')
    buildQueue(send)
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0][0].trackId).toBe('old')
  })

  it('retry 结果放回队列，累计 3 次后丢弃', async () => {
    const send = vi.fn().mockResolvedValue('retry')
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
    const send = vi.fn().mockResolvedValue('drop')
    const queue = buildQueue(send, { batchSize: 1 })
    queue.push(makeEvent())
    await vi.advanceTimersByTimeAsync(0)
    expect(queue.size()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('pagehide 触发发送', async () => {
    const send = vi.fn().mockResolvedValue('sent')
    const queue = buildQueue(send)
    queue.push(makeEvent())
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- queue`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 `common/queue.ts`**

```ts
import type { TrackEvent } from '@fanta/shared'
import type { SendBatch } from './transport'
import { getLocal, setLocal } from './utils'
import log from './log'

export interface QueueOptions {
  send: SendBatch
  batchSize: number
  flushInterval: number
  storageKey: string
  maxStored: number     // 本地最多暂存条数，超出丢弃最旧
  maxAttempts: number   // 单条事件最多失败次数
}

// 事件队列：内存与 localStorage 同步，按批发送，失败放回重试
export class EventQueue {
  private pending: TrackEvent[]
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- queue`
Expected: PASS 8 tests。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/common/queue.ts packages/sdk/__test__/queue.test.ts && git commit -m "feat(sdk): 新增带本地暂存与重试的事件队列"
```

---

### Task 6: 自动 PV `h5PageVisit`

**Files:**
- Modify: `packages/sdk/src/h5/h5PageVisit/index.ts`（整文件替换注释代码）
- Create: `packages/sdk/__test__/pageVisit.test.ts`

**Interfaces:**
- Produces: `type PageViewTrackData = { trigger: 'init' | 'pushState' | 'replaceState' | 'popstate', from: string }`、`startPageVisit(report: (data: PageViewTrackData) => void): void`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startPageVisit } from '../src/h5/h5PageVisit'

describe('startPageVisit', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/') })

  it('初始化立即上报 init，且 from 为空', () => {
    const report = vi.fn()
    startPageVisit(report)
    expect(report).toHaveBeenCalledWith({ trigger: 'init', from: '' })
  })

  it('pushState 上报并携带上一个 URL', () => {
    const report = vi.fn()
    startPageVisit(report)
    window.history.pushState({}, '', '/a')
    expect(report).toHaveBeenLastCalledWith({ trigger: 'pushState', from: 'http://localhost:3000/' })
    expect(window.location.pathname).toBe('/a')
  })

  it('replaceState 到同一 URL 不重复上报', () => {
    const report = vi.fn()
    startPageVisit(report)
    window.history.replaceState({}, '', '/')
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('popstate 上报', () => {
    const report = vi.fn()
    startPageVisit(report)
    window.history.pushState({}, '', '/b')
    window.history.replaceState({}, '', '/c')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(report).toHaveBeenCalledTimes(3)
  })
})
```

（jsdom 默认 URL 为 `http://localhost:3000/`；若实际不同，以 `window.location.origin` 拼接期望值。）

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- pageVisit`
Expected: FAIL（`startPageVisit` 未导出）。

- [ ] **Step 3: 写 `h5/h5PageVisit/index.ts`**

```ts
export interface PageViewTrackData {
  trigger: 'init' | 'pushState' | 'replaceState' | 'popstate'
  from: string
}

type PageViewReporter = (data: PageViewTrackData) => void

// 监听 SPA 路由变化并上报 PV；同一 URL 连续触发只上报一次
export const startPageVisit = (report: PageViewReporter) => {
  let lastUrl = ''
  const emit = (trigger: PageViewTrackData['trigger']) => {
    const url = window.location.href
    if (url === lastUrl) return
    report({ trigger, from: lastUrl })
    lastUrl = url
  }

  const patch = (method: 'pushState' | 'replaceState') => {
    const original = window.history[method].bind(window.history)
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args)
      emit(method)
    }
  }
  patch('pushState')
  patch('replaceState')
  window.addEventListener('popstate', () => emit('popstate'))
  emit('init')
}
```

`PageViewTrackData` 在 `main.ts` 中以 `{ ...data }` 展开后传入 `track`，展开结果是匿名对象类型，可赋值给 `Record<string, unknown>`。

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- pageVisit`
Expected: PASS 4 tests。注意：`popstate` 用例中 `pushState('/b')` 与 `replaceState('/c')` 各触发一次，加 `init` 共 3 次，`popstate` 因 URL 未变化不再上报；若期望不同请对照 `emit` 逻辑调整用例数字，不要改实现。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/h5/h5PageVisit/index.ts packages/sdk/__test__/pageVisit.test.ts && git commit -m "feat(sdk): 自动采集 SPA 路由变化的 PV"
```

---

### Task 7: 自动错误采集 `h5Error`

**Files:**
- Modify: `packages/sdk/src/h5/h5Error/index.ts`（整文件替换注释代码）
- Create: `packages/sdk/__test__/error.test.ts`

**Interfaces:**
- Produces: `type ErrorTrackData = { kind: 'js' | 'promise' | 'resource', message, stack, filename, lineno, colno, resourceUrl, tagName }`、`startErrorCapture(report: (data: ErrorTrackData) => void): void`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi } from 'vitest'
import { startErrorCapture } from '../src/h5/h5Error'

const rejection = (reason: unknown) => Object.assign(new Event('unhandledrejection'), { reason })

describe('startErrorCapture', () => {
  it('JS 错误映射为 kind=js 并携带位置与堆栈', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const error = new Error('boom')
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error, filename: 'app.js', lineno: 10, colno: 5 }))
    expect(report).toHaveBeenCalledWith({
      kind: 'js', message: 'boom', stack: error.stack ?? '', filename: 'app.js', lineno: 10, colno: 5, resourceUrl: '', tagName: ''
    })
  })

  it('unhandledrejection 映射为 kind=promise', () => {
    const report = vi.fn()
    startErrorCapture(report)
    window.dispatchEvent(rejection(new Error('rejected')))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ kind: 'promise', message: 'rejected' }))
    window.dispatchEvent(rejection('plain string'))
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'promise', message: 'plain string', stack: '' }))
  })

  it('资源加载错误映射为 kind=resource 并携带 URL 与标签名', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const img = document.createElement('img')
    img.setAttribute('src', 'http://cdn/x.png')
    document.body.appendChild(img)
    img.dispatchEvent(new Event('error'))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ kind: 'resource', resourceUrl: 'http://cdn/x.png', tagName: 'img' }))
  })

  it('相同错误 60 秒内只上报一次，超过后再次上报', () => {
    vi.useFakeTimers()
    const report = vi.fn()
    startErrorCapture(report)
    const fire = () => window.dispatchEvent(new ErrorEvent('error', { message: 'dup', error: new Error('dup') }))
    fire()
    fire()
    expect(report).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_001)
    fire()
    expect(report).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('堆栈截断到 2000 字符', () => {
    const report = vi.fn()
    startErrorCapture(report)
    const error = new Error('long')
    error.stack = 'x'.repeat(5000)
    window.dispatchEvent(new ErrorEvent('error', { message: 'long', error }))
    expect(report.mock.calls[0][0].stack).toHaveLength(2000)
  })
})
```

（去重用例中两次 `new Error('dup')` 的 `stack` 在同一位置创建时内容相同；若 vitest 环境下堆栈行号不同导致去重失败，改为复用同一个 `error` 实例。）

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- error`
Expected: FAIL（`startErrorCapture` 未导出）。

- [ ] **Step 3: 写 `h5/h5Error/index.ts`**

```ts
export interface ErrorTrackData {
  kind: 'js' | 'promise' | 'resource'
  message: string
  stack: string
  filename: string
  lineno: number
  colno: number
  resourceUrl: string
  tagName: string
}

type ErrorReporter = (data: ErrorTrackData) => void

const STACK_MAX = 2000
const DEDUPE_WINDOW = 60 * 1000

const emptyError = (): ErrorTrackData => ({
  kind: 'js', message: '', stack: '', filename: '', lineno: 0, colno: 0, resourceUrl: '', tagName: ''
})

const truncateStack = (stack: string | undefined) => (stack ?? '').slice(0, STACK_MAX)

// 捕获 JS 错误、未处理的 Promise 拒绝和资源加载错误；相同错误 60 秒内只上报一次
export const startErrorCapture = (report: ErrorReporter) => {
  const recent = new Map<string, number>()
  const emit = (data: ErrorTrackData) => {
    const key = `${data.kind}|${data.message}|${data.stack}|${data.resourceUrl}`
    const now = Date.now()
    const last = recent.get(key)
    if (last !== undefined && now - last < DEDUPE_WINDOW) return
    recent.set(key, now)
    report(data)
  }

  window.addEventListener('error', (event) => {
    if (event.target instanceof Element) {
      const element = event.target
      const tagName = element.tagName.toLowerCase()
      emit({
        ...emptyError(),
        kind: 'resource',
        message: `资源加载失败: ${tagName}`,
        resourceUrl: element.getAttribute('src') ?? element.getAttribute('href') ?? '',
        tagName
      })
      return
    }
    emit({
      ...emptyError(),
      kind: 'js',
      message: event.message,
      stack: truncateStack(event.error instanceof Error ? event.error.stack : ''),
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    const isError = reason instanceof Error
    emit({
      ...emptyError(),
      kind: 'promise',
      message: isError ? reason.message : String(reason),
      stack: truncateStack(isError ? reason.stack : '')
    })
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- error`
Expected: PASS 5 tests。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/h5/h5Error/index.ts packages/sdk/__test__/error.test.ts && git commit -m "feat(sdk): 自动采集 JS 错误、Promise 拒绝与资源加载错误"
```

---

### Task 8: 性能采集 `h5Performance`

**Files:**
- Modify: `packages/sdk/src/h5/h5Performance/index.ts`（整文件替换注释代码）
- Create: `packages/sdk/__test__/performance.test.ts`

**Interfaces:**
- Produces: `type PerformanceTrackData = { dns, tcp, ttfb, domReady, load, redirectCount, fp, fcp, lcp, cls, fid, inp: number | null }`、`startPerformance(report: (data: PerformanceTrackData) => void): void`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { startPerformance } from '../src/h5/h5Performance'

type EntriesCallback = (list: { getEntries: () => PerformanceEntry[] }) => void

class FakeObserver {
  static callbacks = new Map<string, EntriesCallback>()
  constructor (private readonly callback: EntriesCallback) {}
  observe (init: { type: string }) { FakeObserver.callbacks.set(init.type, this.callback) }
  disconnect () {}
  static emit (type: string, entries: Array<Record<string, unknown>>) {
    FakeObserver.callbacks.get(type)?.({ getEntries: () => entries as unknown as PerformanceEntry[] })
  }
}

const hidePage = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

const navigationEntry = {
  startTime: 0, domainLookupStart: 10, domainLookupEnd: 30, connectStart: 30, connectEnd: 55,
  requestStart: 60, responseStart: 160, domContentLoadedEventEnd: 800, loadEventEnd: 1200, redirectCount: 1
}

describe('startPerformance', () => {
  afterEach(() => {
    FakeObserver.callbacks.clear()
    vi.unstubAllGlobals()
  })

  it('环境不支持 PerformanceObserver 时不抛出也不上报', () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    const report = vi.fn()
    expect(() => startPerformance(report)).not.toThrow()
    hidePage()
    expect(report).not.toHaveBeenCalled()
  })

  it('页面隐藏时上报一次导航耗时与 Web Vitals，再次隐藏不重复', () => {
    vi.stubGlobal('PerformanceObserver', FakeObserver)
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([navigationEntry as unknown as PerformanceEntry])
    const report = vi.fn()
    startPerformance(report)
    FakeObserver.emit('paint', [{ name: 'first-paint', startTime: 100.4 }, { name: 'first-contentful-paint', startTime: 120.6 }])
    FakeObserver.emit('largest-contentful-paint', [{ startTime: 300 }, { startTime: 450.2 }])
    FakeObserver.emit('layout-shift', [{ value: 0.05, hadRecentInput: false }, { value: 0.5, hadRecentInput: true }, { value: 0.0123, hadRecentInput: false }])
    FakeObserver.emit('first-input', [{ startTime: 500, processingStart: 530 }])
    FakeObserver.emit('event', [{ interactionId: 1, duration: 80 }, { interactionId: 0, duration: 900 }, { interactionId: 2, duration: 120 }])
    hidePage()
    hidePage()
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith({
      dns: 20, tcp: 25, ttfb: 100, domReady: 800, load: 1200, redirectCount: 1,
      fp: 100, fcp: 121, lcp: 450, cls: 0.062, fid: 30, inp: 120
    })
  })

  it('没有 navigation 条目时导航指标为 null', () => {
    vi.stubGlobal('PerformanceObserver', FakeObserver)
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([])
    const report = vi.fn()
    startPerformance(report)
    window.dispatchEvent(new Event('pagehide'))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ dns: null, tcp: null, ttfb: null, domReady: null, load: null, redirectCount: null, cls: 0 }))
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -w packages/sdk -- performance`
Expected: FAIL（`startPerformance` 未导出）。

- [ ] **Step 3: 写 `h5/h5Performance/index.ts`**

```ts
import log from '../../common/log'

export interface PerformanceTrackData {
  dns: number | null
  tcp: number | null
  ttfb: number | null
  domReady: number | null
  load: number | null
  redirectCount: number | null
  fp: number | null
  fcp: number | null
  lcp: number | null
  cls: number | null
  fid: number | null
  inp: number | null
}

type PerformanceReporter = (data: PerformanceTrackData) => void
type NavigationMetrics = Pick<PerformanceTrackData, 'dns' | 'tcp' | 'ttfb' | 'domReady' | 'load' | 'redirectCount'>
type WebVitals = Pick<PerformanceTrackData, 'fp' | 'fcp' | 'lcp' | 'fid' | 'inp'> & { cls: number }

const readNavigationTiming = (): NavigationMetrics => {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (!nav) return { dns: null, tcp: null, ttfb: null, domReady: null, load: null, redirectCount: null }
  return {
    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
    tcp: Math.round(nav.connectEnd - nav.connectStart),
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    load: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd - nav.startTime) : null,
    redirectCount: nav.redirectCount
  }
}

const observe = (type: string, onEntries: (entries: PerformanceEntry[]) => void, extra: Partial<PerformanceObserverInit> = {}) => {
  try {
    new PerformanceObserver((list) => onEntries(list.getEntries())).observe({ type, buffered: true, ...extra })
  } catch (error) {
    log.info(`PerformanceObserver 不支持 ${type}`, error)
  }
}

// 页面首次隐藏或卸载时定稿并上报一次性能指标
export const startPerformance = (report: PerformanceReporter) => {
  if (typeof PerformanceObserver === 'undefined') {
    log.info('当前环境不支持 PerformanceObserver，跳过性能采集')
    return
  }
  const vitals: WebVitals = { fp: null, fcp: null, lcp: null, cls: 0, fid: null, inp: null }

  observe('paint', (entries) => entries.forEach((entry) => {
    if (entry.name === 'first-paint') vitals.fp = Math.round(entry.startTime)
    if (entry.name === 'first-contentful-paint') vitals.fcp = Math.round(entry.startTime)
  }))
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) vitals.lcp = Math.round(last.startTime)
  })
  observe('layout-shift', (entries) => entries.forEach((entry) => {
    const shift = entry as PerformanceEntry & { value: number, hadRecentInput: boolean }
    if (!shift.hadRecentInput) vitals.cls += shift.value
  }))
  observe('first-input', (entries) => {
    const first = entries[0] as PerformanceEventTiming | undefined
    if (first) vitals.fid = Math.round(first.processingStart - first.startTime)
  })
  observe('event', (entries) => entries.forEach((entry) => {
    const timing = entry as PerformanceEventTiming & { interactionId?: number }
    if (timing.interactionId) vitals.inp = Math.max(vitals.inp ?? 0, Math.round(timing.duration))
  }), { durationThreshold: 40 })

  let isReported = false
  const finalize = () => {
    if (isReported) return
    isReported = true
    report({ ...readNavigationTiming(), ...vitals, cls: Math.round(vitals.cls * 1000) / 1000 })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize()
  })
  window.addEventListener('pagehide', finalize)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -w packages/sdk -- performance`
Expected: PASS 3 tests。

- [ ] **Step 5: Commit（仅在用户要求提交时）**

```bash
git add packages/sdk/src/h5/h5Performance/index.ts packages/sdk/__test__/performance.test.ts && git commit -m "feat(sdk): 采集导航耗时与 FP/FCP/LCP/CLS/FID/INP"
```

---

### Task 9: SDK 入口接线、删除旧上报、示例页面

**Files:**
- Modify: `packages/sdk/src/main.ts`、`packages/sdk/example/index.html`
- Delete: `packages/sdk/src/common/report.ts`

**Interfaces:**
- Consumes: Task 2–8 全部产出。
- Produces: UMD 全局 `FantaReport` 的 `initReport / pageView / click / error / custom / setUserId / flush / version / env`。

- [ ] **Step 1: 删除旧上报**

```bash
git rm -q packages/sdk/src/common/report.ts
```

- [ ] **Step 2: 重写 `packages/sdk/src/main.ts`**

```ts
import type { TrackType } from '@fanta/shared'
import type { InitParams, TrackData } from './types'
import Store from './common/store'
import log from './common/log'
import { EventQueue } from './common/queue'
import { createTransport } from './common/transport'
import { touchSession } from './common/session'
import { getUUID } from './common/utils'
import { QUEUE_LOCAL_KEY, QUEUE_MAX_STORED, QUEUE_MAX_ATTEMPTS } from './common/constant'
import { getPageInfo } from './h5/h5BaseInfo/location'
import { startPageVisit } from './h5/h5PageVisit'
import { startErrorCapture } from './h5/h5Error'
import { startPerformance } from './h5/h5Performance'

const version = '__VERSION__'
const env = '__ENV__'

let queue: EventQueue | null = null

// 组装完整事件并入队；页面信息与会话在每次上报时实时读取
const track = (trackType: TrackType, trackData: TrackData = {}) => {
  if (!queue) {
    log.error('请先调用 initReport')
    return
  }
  queue.push({
    ...Store.getContext(),
    ...getPageInfo(),
    sessionId: touchSession(),
    trackId: getUUID(),
    trackType,
    trackTime: Date.now(),
    trackData
  })
}

const initReport = (params: InitParams) => {
  if (!params?.reportHost) throw new Error('[fanta-report] reportHost 未配置')
  if (!params.appName) throw new Error('[fanta-report] appName 未配置')
  Store.init(params, { version, env })
  const { reportHost, enableImgFallback, batchSize, flushInterval, autoTrack } = Store.config
  queue = new EventQueue({
    send: createTransport({ reportHost, enableImgFallback }),
    batchSize,
    flushInterval,
    storageKey: QUEUE_LOCAL_KEY,
    maxStored: QUEUE_MAX_STORED,
    maxAttempts: QUEUE_MAX_ATTEMPTS
  })
  if (autoTrack.pageView) startPageVisit((data) => track('PageView', { ...data }))
  if (autoTrack.error) startErrorCapture((data) => track('Error', { ...data }))
  if (autoTrack.performance) startPerformance((data) => track('Performance', { ...data }))
  log.info('sdk init done', Store.config)
}

const pageView = (data: TrackData = {}) => track('PageView', { trigger: 'manual', ...data })
const click = (data: TrackData = {}) => track('Click', data)
const error = (data: TrackData = {}) => track('Error', data)
const custom = (data: TrackData = {}) => track('Custom', data)
const setUserId = (userId: string) => Store.setUserId(userId)
const flush = async () => { await queue?.flush() }

export { initReport, pageView, click, error, custom, setUserId, flush, version, env }
```

- [ ] **Step 3: 重写 `packages/sdk/example/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fanta Report Example</title>
    <script src="./fanta-report.umd.js"></script>
    <script>
      window.FantaReport.initReport({
        reportHost: 'http://localhost:5001/v1/track',
        appName: 'fantaTestPage',
        appVersion: '0.1.0',
        debug: true,
        batchSize: 3,
        flushInterval: 2000
      });
    </script>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      button { display: block; margin: 8px 0; padding: 8px 16px; }
    </style>
  </head>
  <body>
    <h1>打开开发者工具查看控制台与网络请求</h1>
    <button id="btn-click" onclick="FantaReport.click({ button: 'btn-click' })">上报 Click</button>
    <button id="btn-route" onclick="history.pushState({}, '', '/page-' + Date.now())">SPA 路由切换（自动 PV）</button>
    <button id="btn-error" onclick="setTimeout(() => { throw new Error('example error') }, 0)">触发 JS 错误（自动 Error）</button>
    <button id="btn-custom" onclick="FantaReport.custom({ scene: 'demo' })">上报 Custom</button>
    <button id="btn-flush" onclick="FantaReport.flush()">立即发送</button>
  </body>
</html>
```

- [ ] **Step 4: 构建并跑全部 SDK 测试**

Run: `npm run build -w packages/shared && npm run build -w packages/sdk && npm test -w packages/sdk`
Expected: 三个 dist 文件生成；全部测试 PASS。若 `rollup-plugin-typescript2` 报 `@fanta/shared` 类型找不到，确认 `packages/shared/dist/index.d.ts` 已存在。

- [ ] **Step 5: 检查产物无 ipify 与 `__BUILDTIME__` 残留**

Run: `grep -c "ipify" packages/sdk/dist/fanta-report.umd.js; grep -c "__BUILDTIME__" packages/sdk/dist/fanta-report.umd.js`
Expected: 两次输出都是 `0`。

- [ ] **Step 6: Commit（仅在用户要求提交时）**

```bash
git add -A packages/sdk && git commit -m "feat(sdk): 接入队列与自动采集，升级 0.1.0"
```

---

### Task 10: 服务端骨架、配置、迁移

**Files:**
- Create: `packages/server/package.json`、`packages/server/tsconfig.json`、`packages/server/vitest.config.ts`、`packages/server/.env.example`、`packages/server/src/config.ts`、`packages/server/src/migrations.ts`、`packages/server/scripts/migrate.ts`、`packages/server/migrations/0001_track_events.up.sql`、`packages/server/migrations/0001_track_events.down.sql`、`packages/server/__test__/config.test.ts`

**Interfaces:**
- Produces: `interface ServerConfig { databaseUrl; port; allowedApps: Set<string>; corsOrigin; trustProxy; logLevel }`、`loadConfig(env?): ServerConfig`、`migrateUp(pool): Promise<string[]>`、`migrateDown(pool): Promise<string | null>`。

- [ ] **Step 1: 写 `packages/server/package.json`**

```json
{
  "name": "@fanta/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch --env-file=.env src/server.ts",
    "start": "node --env-file=.env dist/server.js",
    "migrate": "tsx --env-file=.env scripts/migrate.ts",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: 安装服务端依赖**

```bash
cd /Users/lion1ou/Space/Code/fanta-monitor-report
npm i -w packages/server fastify @fastify/cors pg ajv @fanta/shared@0.1.0
npm i -D -w packages/server tsx @types/node @types/pg
```

- [ ] **Step 3: 写 `tsconfig.json`、`vitest.config.ts`、`.env.example`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@fanta/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) }
  },
  test: {
    environment: 'node',
    include: ['__test__/**/*.test.ts'],
    fileParallelism: false
  }
})
```

```
DATABASE_URL=postgres://localhost:5432/fanta_monitor
ALLOWED_APPS=fantaTestPage
PORT=5001
CORS_ORIGIN=*
TRUST_PROXY=false
LOG_LEVEL=info
```

- [ ] **Step 4: 写失败测试 `__test__/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('缺少必填变量时抛出并列出变量名', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL, ALLOWED_APPS')
  })

  it('ALLOWED_APPS 为空字符串时抛出', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: ' , ' })).toThrow('ALLOWED_APPS')
  })

  it('解析白名单并填充默认值', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: 'a, b ,c' })
    expect([...config.allowedApps]).toEqual(['a', 'b', 'c'])
    expect(config).toMatchObject({ port: 5001, corsOrigin: '*', trustProxy: false, logLevel: 'info' })
  })

  it('读取可选变量', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: 'a', PORT: '8080', TRUST_PROXY: 'true', CORS_ORIGIN: 'https://a.com', LOG_LEVEL: 'warn' })
    expect(config).toMatchObject({ port: 8080, trustProxy: true, corsOrigin: 'https://a.com', logLevel: 'warn' })
  })
})
```

- [ ] **Step 5: 运行确认失败**

Run: `npm test -w packages/server -- config`
Expected: FAIL（模块不存在）。

- [ ] **Step 6: 写 `src/config.ts`**

```ts
export interface ServerConfig {
  databaseUrl: string
  port: number
  allowedApps: Set<string>
  corsOrigin: string
  trustProxy: boolean
  logLevel: string
}

// 从环境变量装配配置；必填项缺失直接抛出，进程启动失败
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const databaseUrl = env.DATABASE_URL
  const allowedAppsRaw = env.ALLOWED_APPS
  const missing = [!databaseUrl && 'DATABASE_URL', !allowedAppsRaw && 'ALLOWED_APPS'].filter(Boolean)
  if (!databaseUrl || !allowedAppsRaw) throw new Error(`缺少环境变量: ${missing.join(', ')}`)

  const allowedApps = allowedAppsRaw.split(',').map((name) => name.trim()).filter(Boolean)
  if (allowedApps.length === 0) throw new Error('ALLOWED_APPS 不能为空')

  return {
    databaseUrl,
    port: Number(env.PORT ?? 5001),
    allowedApps: new Set(allowedApps),
    corsOrigin: env.CORS_ORIGIN ?? '*',
    trustProxy: env.TRUST_PROXY === 'true',
    logLevel: env.LOG_LEVEL ?? 'info'
  }
}
```

- [ ] **Step 7: 运行确认通过**

Run: `npm test -w packages/server -- config`
Expected: PASS 4 tests。

- [ ] **Step 8: 写迁移 SQL**

`migrations/0001_track_events.up.sql`：

```sql
CREATE TABLE track_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_name       text NOT NULL,
  track_id       text NOT NULL,
  track_type     text NOT NULL,
  track_time     timestamptz NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  track_data     jsonb NOT NULL DEFAULT '{}',
  app_version    text,
  user_id        text,
  uuid           text,
  session_id     text,
  sdk_version    text NOT NULL,
  sdk_env        text,
  page_origin    text,
  page_path      text,
  page_search    text,
  page_protocol  text,
  page_title     text,
  referrer       text,
  user_agent     text,
  device_type    text,
  mobile_brand   text,
  mobile_model   text,
  os             text,
  os_version     text,
  browser        text,
  browser_version text,
  browser_engine text,
  is_bot         boolean,
  is_webview     boolean,
  language       text,
  orientation    text,
  screen_width   int,
  screen_height  int,
  viewport_width int,
  viewport_height int,
  network_type   text,
  network_effective_type text,
  finger_print   text,
  finger_print_canvas text,
  coordinates    text,
  client_ip      inet,
  CONSTRAINT track_events_app_track_uniq UNIQUE (app_name, track_id)
);

CREATE INDEX track_events_app_time_idx ON track_events (app_name, track_time DESC);
CREATE INDEX track_events_app_type_time_idx ON track_events (app_name, track_type, track_time DESC);
```

`migrations/0001_track_events.down.sql`：

```sql
DROP TABLE track_events;
```

- [ ] **Step 9: 写 `src/migrations.ts`**

```ts
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url))

const ensureVersionTable = async (pool: Pool) => {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
}

const appliedVersions = async (pool: Pool): Promise<string[]> => {
  const { rows } = await pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
  return rows.map((row) => row.version)
}

// 迁移 SQL 与版本记录在同一事务内执行，失败整体回滚
const runInTransaction = async (pool: Pool, sql: string, bookkeeping: string, version: string) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(bookkeeping, [version])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// 按文件名顺序应用全部未执行的 *.up.sql，返回本次应用的版本
export const migrateUp = async (pool: Pool): Promise<string[]> => {
  await ensureVersionTable(pool)
  const applied = new Set(await appliedVersions(pool))
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.up.sql')).sort()
  const done: string[] = []
  for (const file of files) {
    const version = file.replace(/\.up\.sql$/, '')
    if (applied.has(version)) continue
    const sql = await readFile(`${MIGRATIONS_DIR}${file}`, 'utf8')
    await runInTransaction(pool, sql, 'INSERT INTO schema_migrations (version) VALUES ($1)', version)
    done.push(version)
  }
  return done
}

// 回滚最近一个版本，返回该版本；无可回滚项返回 null
export const migrateDown = async (pool: Pool): Promise<string | null> => {
  await ensureVersionTable(pool)
  const versions = await appliedVersions(pool)
  const version = versions[versions.length - 1]
  if (!version) return null
  const sql = await readFile(`${MIGRATIONS_DIR}${version}.down.sql`, 'utf8')
  await runInTransaction(pool, sql, 'DELETE FROM schema_migrations WHERE version = $1', version)
  return version
}
```

- [ ] **Step 10: 写 `scripts/migrate.ts`**

```ts
import { Pool } from 'pg'
import { migrateUp, migrateDown } from '../src/migrations.js'

const command = process.argv[2]
if (command !== 'up' && command !== 'down') {
  console.error('用法: migrate up|down')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('缺少环境变量 DATABASE_URL')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  if (command === 'up') {
    const applied = await migrateUp(pool)
    console.log(applied.length > 0 ? `已应用: ${applied.join(', ')}` : '没有待应用的迁移')
  } else {
    const reverted = await migrateDown(pool)
    console.log(reverted ? `已回滚: ${reverted}` : '没有可回滚的迁移')
  }
} finally {
  await pool.end()
}
```

- [ ] **Step 11: 准备本机数据库并验证迁移可上可下**

前置：用户已执行 `brew services start postgresql@15`。

```bash
createdb fanta_monitor && createdb fanta_monitor_test
cd packages/server && cp .env.example .env
npm run migrate -- up
psql fanta_monitor -c '\d track_events' | head -5
npm run migrate -- down
psql fanta_monitor -c '\d track_events'
npm run migrate -- up
```

Expected：第一次 `up` 输出 `已应用: 0001_track_events`；`\d` 显示表；`down` 输出 `已回滚: 0001_track_events`，随后 `\d` 报 `Did not find any relation`；再次 `up` 成功。

- [ ] **Step 12: Commit（仅在用户要求提交时）**

```bash
git add packages/server && git commit -m "feat(server): 服务端骨架、环境配置与 track_events 迁移"
```

---

### Task 11: 写入、路由、应用装配与集成测试

**Files:**
- Create: `packages/server/src/db.ts`、`packages/server/src/routes/track.ts`、`packages/server/src/app.ts`、`packages/server/src/server.ts`、`packages/server/__test__/helpers.ts`、`packages/server/__test__/track.test.ts`

**Interfaces:**
- Consumes: `ServerConfig`、`migrateUp`（Task 10）；`trackBatchSchema`、`trackEventSchema`、`TrackBatch`、`TrackEvent`（Task 1）。
- Produces: `createPool(databaseUrl): Pool`、`insertTrackEvents(pool, events, clientIp): Promise<number>`、`trackRoutes` 插件、`buildApp(config, pool): FastifyInstance`。

- [ ] **Step 1: 写 `__test__/helpers.ts`**

```ts
import type { TrackEvent } from '@fanta/shared'

export const makeEvent = (overrides: Partial<TrackEvent> = {}): TrackEvent => ({
  trackId: 'evt-1',
  trackType: 'PageView',
  trackTime: 1_700_000_000_000,
  trackData: { page: 'home' },
  appName: 'demo',
  uuid: 'uuid-1',
  sessionId: 'sess-1',
  sdkVersion: '0.1.0',
  sdkEnv: 'test',
  pageOrigin: 'http://localhost',
  pagePath: '/',
  pageSearch: '',
  pageProtocol: 'http:',
  pageTitle: 'Home',
  referrer: '',
  userAgent: 'vitest',
  deviceType: 'Desktop',
  mobileBrand: '',
  mobileModel: '',
  os: 'Mac OS X',
  osVersion: '14',
  browser: 'Chrome',
  browserVersion: '120',
  browserEngine: 'Blink',
  isBot: false,
  isWebview: false,
  language: 'zh-CN',
  orientation: 'landscape',
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1200,
  viewportHeight: 800,
  networkType: 'wifi',
  networkEffectiveType: '4g',
  fingerPrint: 'fp',
  fingerPrintCanvas: 'fpc',
  ...overrides
})
```

- [ ] **Step 2: 写失败测试 `__test__/track.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import type { TrackEvent } from '@fanta/shared'
import { buildApp } from '../src/app.js'
import { migrateUp } from '../src/migrations.js'
import { makeEvent } from './helpers.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('缺少 TEST_DATABASE_URL，服务端集成测试需要真实 PostgreSQL')

const pool = new Pool({ connectionString: databaseUrl })
const app = buildApp({ databaseUrl, port: 0, allowedApps: new Set(['demo']), corsOrigin: '*', trustProxy: true, logLevel: 'silent' }, pool)

const postBatch = async (events: unknown[], headers: Record<string, string> = {}) => await app.inject({
  method: 'POST',
  url: '/v1/track',
  headers: { 'content-type': 'text/plain;charset=UTF-8', ...headers },
  payload: JSON.stringify({ events })
})

const countRows = async () => Number((await pool.query('SELECT count(*) FROM track_events')).rows[0].count)

beforeAll(async () => {
  await migrateUp(pool)
  await app.ready()
})
beforeEach(async () => { await pool.query('TRUNCATE track_events') })
afterAll(async () => {
  await app.close()
  await pool.end()
})

describe('POST /v1/track', () => {
  it('写入整批事件并记录代理头中的客户端 IP', async () => {
    const res = await postBatch(
      [makeEvent({ trackId: 'a' }), makeEvent({ trackId: 'b', trackType: 'Click', trackData: { button: 'buy' } })],
      { 'x-forwarded-for': '203.0.113.9' }
    )
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ accepted: 2, duplicates: 0 })
    const { rows } = await pool.query(
      'SELECT track_id, track_type, client_ip::text AS client_ip, track_data, app_name, sdk_version FROM track_events ORDER BY track_id'
    )
    expect(rows).toEqual([
      { track_id: 'a', track_type: 'PageView', client_ip: '203.0.113.9', track_data: { page: 'home' }, app_name: 'demo', sdk_version: '0.1.0' },
      { track_id: 'b', track_type: 'Click', client_ip: '203.0.113.9', track_data: { button: 'buy' }, app_name: 'demo', sdk_version: '0.1.0' }
    ])
  })

  it('track_time 按客户端毫秒时间戳写入', async () => {
    await postBatch([makeEvent({ trackTime: 1_700_000_000_000 })])
    const { rows } = await pool.query('SELECT extract(epoch FROM track_time) * 1000 AS ms FROM track_events')
    expect(Number(rows[0].ms)).toBe(1_700_000_000_000)
  })

  it('重复 trackId 只写一行并计入 duplicates', async () => {
    await postBatch([makeEvent({ trackId: 'dup' })])
    const res = await postBatch([makeEvent({ trackId: 'dup' }), makeEvent({ trackId: 'new' })])
    expect(res.json()).toEqual({ accepted: 1, duplicates: 1 })
    expect(await countRows()).toBe(2)
  })

  it('请求体不符合契约返回 400', async () => {
    const res = await postBatch([{ trackId: 'x' }])
    expect(res.statusCode).toBe(400)
    expect(await countRows()).toBe(0)
  })

  it('空数组返回 400', async () => {
    expect((await postBatch([])).statusCode).toBe(400)
  })

  it('appName 不在白名单返回 403 且整批不写库', async () => {
    const res = await postBatch([makeEvent({ trackId: 'ok' }), makeEvent({ trackId: 'bad', appName: 'evil' })])
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'app_not_allowed', appName: 'evil' })
    expect(await countRows()).toBe(0)
  })

  it('application/json 同样可以解析', async () => {
    const res = await postBatch([makeEvent()], { 'content-type': 'application/json' })
    expect(res.statusCode).toBe(200)
  })

  it('text/plain 但不是 JSON 时返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/track', headers: { 'content-type': 'text/plain' }, payload: 'not json' })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /v1/track.gif', () => {
  const encode = (event: TrackEvent) => Buffer.from(JSON.stringify(event)).toString('base64url')

  it('解析 d 参数写入事件并返回 GIF', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/track.gif?d=${encode(makeEvent({ trackId: 'px' }))}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/gif')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.rawPayload.subarray(0, 6).toString()).toBe('GIF89a')
    expect(await countRows()).toBe(1)
  })

  it('d 无法解析时仍返回 GIF 且不写库', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/track.gif?d=not-base64-json' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/gif')
    expect(await countRows()).toBe(0)
  })

  it('appName 不在白名单时返回 GIF 且不写库', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/track.gif?d=${encode(makeEvent({ appName: 'evil' }))}` })
    expect(res.statusCode).toBe(200)
    expect(await countRows()).toBe(0)
  })
})

describe('GET /health', () => {
  it('数据库可用时返回 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `TEST_DATABASE_URL=postgres://localhost:5432/fanta_monitor_test npm test -w packages/server -- track`
Expected: FAIL（`../src/app.js` 不存在）。

- [ ] **Step 4: 写 `src/db.ts`**

```ts
import { Pool } from 'pg'
import type { TrackEvent } from '@fanta/shared'

export const createPool = (databaseUrl: string): Pool => new Pool({ connectionString: databaseUrl, max: 10 })

// 事件字段 → 列名 → PG 类型；顺序即 INSERT 列顺序
const COLUMNS: Array<[column: string, field: keyof TrackEvent, pgType: string]> = [
  ['app_name', 'appName', 'text'],
  ['track_id', 'trackId', 'text'],
  ['track_type', 'trackType', 'text'],
  ['track_data', 'trackData', 'jsonb'],
  ['app_version', 'appVersion', 'text'],
  ['user_id', 'userId', 'text'],
  ['uuid', 'uuid', 'text'],
  ['session_id', 'sessionId', 'text'],
  ['sdk_version', 'sdkVersion', 'text'],
  ['sdk_env', 'sdkEnv', 'text'],
  ['page_origin', 'pageOrigin', 'text'],
  ['page_path', 'pagePath', 'text'],
  ['page_search', 'pageSearch', 'text'],
  ['page_protocol', 'pageProtocol', 'text'],
  ['page_title', 'pageTitle', 'text'],
  ['referrer', 'referrer', 'text'],
  ['user_agent', 'userAgent', 'text'],
  ['device_type', 'deviceType', 'text'],
  ['mobile_brand', 'mobileBrand', 'text'],
  ['mobile_model', 'mobileModel', 'text'],
  ['os', 'os', 'text'],
  ['os_version', 'osVersion', 'text'],
  ['browser', 'browser', 'text'],
  ['browser_version', 'browserVersion', 'text'],
  ['browser_engine', 'browserEngine', 'text'],
  ['is_bot', 'isBot', 'boolean'],
  ['is_webview', 'isWebview', 'boolean'],
  ['language', 'language', 'text'],
  ['orientation', 'orientation', 'text'],
  ['screen_width', 'screenWidth', 'int'],
  ['screen_height', 'screenHeight', 'int'],
  ['viewport_width', 'viewportWidth', 'int'],
  ['viewport_height', 'viewportHeight', 'int'],
  ['network_type', 'networkType', 'text'],
  ['network_effective_type', 'networkEffectiveType', 'text'],
  ['finger_print', 'fingerPrint', 'text'],
  ['finger_print_canvas', 'fingerPrintCanvas', 'text'],
  ['coordinates', 'coordinates', 'text']
]

const INSERT_SQL = `
INSERT INTO track_events (track_time, client_ip, ${COLUMNS.map(([column]) => column).join(', ')})
SELECT to_timestamp(t."trackTime" / 1000.0), NULLIF($2, '')::inet, ${COLUMNS.map(([, field]) => `t."${field}"`).join(', ')}
FROM jsonb_to_recordset($1::jsonb) AS t("trackTime" bigint, ${COLUMNS.map(([, field, pgType]) => `"${field}" ${pgType}`).join(', ')})
ON CONFLICT (app_name, track_id) DO NOTHING
RETURNING 1`

// 一条 SQL 写入整批；(app_name, track_id) 已存在的事件跳过；返回实际写入条数
export const insertTrackEvents = async (pool: Pool, events: TrackEvent[], clientIp: string): Promise<number> => {
  const { rowCount } = await pool.query(INSERT_SQL, [JSON.stringify(events), clientIp])
  return rowCount ?? 0
}
```

- [ ] **Step 5: 写 `src/routes/track.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'
import Ajv from 'ajv'
import { trackBatchSchema, trackEventSchema, type TrackBatch, type TrackEvent } from '@fanta/shared'
import { insertTrackEvents } from '../db.js'

const GIF_1X1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const validateEvent = new Ajv({ removeAdditional: true, coerceTypes: true }).compile<TrackEvent>(trackEventSchema)

// 像素上报把单条事件 JSON 以 base64url 放在 query d 中
const decodePixelEvent = (encoded: string): TrackEvent => {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (!validateEvent(parsed)) throw new Error(`事件不符合契约: ${JSON.stringify(validateEvent.errors)}`)
  return parsed
}

export interface TrackRoutesOptions {
  pool: Pool
  allowedApps: Set<string>
}

export const trackRoutes: FastifyPluginAsync<TrackRoutesOptions> = async (app, { pool, allowedApps }) => {
  app.post<{ Body: TrackBatch }>('/v1/track', { schema: { body: trackBatchSchema } }, async (request, reply) => {
    const { events } = request.body
    const rejected = events.find((event) => !allowedApps.has(event.appName))
    if (rejected) return await reply.code(403).send({ error: 'app_not_allowed', appName: rejected.appName })
    const accepted = await insertTrackEvents(pool, events, request.ip)
    return { accepted, duplicates: events.length - accepted }
  })

  app.get<{ Querystring: { d?: string } }>('/v1/track.gif', {
    schema: { querystring: { type: 'object', properties: { d: { type: 'string' } } } }
  }, async (request, reply) => {
    void reply.header('Cache-Control', 'no-store').type('image/gif')
    let event: TrackEvent
    try {
      event = decodePixelEvent(request.query.d ?? '')
    } catch (error) {
      request.log.warn({ err: error }, '像素上报数据无效')
      return await reply.send(GIF_1X1)
    }
    if (!allowedApps.has(event.appName)) {
      request.log.warn({ appName: event.appName }, '像素上报 appName 不在白名单')
      return await reply.send(GIF_1X1)
    }
    await insertTrackEvents(pool, [event], request.ip)
    return await reply.send(GIF_1X1)
  })

  app.get('/health', async (request, reply) => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok' }
    } catch (error) {
      request.log.error({ err: error }, '数据库不可用')
      return await reply.code(503).send({ status: 'error' })
    }
  })
}
```

- [ ] **Step 6: 写 `src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { Pool } from 'pg'
import type { ServerConfig } from './config.js'
import { trackRoutes } from './routes/track.js'

export const buildApp = (config: ServerConfig, pool: Pool): FastifyInstance => {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024
  })

  // SDK 以 text/plain 发送 JSON 以避开 CORS 预检，这里按 JSON 解析
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, JSON.parse(String(body)))
    } catch (error) {
      const parseError = error instanceof Error ? error : new Error(String(error))
      done(Object.assign(parseError, { statusCode: 400 }), undefined)
    }
  })

  void app.register(cors, { origin: config.corsOrigin })
  void app.register(trackRoutes, { pool, allowedApps: config.allowedApps })
  return app
}
```

- [ ] **Step 7: 写 `src/server.ts`**

```ts
import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { buildApp } from './app.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)
const app = buildApp(config, pool)

// 先停止接收请求，再释放数据库连接
const shutdown = (signal: string) => {
  app.log.info({ signal }, '收到退出信号，开始关闭')
  app.close()
    .then(async () => await pool.end())
    .then(() => process.exit(0), (error) => {
      app.log.error({ err: error }, '关闭失败')
      process.exit(1)
    })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

await app.listen({ port: config.port, host: '0.0.0.0' })
```

- [ ] **Step 8: 运行集成测试确认通过**

Run: `TEST_DATABASE_URL=postgres://localhost:5432/fanta_monitor_test npm test -w packages/server`
Expected: `config` 4 tests + `track` 12 tests 全部 PASS。若 `text/plain;charset=UTF-8` 用例 415，说明 Fastify 未匹配带参数的媒体类型，改为 `app.addContentTypeParser(/^text\/plain/, …)`。

- [ ] **Step 9: 构建并启动服务做冒烟**

```bash
npm run build -w packages/shared && npm run build -w packages/server
(cd packages/server && npm start &) ; sleep 2
curl -s localhost:5001/health
curl -s -X POST localhost:5001/v1/track -H 'content-type: text/plain' -d '{"events":[]}'
kill %1
```

Expected: `{"status":"ok"}`；第二条返回 400 JSON。

- [ ] **Step 10: Commit（仅在用户要求提交时）**

```bash
git add packages/server && git commit -m "feat(server): 采集写入、像素端点、健康检查与集成测试"
```

---

### Task 12: 根级 lint、README、端到端验证

**Files:**
- Modify: `README.md`
- Verify: 全仓 `npm run build`、`npm run lint`、`npm test`；Playwright 端到端脚本放 `/tmp`，不进仓库。

- [ ] **Step 1: 运行 lint 并修复**

Run: `npm run lint`
Expected: 无 error。规则冲突时只调整代码，不放宽 `.eslintrc.js` 规则；若 `standard-with-typescript` 对 `packages/server/src/server.ts` 顶层 `await` 报错，在该文件首行加 `/* eslint-env node */` 并确认 `tsconfig` `module: NodeNext`。

- [ ] **Step 2: 重写根 `README.md`**

```markdown
# fanta-monitor

浏览器埋点 SDK（`fanta-monitor-report`）与配套采集服务（`@fanta/server`），事件写入 PostgreSQL。

## 目录

- `packages/shared`：事件契约（JSON Schema 与推导类型）
- `packages/sdk`：浏览器 SDK，产物 `dist/fanta-report.{cjs,es,umd}.js`
- `packages/server`：Fastify 采集服务与数据库迁移

## 开发

```bash
npm install
npm run build          # shared → sdk → server
npm run lint
npm test               # 服务端集成测试需要 TEST_DATABASE_URL
```

## 服务端

```bash
cp packages/server/.env.example packages/server/.env   # 填写 DATABASE_URL 与 ALLOWED_APPS
npm run migrate -- up                                   # 回滚：npm run migrate -- down
npm run dev:server                                      # 或构建后 npm start -w packages/server
```

环境变量：`DATABASE_URL`、`ALLOWED_APPS`（必填）；`PORT=5001`、`CORS_ORIGIN=*`、`TRUST_PROXY=false`、`LOG_LEVEL=info`。

接口：`POST /v1/track` 接收 `{ events: TrackEvent[] }`（1–50 条，`text/plain` 或 `application/json`）；`GET /v1/track.gif?d=<base64url(event)>` 像素上报；`GET /health`。

## SDK

```html
<script src="fanta-report.umd.js"></script>
<script>
  FantaReport.initReport({ reportHost: 'https://your-host/v1/track', appName: 'yourApp' })
  FantaReport.click({ button: 'buy' })
</script>
```

`initReport` 参数：`reportHost`、`appName` 必填；`appVersion`、`userId`、`debug`、`enableGeo=false`、`autoTrack={ pageView, error, performance }`（默认全开）、`batchSize=10`、`flushInterval=5000`、`enableImgFallback=true`。

方法：`pageView / click / error / custom(data?)`、`setUserId(userId)`、`flush()`。

自动采集：SPA 路由 PV、JS 错误 / Promise 拒绝 / 资源加载错误、页面隐藏时的导航耗时与 FP/FCP/LCP/CLS/FID/INP。
```

- [ ] **Step 3: 全仓验证**

Run: `npm run build && npm run lint && TEST_DATABASE_URL=postgres://localhost:5432/fanta_monitor_test npm test`
Expected: 全部成功，无 error。

- [ ] **Step 4: 端到端验证（读取 `webapp-testing` skill 后执行）**

1. 服务端 `.env` 中 `ALLOWED_APPS=fantaTestPage`，执行 `npm run migrate -- up`，启动 `npm run dev:server`。
2. 另开终端 `npm run dev:sdk`（rollup serve 在 `http://localhost:3388`，产物输出到 `packages/sdk/dist`，example 引用 `./fanta-report.umd.js`）。
3. 在 `/tmp/fanta-e2e.mjs` 写 Playwright 脚本：打开 `http://localhost:3388`，依次点击 `#btn-click`、`#btn-route`、`#btn-error`、`#btn-custom`，调用 `page.evaluate(() => FantaReport.flush())`，再 `page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })` 触发性能定稿与队列发送，等待 1 秒后 `page.evaluate(() => FantaReport.flush())`。
4. 查询：`psql fanta_monitor -c "SELECT track_type, count(*) FROM track_events WHERE app_name='fantaTestPage' GROUP BY 1 ORDER BY 1"`。

Expected：`Click 1`、`Custom 1`、`Error 1`、`PageView 2`（init + pushState）、`Performance 1`；`client_ip` 为 `127.0.0.1` 或 `::1`。

- [ ] **Step 5: 清理与 Commit（仅在用户要求提交时）**

```bash
rm -f /tmp/fanta-e2e.mjs
git add README.md && git commit -m "docs: 更新 monorepo 使用说明"
```
