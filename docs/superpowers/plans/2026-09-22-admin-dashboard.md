# 埋点管理后台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 每个任务先写失败测试再实现；UI 组件代码在实现时按规格 §8 编写，本计划只固定文件、接口与验收。

**Goal:** 新增 `/v1/stats/*` 查询 API、服务端爬虫判定与 `packages/admin` 管理后台，覆盖概览 / 页面 / 访客设备 / 性能 / 错误 / 事件明细六个板块，并在 demo 页面完成端到端验证。

**Architecture:** shared 扩展契约与统计类型；sdk 指纹同步 + webdriver 信号；server 接收时写 `bot_verdict`，stats 模块按公共 scope 参数化聚合 `track_events`，`ADMIN_TOKEN` 鉴权，`@fastify/static` 托管 admin 产物；admin 为 Vite + React 单页，hash 路由 + 全局筛选状态 + Recharts。

**Tech Stack:** 现有 monorepo（TS 5.9、vitest 5、Fastify 5、pg 8）+ `isbot`、`@fastify/static`、`react 18`、`react-dom 18`、`recharts 2`、`vite 6`、`@vitejs/plugin-react`、`@testing-library/react`、`@testing-library/jest-dom`。

**Spec:** `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md`

## Global Constraints

- 不提交 git（用户自行提交）。
- SQL 参数化；`bots` 与粒度以白名单映射到固定 SQL 片段。
- 不放宽 `.eslintrc.js` 规则；admin 目录纳入根 lint。
- 服务端集成测试用 `TEST_DATABASE_URL`；测试前 `TRUNCATE track_events`。

---

### Task 1: 契约扩展与 SDK 信号

**Files:**
- Modify: `packages/shared/src/index.ts`（`isWebdriver` 可选字段；`BOT_VERDICTS`、`BotVerdict`、`BOTS_MODES`、`BotsMode`、`Granularity`、统计响应类型）
- Modify: `packages/sdk/src/types/index.ts`（`IBrowser` 加 `isWebdriver`；`DeviceInfo` Pick 加 `isWebdriver`）
- Modify: `packages/sdk/src/h5/h5BaseInfo/device.ts`（`getBrower` 计算 `isWebdriver`，`isBot = 命中 || isWebdriver`）
- Modify: `packages/sdk/src/h5/h5BaseInfo/index.ts`（`getFingerPrint` 同步）
- Modify: `packages/sdk/src/common/store.ts`（`EMPTY_CONTEXT` 加 `isWebdriver:false`；init 时同步写指纹）
- Modify: `packages/sdk/__test__/setup.ts`（canvas 桩返回可用 2D 上下文与 `toDataURL`）
- Create: `packages/sdk/__test__/bot.test.ts`
- Modify: `packages/sdk/__test__/main.test.ts`（断言首条事件 `fingerPrint` 非空）

- [ ] **Step 1: 写失败测试** — `bot.test.ts`：`navigator.webdriver=true` 时 `getBaseInfo()` 返回 `isWebdriver:true, isBot:true`；`false` 时两者为 false（UA 为 jsdom 默认）。`main.test.ts` 加断言 `pv.fingerPrint` 长度 32、`pv.isWebdriver === false`。
- [ ] **Step 2: 运行确认失败**：`npm test -w packages/sdk -- bot main`
- [ ] **Step 3: 实现** shared 字段、sdk 变更、setup 桩（`getContext` 返回带 `rect/fillRect/fillText/beginPath/arc/closePath/fill` 的空函数对象，`toDataURL` 返回固定字符串）。
- [ ] **Step 4: 运行通过**：`npm test -w packages/sdk` 全绿；`npm run build -w packages/shared`。

---

### Task 2: 服务端爬虫判定与迁移

**Files:**
- Create: `packages/server/migrations/0002_bot_verdict.up.sql` / `.down.sql`（规格 §4.2）
- Create: `packages/server/src/bot.ts`（`classifyBot(event): BotVerdict`）
- Modify: `packages/server/src/db.ts`（INSERT 增 `bot_verdict`、`is_webdriver`；`insertTrackEvents` 先 `classifyBot` 再写入）
- Create: `packages/server/scripts/backfill-bots.ts`
- Create: `packages/server/__test__/bot.test.ts`
- Modify: `packages/server/__test__/track.test.ts`（写入后核对 `bot_verdict`）

