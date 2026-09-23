# 埋点上报 SDK 与采集服务设计

## 1. 背景与目标

`fanta-monitor-report` 是浏览器端埋点 SDK（0.0.3），提供 `pageView / click / error / custom` 四个手动上报方法，并采集设备、浏览器、页面和指纹信息。当前没有配套服务端，上报请求无处接收；SDK 自身存在传输格式不统一、无队列、客户端调用公网 IP 接口、初始化即请求地理位置授权、自动采集模块全部处于注释状态等问题。

本方案完成两件事：

1. 把 SDK 升级到 0.1.0：统一上报契约，补齐队列、会话、自动错误、自动 PV、性能采集，收紧类型。
2. 新建采集服务：接收 SDK 批量事件，校验后写入 PostgreSQL。

## 2. 范围与非目标

范围：SDK 改造、共享契约包、采集服务（写入端点、像素端点、健康检查）、数据库迁移、单元与集成测试、示例页面端到端验证。

非目标：查询 API、看板、告警、限流、Source Map 还原、多租户权限系统、pm2 或 Nginx 部署配置。

## 3. 已确定的决策

| 决策项 | 选择 | 理由 |
| --- | --- | --- |
| 仓库形态 | npm workspaces monorepo：`packages/shared`、`packages/sdk`、`packages/server` | 事件契约只维护一份；SDK、服务、示例在一个仓库内可以整体运行 |
| HTTP 框架 | Fastify 5 | TypeScript 类型完整，内置 JSON Schema 请求校验，可以直接复用共享契约 |
| 数据库访问 | `pg` 驱动 + 参数化 SQL + 编号 SQL 迁移文件 | 依赖最少，SQL 可以直接审阅，回滚脚本与迁移脚本成对存在 |
| 服务范围 | 只做采集 | 查询与展示需求尚未明确，避免预先设计接口 |
| 存储模型 | 单宽表 `track_events`，公共维度为列，`track_data` 为 JSONB | 结构简单；公共维度可以直接按列聚合；自定义数据按需加索引 |
| 接入鉴权 | `ALLOWED_APPS` 环境变量白名单 | 零表结构，防止误接入；恶意写入不在本次防护范围 |
| 传输格式 | 请求体以 `text/plain` 发送 JSON | `text/plain` 属于 CORS 安全类型，`sendBeacon` 与 `fetch` 都不触发预检，页面卸载时也能发出 |
| 老浏览器降级 | 保留 `<img>` GET 像素上报 | 覆盖没有 `sendBeacon` 的环境；服务端提供 `GET /v1/track.gif` |
| 旧客户端兼容 | 不兼容 0.0.3 请求格式 | 用户确认当前没有线上 0.0.3 接入方 |

## 4. 仓库结构

```
fanta-monitor-report/
├─ package.json                  # private；workspaces 顺序：shared → sdk → server
├─ .eslintrc.js                  # 从现有 SDK 配置迁入，覆盖 packages/*/src
├─ packages/shared/              # @fanta/shared：事件契约唯一来源
│   └─ src/index.ts              # TRACK_TYPES、trackEventSchema、trackBatchSchema、TrackEvent、TrackBatch、TRACK_BATCH_MAX
├─ packages/sdk/                 # fanta-monitor-report 0.1.0；现有 src、rollup、tsconfig、example 平移至此
│   ├─ src/  example/  __test__/
└─ packages/server/              # @fanta/server（private）
    ├─ src/  migrations/  scripts/migrate.ts  __test__/  .env.example
```

契约用 `as const` 形式的 JSON Schema 书写，TypeScript 类型通过 `json-schema-to-ts` 的 `FromSchema` 从 schema 推导。`json-schema-to-ts` 只在类型层面工作，没有运行时代码。服务端把同一个 schema 交给 Fastify 校验请求体；SDK 只引用类型和 `TRACK_TYPES` 常量，打包产物中没有 schema 对象。

