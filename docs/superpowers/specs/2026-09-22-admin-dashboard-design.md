# 埋点管理后台设计

## 1. 背景与目标

采集服务已把事件写入 `track_events`，但没有查看与分析入口。本方案新增只读查询 API 与管理后台页面，覆盖基础访问数据（PV/UV/会话/页面/来源）、访客设备画像、爬虫识别、前端性能 APM 与错误分析，并提供原始事件检索。

成功标准：在 demo 页面产生流量后，后台六个板块的数字与 `psql` 直接聚合结果一致；爬虫流量可被识别并默认排除；全部接口与页面有自动化测试。

## 2. 范围与非目标

范围：
- `packages/shared` 契约扩展与统计响应类型
- `packages/sdk` 指纹同步取值、无头浏览器信号上报
- `packages/server` 服务端爬虫判定、`/v1/stats/*` 查询 API、`ADMIN_TOKEN` 鉴权、托管后台静态产物
- `packages/admin` Vite + React 管理后台

非目标：预聚合表、多租户权限、告警通知、数据导出、SDK 之外的采集源。

## 3. 已确定的决策

| 决策 | 选择 | 依据 |
|---|---|---|
| 后台承载 | 独立 `packages/admin`（Vite + React 18 + TS），构建产物由 server 托管在 `/admin` | 用户选择；便于长期演进 |
| 鉴权 | 环境变量 `ADMIN_TOKEN`，API 校验 Bearer；未配置时不注册后台与 stats 路由 | 用户选择；零额外依赖 |
| 爬虫识别 | 服务端 `isbot` 重算 UA + SDK 上报 `navigator.webdriver`，写入 `bot_verdict` | 用户选择；SDK 列表可被伪造且陈旧 |
| UV 口径 | `COALESCE(NULLIF(finger_print,''), uuid)` | 用户选择指纹；空指纹兜底 |
| 爬虫默认处理 | 默认排除，顶部开关 `exclude / include / only` | 用户选择 |
| 时间范围 | 今天 / 24h / 7d / 30d / 自定义；≤ 48h 按小时，否则按天；默认 7d | 用户选择 |
| 查询策略 | 直接聚合 `track_events`，补索引 | 当前量级足够；千万行以上再引入小时聚合表 |
| 图表库 | Recharts | React 原生、声明式、体积可接受 |
| 视觉 | 浅色高密度数据工作台 | 用户选择 |
| 原型 | 不做独立原型，直接在 `packages/admin` 实现 | 用户选择 |

## 4. 契约与数据模型变更

### 4.1 `TrackEvent` 新增可选字段

```ts
isWebdriver: { type: 'boolean' }   // 可选，SDK 上报 navigator.webdriver === true
```

旧 SDK 不发该字段，服务端按 `false` 处理。

### 4.2 迁移 `0002_bot_verdict`

```sql
ALTER TABLE track_events ADD COLUMN bot_verdict text NOT NULL DEFAULT 'none';
ALTER TABLE track_events ADD COLUMN is_webdriver boolean NOT NULL DEFAULT false;
UPDATE track_events SET bot_verdict = 'sdk' WHERE is_bot;
CREATE INDEX track_events_app_bot_time_idx ON track_events (app_name, bot_verdict, track_time DESC);
CREATE INDEX track_events_app_session_idx ON track_events (app_name, session_id);
```

down：删除两个索引与两列。

### 4.3 爬虫判定 `classifyBot(event): BotVerdict`

优先级：`webdriver`（`event.isWebdriver === true`）> `ua`（`isbot(event.userAgent)`）> `sdk`（`event.isBot === true`）> `none`。写入时计算，随批量 INSERT 一起落库。

`scripts/backfill-bots.ts`：对 `bot_verdict = 'none'` 且 `is_webdriver = false` 的行，按 `DISTINCT user_agent` 重算 `isbot`，命中的批量更新为 `ua`。

## 5. 统计口径

| 指标 | 定义 |
|---|---|
| PV | `track_type = 'PageView'` 事件数 |
| UV | `COUNT(DISTINCT COALESCE(NULLIF(finger_print,''), uuid))`，仅统计 PageView |
| 会话 | `COUNT(DISTINCT session_id)` |
| 登录用户 | `COUNT(DISTINCT user_id) FILTER (WHERE user_id <> '')` |
| 错误数 | `track_type = 'Error'` 事件数 |
| 错误率 | 错误数 / PV，PV 为 0 时为 0 |
| 爬虫占比 | 爬虫 PV / 全部 PV（不受 `bots` 参数影响） |
| 时间桶 | `date_trunc('hour' \| 'day', track_time)`；服务端按 `to - from` 决定粒度并回传 |
| 上一周期 | `[from - (to - from), from)`，KPI 附 `previous` 值 |
| 性能分位 | `percentile_cont(0.5 / 0.75 / 0.95)` 作用于 `(track_data ->> metric)::numeric`，忽略缺失 |
| 性能评级 | LCP 2500/4000ms、FCP 1800/3000ms、INP 200/500ms、FID 100/300ms、CLS 0.1/0.25、TTFB 800/1800ms；Load/DOMReady 不评级 |
| 错误分组 | `(track_data ->> 'kind', track_data ->> 'message')`，message 截断到 200 字符后分组 |
| 入口页 | 每个 `session_id` 按 `track_time` 最早的 PageView 的 `page_path` |
| 来源 | `substring(referrer from '^[a-z]+://([^/]+)')`，空 referrer 记为 `(direct)` |