- [ ] **Step 1: 失败测试** — `bot.test.ts`：webdriver 优先于 ua；Googlebot UA → `ua`；仅 `isBot:true` 且普通 UA → `sdk`；普通 → `none`。`track.test.ts` 新增用例：一批含 Googlebot UA 事件与 `isWebdriver:true` 事件，查询 `bot_verdict` 分别为 `ua`、`webdriver`。
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 安装** `npm i -w packages/server isbot @fastify/static`；写迁移、`bot.ts`、`db.ts`、`backfill-bots.ts`。
- [ ] **Step 4: 通过**：`TEST_DATABASE_URL=... npm test -w packages/server`；`npm run migrate -- up` 输出 `已应用: 0002_bot_verdict`。

---

### Task 3: stats scope 与 overview / pages

**Files:**
- Modify: `packages/server/src/config.ts`（`adminToken?: string`）
- Create: `packages/server/src/stats/scope.ts`（`statsQuerySchema`、`resolveScope(query): Scope`，`Scope = { app, from: Date, to: Date, botsWhere: string, granularity, bucketExpr }`；`VISITOR_EXPR = "COALESCE(NULLIF(finger_print,''), uuid)"`）
- Create: `packages/server/src/stats/overview.ts`、`pages.ts`
- Create: `packages/server/src/routes/stats.ts`（鉴权 preHandler：无/错 token → 401；`app` 不在白名单 → 403；注册 `/apps` `/overview` `/pages`）
- Modify: `packages/server/src/app.ts`（`config.adminToken` 存在时注册）
- Create: `packages/server/__test__/seed.ts`（种子数据：规格 §10 的访客/页面/设备/性能/错误组合，固定时间基准 `T0 = 2026-09-20T00:00:00Z`）
- Create: `packages/server/__test__/stats.test.ts`

- [ ] **Step 1: 失败测试** — 401（无 token / 错 token）、403（app 不在白名单）、400（缺 from）、`/apps`、`/overview` 的 KPI 与 series（默认 exclude 排除 2 个爬虫访客；`bots=include` 数字变化；`previous` 为 0）、`/pages` 的 paths/entries/referrers。
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 实现**（overview 核心 SQL：一条 CTE `scoped AS (SELECT * FROM track_events WHERE app_name=$1 AND track_time >= $2 AND track_time < $3 AND <botsWhere>)`，KPI 用 `count(*) FILTER`，series 用 `date_trunc($granularity)` + `generate_series` 补零桶）。
- [ ] **Step 4: 通过**

---

### Task 4: devices / performance / errors / events

**Files:**
- Create: `packages/server/src/stats/devices.ts`、`performance.ts`、`errors.ts`、`events.ts`
- Modify: `packages/server/src/routes/stats.ts`（注册其余 5 个路由）
- Modify: `packages/server/__test__/stats.test.ts`

- [ ] **Step 1: 失败测试** — devices 六组分布与 bots 面板（realUv=1、botUv=2 等按种子）；performance p75 与评级计数、pages 表；errors groups 与 occurrences；events total/分页/过滤。
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 实现**（performance：`percentile_cont(ARRAY[0.5,0.75,0.95]) WITHIN GROUP (ORDER BY (track_data->>$metric)::numeric)`，metric 名来自白名单常量数组，逐个 metric 查询或一条 SQL 多列；评级计数用 `count(*) FILTER (WHERE v <= good)` 等）。
- [ ] **Step 4: 通过**

---

### Task 5: admin 骨架、视觉系统、登录门、筛选条

**Files:**
- Create: `packages/admin/package.json`、`tsconfig.json`、`vite.config.ts`（`/v1` 代理到 5001，`base: '/admin/'`，`build.outDir: 'dist'`）、`vitest.config.ts`（jsdom + setup 引入 jest-dom）、`index.html`
- Create: `src/main.tsx`、`src/App.tsx`、`src/styles.css`、`src/api/client.ts`、`src/lib/time.ts`、`src/lib/format.ts`、`src/lib/vitals.ts`、`src/state/filters.ts`（URL query ↔ 状态）、`src/components/{Layout,Sidebar,FilterBar,KpiCard,DataTable,DistributionList,TrendChart,Empty,Skeleton}.tsx`、`src/pages/Login.tsx`
- Create: `__test__/time.test.ts`、`format.test.ts`、`vitals.test.ts`、`login.test.tsx`
- Modify: root `package.json`（workspaces 加 `packages/admin`；`dev:admin`；`lint` 覆盖 `packages/admin/src`）、`.eslintrc.js`（admin tsconfig 加入 project；`.tsx` 扩展）