`TrackType` 从 `enum` 改为字面量元组 `TRACK_TYPES` 与联合类型。`enum` 会产生运行时对象，并且不能被 Node 原生类型擦除处理。

构建顺序：`npm run build --workspaces` 按 workspaces 声明顺序执行，`shared` 先产出 `dist/index.js` 与 `dist/index.d.ts`，随后 `sdk` 与 `server` 引用它。单元测试通过 vitest 别名把 `@fanta/shared` 指向 `packages/shared/src/index.ts`，测试不依赖构建产物。

## 5. 事件契约

一条事件包含事件体、应用与用户、会话、页面、设备五组字段，扁平结构，每条事件自带完整上下文。单条约 1.5 KB，一批最多 50 条，远低于 `sendBeacon` 64 KB 上限。

```ts
type TrackType = 'PageView' | 'Click' | 'Error' | 'Custom' | 'Performance'

interface TrackEvent {
  trackId: string                       // 客户端生成的事件 id，与 appName 联合唯一
  trackType: TrackType
  trackTime: number                     // 客户端毫秒时间戳
  trackData: Record<string, unknown>    // 事件自定义数据，直接落 JSONB

  appName: string
  appVersion?: string
  userId?: string
  uuid: string                          // 匿名设备 id，localStorage 持久化
  sessionId: string                     // 会话 id，sessionStorage，30 分钟无活动重新生成

  sdkVersion: string
  sdkEnv: string

  pageOrigin: string; pagePath: string; pageSearch: string; pageProtocol: string
  pageTitle: string; referrer: string

  userAgent: string; deviceType: string; mobileBrand: string; mobileModel: string
  os: string; osVersion: string; browser: string; browserVersion: string; browserEngine: string
  isBot: boolean; isWebview: boolean; language: string; orientation: string
  screenWidth: number; screenHeight: number; viewportWidth: number; viewportHeight: number
  networkType: string; networkEffectiveType: string
  fingerPrint: string; fingerPrintCanvas: string
  coordinates?: string                  // 仅 enableGeo=true 时存在
}

interface TrackBatch { events: TrackEvent[] }   // 1 ≤ events.length ≤ 50
```

相对 0.0.3 的字段变化：删除 `ip`（改为服务端解析）、`isReady`、`debug`、`sdkBuildTime`；新增 `sessionId`、`pageTitle`、`referrer`；`trackData` 由 JSON 字符串改为对象；`trackType` 新增 `Performance`。

自动事件的 `trackData` 约定：

- `Error`：`{ kind: 'js' | 'promise' | 'resource', message, stack, filename, lineno, colno, resourceUrl, tagName }`，`stack` 截断到 2000 字符。
- `PageView`：`{ trigger: 'init' | 'pushState' | 'replaceState' | 'popstate' | 'manual', from }`，`from` 为站内上一个 URL。
- `Performance`：`{ dns, tcp, ttfb, domReady, load, fp, fcp, lcp, cls, fid, inp, redirectCount }`，时间单位毫秒，无法采集的指标为 `null`。

## 6. SDK 设计

### 6.1 公开 API

UMD 全局变量名 `FantaReport` 不变。

```ts
initReport({
  reportHost: string             // 必填，写入端点完整地址，如 https://x/v1/track；缺失抛出 Error
  appName: string                // 必填；缺失抛出 Error
  appVersion?: string
  userId?: string
  debug?: boolean                // 默认 false
  enableGeo?: boolean            // 默认 false；为 true 时才请求地理位置授权
  autoTrack?: { pageView?: boolean; error?: boolean; performance?: boolean }   // 默认全部 true
  batchSize?: number             // 默认 10
  flushInterval?: number         // 默认 5000（毫秒）
  enableImgFallback?: boolean    // 默认 true
})
pageView(data?: Record<string, unknown>): void
click(data?: Record<string, unknown>): void
error(data?: Record<string, unknown>): void
custom(data?: Record<string, unknown>): void
setUserId(userId: string): void          // 登录后补充 userId，后续事件携带
flush(): Promise<void>                   // 立即发送队列中全部事件
```