`bots` 参数映射：`exclude → bot_verdict = 'none'`，`only → bot_verdict <> 'none'`，`include → 不过滤`。

## 6. 查询 API

全部 `GET`，前缀 `/v1/stats`，需 `Authorization: Bearer <ADMIN_TOKEN>`。公共 querystring：

```
app    string  必填，须在 ALLOWED_APPS 内，否则 403
from   integer 毫秒时间戳，必填
to     integer 毫秒时间戳，必填，须 > from，且 to - from ≤ 366 天
bots   'exclude' | 'include' | 'only'，默认 exclude
```

| 路径 | 额外参数 | 响应 |
|---|---|---|
| `/apps` | 无（不需要 from/to） | `{ apps: string[] }`，`ALLOWED_APPS` 中有数据的 app |
| `/overview` | | `{ granularity, current: Kpi, previous: Kpi, series: Array<{ bucket, pv, uv, errors }> }`，`Kpi = { pv, uv, sessions, users, errors, errorRate, botPv, totalPv }` |
| `/pages` | `limit ≤ 50`，默认 20 | `{ paths: Array<{ path, pv, uv }>, entries: Array<{ path, sessions }>, referrers: Array<{ host, sessions }> }` |
| `/devices` | | `{ deviceType, os, browser, screen, network, language: Array<{ name, uv, pv }>, bots: { realUv, realPv, botUv, botPv, verdicts: Array<{ verdict, pv }>, agents: Array<{ name, pv }> } }`，`screen` 为 `宽x高`，`bots` 不受 `bots` 参数影响 |
| `/performance` | | `{ granularity, metrics: Record<Metric, { p50, p75, p95, samples, good, needsImprovement, poor }>, series: Array<{ bucket, lcp, fcp, inp }>（p75）, pages: Array<{ path, samples, lcp, fcp, inp }>（p75，前 20） }`，`Metric = lcp fcp cls inp fid ttfb load domReady` |
| `/errors` | `limit ≤ 100`，默认 50 | `{ granularity, total, affectedUsers, errorRate, series: Array<{ bucket, errors }>, groups: Array<{ kind, message, count, users, firstSeen, lastSeen, lastPath }> }` |
| `/errors/occurrences` | `kind`、`message` 必填，`limit ≤ 50` 默认 20 | `{ items: Array<{ trackId, trackTime, path, browser, browserVersion, os, osVersion, userId, visitor, trackData }> }` |
| `/events` | `type?`、`q?`（匹配 uuid / user_id / session_id / finger_print 精确）、`path?`（前缀）、`limit ≤ 100` 默认 50、`offset ≤ 10000` | `{ total, items: Array<{ id, trackId, trackTime, trackType, path, userId, visitor, sessionId, deviceType, browser, os, botVerdict, trackData }> }` |

校验失败 400；token 缺失或错误 401；`app` 不在白名单 403。

## 7. 服务端结构

```
packages/server/src/
  config.ts            新增 adminToken?: string
  bot.ts               classifyBot、BotVerdict
  db.ts                INSERT 增加 bot_verdict、is_webdriver 列
  stats/
    scope.ts           解析公共参数 → { app, from, to, botsClause, granularity }
    overview.ts pages.ts devices.ts performance.ts errors.ts events.ts
  routes/stats.ts      注册 8 个路由 + preHandler 鉴权
  routes/admin.ts      @fastify/static 托管 ../../admin/dist，prefix /admin，SPA 回退 index.html
  app.ts               adminToken 存在时注册 stats 与 admin
scripts/backfill-bots.ts
migrations/0002_bot_verdict.{up,down}.sql
```

SQL 全部参数化；`bots` 与粒度以白名单映射到固定 SQL 片段，不拼接用户输入。

## 8. 后台页面

### 8.1 结构

- 左侧导航：概览、页面、访客与设备、性能、错误、事件明细；hash 路由 `#/overview` 等。
- 顶部全局筛选条：应用下拉、时间预设（今天 / 24h / 7d / 30d）+ 自定义起止、爬虫开关（排除 / 包含 / 仅爬虫）、刷新。筛选状态同步到 URL query，刷新页面不丢失。
- 登录门：`localStorage.fantaAdminToken` 为空或任一请求 401 时显示 token 输入页。

### 8.2 板块