- [ ] **Step 1: 失败测试** — `time.test.ts`：预设 `7d` 的 from/to 与粒度 `day`，`24h` 为 `hour`，自定义 3 天为 `day`；`format.test.ts`：`formatNumber(12345)='12,345'`、`formatPercent(0.1234)='12.3%'`、`formatDelta(120,100)='+20.0%'`、`formatMs(2500)='2.50 s'`、`formatMs(320)='320 ms'`；`vitals.test.ts`：`rate('lcp',2400)='good'`、`rate('cls',0.3)='poor'`；`login.test.tsx`：无 token 渲染登录门，输入并提交后 `localStorage` 有值并显示布局。
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 安装** `npm i -w packages/admin react react-dom recharts`；`npm i -D -w packages/admin vite @vitejs/plugin-react @types/react @types/react-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event`。实现骨架与样式（规格 §8.3 tokens），页面先放六个空板块。
- [ ] **Step 4: 通过**：`npm test -w packages/admin`；`npm run build -w packages/admin` 产出 `dist/index.html`。

---

### Task 6: 概览与页面板块

**Files:**
- Create: `src/hooks/useStats.ts`（`useStats<T>(path, params) → { data, error, loading, reload }`，401 时触发登出回调）
- Create: `src/pages/Overview.tsx`、`src/pages/Pages.tsx`
- Create: `__test__/overview.test.tsx`（mock fetch 返回固定 overview，断言 6 张 KPI 数字与环比、空数据时空态）

- [ ] **Step 1: 失败测试** → **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 通过**

---

### Task 7: 访客设备与性能板块

**Files:**
- Create: `src/pages/Devices.tsx`、`src/pages/Performance.tsx`
- Create: `__test__/performance.test.tsx`（mock 数据断言 p75 着色 class 与评级条比例）

- [ ] **Step 1–4** 同上。

---

### Task 8: 错误与事件明细板块

**Files:**
- Create: `src/pages/Errors.tsx`（行展开加载 occurrences）、`src/pages/Events.tsx`（过滤、分页、行展开 JSON）
- Create: `__test__/events.test.tsx`（分页按钮改变 offset 并重新请求）

- [ ] **Step 1–4** 同上。

---

### Task 9: server 托管 admin、README、全仓验证

**Files:**
- Create: `packages/server/src/routes/admin.ts`（`@fastify/static` root 为 `../../admin/dist`，`prefix: '/admin/'`，`setNotFoundHandler` 对 `/admin/*` 回 `index.html`；目录不存在时 warn 并跳过）
- Modify: `packages/server/src/app.ts`、`.env.example`（`ADMIN_TOKEN=`）
- Modify: `README.md`（后台章节）
- Modify: `packages/server/__test__/stats.test.ts`（`adminToken` 缺省时 `/v1/stats/overview` 404）

- [ ] **Step 1: 失败测试**（404 用例）→ **Step 2** → **Step 3: 实现** → **Step 4**：`npm run build && npm run lint && TEST_DATABASE_URL=... npm test` 全绿。

---

### Task 10: demo 端到端验证

- [ ] **Step 1**：`packages/server/.env` 加 `ADMIN_TOKEN=fanta-admin-demo`，`npm run migrate -- up`，`TRUNCATE track_events`。
- [ ] **Step 2**：后台启动 `dev:server`、`dev:sdk`、`dev:admin`。
- [ ] **Step 3**：demo 页面点击 Click / 路由 / 错误 / Custom，`flush`，`pagehide` 后再 `flush`。
- [ ] **Step 4**：`curl` 以 `Googlebot/2.1` UA 直投 2 条 PageView（`appName: fantaTestPage`，不同 uuid）；再直投 1 条 `isWebdriver:true` 的 PageView。
- [ ] **Step 5**：浏览器打开 `http://localhost:5173/admin/`，输入 token，逐板块截图；核对：概览 PV=2、UV=1（排除爬虫）；`bots=include` PV=5、UV=4；访客页爬虫面板 botUv=3、verdicts `ua:2 webdriver:1`；性能页 LCP 样本 1；错误页 1 组 `example error`；事件页 total 与 `psql count(*)` 一致。
- [ ] **Step 6**：`npm run build` 后 `npm start -w packages/server`，访问 `http://localhost:5001/admin/` 确认托管产物可用。
- [ ] **Step 7**：停止后台进程，清理 `/tmp` 临时文件。