像素端点地址由 `reportHost` 追加 `.gif` 得到，例如 `https://x/v1/track` 对应 `https://x/v1/track.gif`。

### 6.2 模块职责

`common/store.ts` 拆成配置与上下文两部分：`config` 保存解析后的初始化参数，`context` 保存事件公共上下文（设备、应用、SDK、uuid、网络、指纹、坐标）。初始化参数不再混入上报数据。删除 IP 获取与 `isReady`；地理位置受 `enableGeo` 控制。

`common/queue.ts`（新增）：事件队列。

- 内存队列与 `localStorage` 镜像同步，键 `fanta-report-queue`，上限 200 条，超出丢弃最旧事件。
- 触发发送的条件：队列长度达到 `batchSize`；距上次入队 `flushInterval` 毫秒；`pagehide`；`visibilitychange` 变为 `hidden`；调用 `flush()`。
- 初始化时读取上次页面遗留的事件并发送。
- 发送结果分三种：`sent` 清除；`drop` 丢弃并输出错误日志；`retry` 放回队列头部，每条事件最多失败 3 次，之后丢弃。

`common/transport.ts`（替换 `report.ts`）：发送一批事件，按顺序尝试。

1. `navigator.sendBeacon(reportHost, JSON 字符串)` 返回 `true` 视为 `sent`。
2. `fetch(reportHost, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' } })`：2xx 为 `sent`；4xx 为 `drop`（契约或白名单问题，重试无意义）；5xx 或网络异常进入下一步。
3. `enableImgFallback` 为 `true` 时，逐条以 `<img src="…/track.gif?d=<base64url(JSON)>">` 发送，全部 `onload` 为 `sent`，否则 `retry`；为 `false` 时直接 `retry`。

`common/session.ts`（新增）：`sessionId` 存 `sessionStorage`，记录最近活跃时间；每次上报刷新活跃时间，超过 30 分钟未活动则生成新 id。`sessionStorage` 不可用时退回内存变量。

`h5/h5BaseInfo/other.ts`：删除 `getIp` 与对 `api.ipify.org`、`api.infoip.io` 的请求；`common/request.ts` 随之删除。`h5/h5BaseInfo/location.ts` 增加 `pageTitle`、`referrer`。每次 `track` 时重新读取页面信息，保证 SPA 路由切换后路径正确。

`h5/h5Error/index.ts`（重写）：`window.addEventListener('error', …, true)` 区分 JS 错误与资源加载错误；监听 `unhandledrejection`；`message + stack` 相同的错误 60 秒内只上报一次。

`h5/h5PageVisit/index.ts`（重写）：包装 `history.pushState` 与 `history.replaceState`，监听 `popstate`；同一 URL 连续触发去重；初始化后立即上报一条 `trigger: 'init'` 的 PV。

`h5/h5Performance/index.ts`（重写）：`PerformanceNavigationTiming` 提供 dns、tcp、ttfb、domReady、load、redirectCount；`PerformanceObserver` 订阅 `paint`、`largest-contentful-paint`、`layout-shift`、`first-input`、`event`（`durationThreshold: 40`，取有 `interactionId` 的最大 `duration` 作为 inp）。首次 `visibilitychange=hidden` 或 `pagehide` 时定稿并上报一条 `Performance` 事件。环境不支持 `PerformanceObserver` 时跳过，不抛出。

`types/`：契约类型从 `@fanta/shared` 引入；`InitParams` 删除 `[Z: string]: any`；所有 `any` 替换为明确类型。

`package.json`：版本 0.1.0；产物文件名固定为 `dist/fanta-report.cjs.js`、`dist/fanta-report.es.js`、`dist/fanta-report.umd.js`；`main / module / unpkg` 指向对应产物；`files: ["dist"]`；`@fanta/shared` 作为 devDependency 在构建时打入产物。

设备与浏览器 UA 解析（`device.ts`）保持原样。

## 7. 服务端设计

### 7.1 运行方式与配置