1. **概览**：6 张 KPI 卡（PV、UV、会话、登录用户、错误率、爬虫占比）带环比；PV/UV 双线折线图；错误柱状图；Top 5 路径与设备类型小表。
2. **页面**：路径表（PV、UV、占比条），入口页表，来源域名表。
3. **访客与设备**：设备类型、OS、浏览器、分辨率、网络、语言六组横向条形分布（按 UV 排序，显示 UV 与 PV）；爬虫面板：真实 vs 爬虫 UV/PV、判定来源构成、Top 爬虫 UA。
4. **性能**：8 张指标卡（p75 大字按评级着色，p50/p95 小字，good/ni/poor 分段条，样本数）；p75 趋势折线（LCP/FCP/INP）；按页面 p75 表。
5. **错误**：3 张 KPI（错误数、影响用户、错误率）；趋势柱状；分组表（kind 标签、message、次数、用户数、最近时间、最近页面）；点击行展开最近明细（stack 等宽字体、页面、浏览器/OS、用户）。
6. **事件明细**：过滤条（类型、关键词、路径前缀）+ 表格（时间、类型、路径、访客、设备/浏览器/OS、爬虫标记）；行展开 `trackData` JSON；分页。

### 8.3 视觉系统

- 字体：`-apple-system, "SF Pro Text", "PingFang SC", "Noto Sans SC", sans-serif`；数字 `font-variant-numeric: tabular-nums`；等宽 `ui-monospace, "SF Mono", Menlo, monospace`。
- 色彩（oklch）：底 `--bg: oklch(98.5% 0 0)`，卡片白，边框 `oklch(91% 0 0)`，正文 `oklch(22% 0 0)`，次要 `oklch(50% 0 0)`；强调 `--accent: oklch(55% 0.16 250)`；语义 good `oklch(60% 0.15 150)`、ni `oklch(72% 0.15 75)`、poor `oklch(58% 0.19 25)`；图表用强调色、`oklch(70% 0.08 250)`、`oklch(60% 0.12 25)` 三色。
- 布局：8px 网格；侧栏 208px；内容区 `max-width: 1440px`；卡片 1px 边框、4px 圆角、无阴影无渐变；表格行高 36px。
- 空态：区间无数据时显示「所选区间内没有数据」及当前筛选摘要；加载态用骨架条；错误态显示接口返回的 message 与重试按钮。

### 8.4 前端结构

```
packages/admin/src/
  main.tsx  App.tsx（路由 + 全局筛选状态 + 登录门）
  api/client.ts        fetch 封装：拼 query、带 Bearer、401 抛 UnauthorizedError
  lib/time.ts          预设 → { from, to }，粒度计算，桶标签格式化
  lib/format.ts        数字、百分比、时长、环比
  lib/vitals.ts        阈值与评级
  components/          Layout Sidebar FilterBar KpiCard DistributionList DataTable TrendChart Empty Skeleton
  pages/               Overview Pages Devices Performance Errors Events Login
  styles.css           tokens + 组件样式
```

数据获取：`useStats(path, params)` 基于 `fetch` 与 `useEffect`，筛选变化即重新请求；不引入状态库。

## 9. SDK 变更

- `getFingerPrint` 改为同步，`Store.init` 时直接写入上下文，首条事件带指纹。
- `getBrower` 增加 `isWebdriver = navigator.webdriver === true`；`isBot = UA 命中 || isWebdriver`；上下文与事件新增 `isWebdriver`。

## 10. 测试与验收

- shared：schema 接受/拒绝 `isWebdriver`。
- sdk：首条事件 `fingerPrint` 非空（在 setup 里给 canvas `getContext` 返回可用桩）；`navigator.webdriver = true` 时 `isBot` 与 `isWebdriver` 为 true。
- server：`classifyBot` 优先级单测；stats 集成测试基于种子数据（3 个访客含 1 个 UA 爬虫、1 个 webdriver 爬虫，2 个页面，2 类设备，4 条性能样本，2 组错误）逐接口核对数字；鉴权 401；`app` 不在白名单 403；events 分页 total 与 items。
- admin：`lib/*` 纯函数单测；`Login` 与 `Overview` 组件测试（mock fetch，断言 KPI 渲染与 401 回退）。
- 端到端：启动 server（配置 `ADMIN_TOKEN`）与 admin dev；demo 页面点击产生真实流量；`curl` 以 Googlebot UA 直投 `/v1/track`；浏览器 CDP `Emulation.setUserAgentOverride` 不能改 `navigator.webdriver`，webdriver 路径用 curl 直投 `isWebdriver: true` 事件覆盖服务端判定，SDK 侧由单测覆盖；打开 `/admin` 核对六板块与 `psql` 一致，切换爬虫开关核对数字变化。

## 11. 风险与回滚

- 指纹碰撞导致 UV 偏低、canvas 加噪导致 UV 偏高：界面标注口径；可改 `uuid` 口径，只需改 `scope.ts` 中的访客表达式。
- `percentile_cont` 与 JSON 取值在大表上慢：性能事件占比低，短期可接受；后续拆 `performance_samples` 表。
- `offset` 分页深翻页慢：上限 10000。
- 回滚：`migrate down` 删除新列与索引；不配置 `ADMIN_TOKEN` 即关闭后台与 stats 路由，采集链路不受影响。

## 12. 本机运行

```
ADMIN_TOKEN=<随机串>  加入 packages/server/.env
npm run migrate -- up
npm run dev:server        # 5001
npm run dev:admin         # 5173，代理 /v1 到 5001
npm run build && npm start -w packages/server  # 生产：/admin 由 server 托管
```