Fastify 5、`@fastify/cors`、`pg`、`ajv`（像素端点手动校验；Fastify 已依赖 ajv，不增加安装体积）。开发用 `tsx watch`，构建用 `tsc`，运行 `node --env-file=.env dist/server.js`。

环境变量：

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | 无 | PostgreSQL 连接串 |
| `ALLOWED_APPS` | 是 | 无 | 允许写入的 `appName`，逗号分隔 |
| `PORT` | 否 | `5001` | 监听端口 |
| `CORS_ORIGIN` | 否 | `*` | 允许的来源 |
| `TRUST_PROXY` | 否 | `false` | 为 `true` 时从 `X-Forwarded-For` 取客户端 IP，部署在反向代理后需要开启 |
| `LOG_LEVEL` | 否 | `info` | pino 日志级别 |

必填项缺失时进程启动失败并输出缺失变量名。仓库提交 `.env.example`，`.env` 加入 `.gitignore`。

### 7.2 接口

`POST /v1/track`

- 请求体：`TrackBatch`，`Content-Type` 为 `text/plain` 或 `application/json`；请求体上限 256 KB。
- 校验：Fastify 用 `trackBatchSchema` 校验，未声明字段被移除。
- 白名单：任一事件的 `appName` 不在 `ALLOWED_APPS` 中，整批拒绝。
- 响应：`200 { accepted, duplicates }`；`400` 校验失败；`403 { error: 'app_not_allowed', appName }`；`413` 超出体积；`500` 写库失败。

`GET /v1/track.gif?d=<base64url>`

- `d` 为单条 `TrackEvent` 的 JSON 经 base64url 编码。
- 解析或校验失败、`appName` 不在白名单：记录 warn 日志，仍返回 `200 image/gif`。这类失败来自客户端数据本身，重试没有意义。
- 写库失败返回 `500`，使 `<img>` 触发 `onerror`，SDK 进入重试。
- 响应头 `Cache-Control: no-store`，正文为 1×1 GIF。

`GET /health`：执行 `SELECT 1`，成功返回 `200 { status: 'ok' }`，失败返回 `503 { status: 'error' }`。

客户端 IP 取 `request.ip`。日志使用 Fastify 内置 pino，不输出事件正文。收到 `SIGTERM` 或 `SIGINT` 时先关闭 HTTP 服务，再关闭连接池。

### 7.3 写入

一批事件用一条 SQL 写入，不在循环中执行查询：

```sql
INSERT INTO track_events (app_name, track_id, track_type, track_time, track_data, …, client_ip)
SELECT t."appName", t."trackId", t."trackType", to_timestamp(t."trackTime" / 1000.0), t."trackData", …,
       NULLIF($2, '')::inet
FROM jsonb_to_recordset($1::jsonb) AS t("appName" text, "trackId" text, "trackType" text, "trackTime" bigint, "trackData" jsonb, …)
ON CONFLICT (app_name, track_id) DO NOTHING
RETURNING 1
```

`accepted` 为返回行数，`duplicates` 为提交条数与 `accepted` 的差值。

## 8. 数据模型

`migrations/0001_track_events.up.sql`：

```sql
CREATE TABLE track_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_name       text NOT NULL,
  track_id       text NOT NULL,
  track_type     text NOT NULL,
  track_time     timestamptz NOT NULL,               -- 客户端时间
  received_at    timestamptz NOT NULL DEFAULT now(), -- 服务端接收时间
  track_data     jsonb NOT NULL DEFAULT '{}',
  app_version text, user_id text, uuid text, session_id text,
  sdk_version text NOT NULL, sdk_env text,
  page_origin text, page_path text, page_search text, page_protocol text, page_title text, referrer text,
  user_agent text, device_type text, mobile_brand text, mobile_model text, os text, os_version text,
  browser text, browser_version text, browser_engine text, is_bot boolean, is_webview boolean,
  language text, orientation text,
  screen_width int, screen_height int, viewport_width int, viewport_height int,
  network_type text, network_effective_type text,
  finger_print text, finger_print_canvas text, coordinates text,
  client_ip      inet,
  CONSTRAINT track_events_app_track_uniq UNIQUE (app_name, track_id)
);
CREATE INDEX track_events_app_time_idx      ON track_events (app_name, track_time DESC);
CREATE INDEX track_events_app_type_time_idx ON track_events (app_name, track_type, track_time DESC);
```

`0001_track_events.down.sql` 为 `DROP TABLE track_events;`。

`track_data` 不建 GIN 索引，避免写放大；出现明确查询需求时再按字段加表达式索引。

迁移执行器 `scripts/migrate.ts`：维护 `schema_migrations(version, applied_at)` 表；`up` 在事务内依次执行未应用的 `*.up.sql` 并记录版本；`down` 在事务内执行最近一个版本的 `*.down.sql` 并删除记录。

## 9. 测试与验收

SDK 单元测试（vitest + jsdom，`packages/sdk/__test__/`）：

- `queue`：达到 `batchSize` 立即发送；未达到时 `flushInterval` 后发送；入队后 `localStorage` 有镜像；新实例回放遗留事件；`retry` 三次后丢弃；`drop` 不重试。
- `transport`：`sendBeacon` 成功时不调用 `fetch`；`fetch` 2xx 为 `sent`；4xx 为 `drop`；`fetch` 异常后走像素并携带 `.gif?d=`；关闭像素时返回 `retry`。
- `session`：连续调用返回同一 id；超过 30 分钟返回新 id。
- `pageVisit`：初始化上报 `init`；`pushState` 上报并携带 `from`；同 URL 不重复上报。
- `error`：`ErrorEvent`、`unhandledrejection`、资源错误映射到对应 `kind`；60 秒内重复错误只上报一次。
- `performance`：没有 `PerformanceObserver` 时不抛出、不上报；有 Navigation Timing 时 dns、tcp、ttfb 计算正确并在 `hidden` 时上报。

服务端集成测试（vitest，真实 PostgreSQL，`TEST_DATABASE_URL`，`packages/server/__test__/`）：合法批量写入并记录 `client_ip`；重复 `trackId` 只写一行且 `duplicates` 正确；请求体不合法返回 400；`appName` 不在白名单返回 403；像素端点写入并返回 GIF；`/health` 返回 200。`TEST_DATABASE_URL` 缺失时测试直接失败并提示，不跳过。

端到端：启动本机 PostgreSQL，执行迁移，启动服务，`packages/sdk` 以 rollup dev 模式打开 `example/index.html`（指向 `http://localhost:5001/v1/track`），用 Playwright 加载页面、点击、`pushState`、触发 JS 错误、切换到后台，然后在数据库中查询到 `PageView`、`Click`、`Error`、`Performance` 四类记录。

验收命令：仓库根目录 `npm run build`、`npm run lint`、`npm test` 全部通过，加上端到端的数据库查询结果。

## 10. 兼容性、风险与回滚

SDK 0.0.3 到 0.1.0 属于破坏性升级：请求体从单条改为 `{ events: [] }`；`trackData` 由字符串改为对象；像素上报改为 `d=base64url`；删除 `ip`；地理位置默认关闭；`pageView` 等方法从返回 `Promise` 改为同步返回。新服务端不接受 0.0.3 客户端的请求。

已知未覆盖的风险：服务端没有限流，公网暴露时白名单只能防止误接入；Safari 对 LCP、CLS、INP 支持不完整，对应字段为 `null`；`sendBeacon` 返回 `true` 只表示浏览器已接收，服务端返回 400 或 403 时客户端无法感知。

回滚：SDK 回退 npm 版本；服务端执行 `npm run migrate -- down` 删除 `track_events` 后回退部署。迁移与回滚均在事务内执行。

## 11. 本机运行前置条件

Node 22.21，npm 10。PostgreSQL 15 已通过 Homebrew 安装，需要 `brew services start postgresql@15` 启动，并创建开发库与测试库各一个。
