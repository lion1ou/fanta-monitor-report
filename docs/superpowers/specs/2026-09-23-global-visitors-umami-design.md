# 全局总览、跨站访客、访客标记与 umami 能力迁移 设计

日期：2026-09-23

## 目标

1. `warrior-of-light`、`toy-fund(apps/funds)`、`skillctl` 本地 UI 接入 SDK，替换 umami。
2. 后台新增「全局总览」跨项目展示 PV/UV；其余页面保持单项目。同一访客跨 `*.lion1ou.tech` 站点识别为同一人。
3. 后台可给访客打标签，并可把标记访客从统计中排除。
4. 迁移 umami 能力：访客/会话视角、来源 + UTM、跳出率/访问时长、维度下钻、语言/屏幕/主机名维度。

## 非目标

漏斗、留存、目标、用户路径；实时视图；skillctl CLI 命令遥测；chuyunt.com 与 lion1ou.tech 跨主域归并；按 userId 跨 app 归并访客。

## 一、访客身份

### SDK（0.2.0）

- 访客 id 解析顺序：cookie `fanta_uid` → localStorage `fanta-report-uuid` → 新生成；解析结果同时写回 cookie 与 localStorage。
- cookie 域：配置项 `cookieDomain`；缺省取主机名末两段（`a.b.lion1ou.tech` → `.lion1ou.tech`）。主机名为 `localhost`、IP 或单段时不写 cookie。
- cookie 属性：`Path=/; Max-Age=63072000; SameSite=Lax`，`https:` 下追加 `Secure`。写 cookie 失败或被禁用时行为与现状一致（仅 localStorage）。

### 服务端

- 迁移 `0004`：`track_events` 增生成列 `visitor_key text GENERATED ALWAYS AS (COALESCE(NULLIF(uuid, ''), finger_print)) STORED`，索引 `(app_name, visitor_key)`。
- `VISITOR_EXPR` 改为 `visitor_key`（uuid 优先、指纹兜底）。历史 UV 出现一次性断层，已接受。

## 二、访客标记

- 表 `visitor_tags(visitor_key text PRIMARY KEY, label text NOT NULL, is_excluded boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now())`，跨 app 全局。
- API（均需 `Bearer ADMIN_TOKEN`）：
  - `PUT /v1/visitors/:key/tag` body `{ label, isExcluded, note? }` → upsert，返回 `VisitorTag`。
  - `DELETE /v1/visitors/:key/tag` → 204。
- 统计口径：querystring 新增 `tagged: 'exclude' | 'include'`（默认 `exclude`）。`exclude` 时所有统计 SQL 追加 `visitor_key NOT IN (SELECT visitor_key FROM visitor_tags WHERE is_excluded)`。概览 KPI 附带 `excludedVisitors`（区间内被排除的访客数）。

## 三、维度下钻

- querystring 可选过滤：`path, referrerHost, browser, os, deviceType, country, province, city, language`，每项字符串精确匹配。
- 服务端白名单映射到列/表达式：`page_path`、`referrer_host`（`substring(referrer from '^[a-z]+://([^/]+)')`）、`browser`、`os`、`device_type`、`geo_country`、`geo_province`、`geo_city`、`language`。参数化传值，不拼接。
- 过滤条件与爬虫、标记过滤一起进入 `Scope`，作用于全部单 app 统计接口；全局总览不接受维度过滤。

## 四、统计接口

### 现有接口变更

- `GET /v1/stats/overview`：KPI 增 `bounceRate`（只有 1 次 PageView 的会话 / 有 PageView 的会话）、`avgVisitDuration`（会话内 `max(track_time) - min(track_time)` 的平均，秒）、`excludedVisitors`。
- `GET /v1/stats/devices`：增 `languages`、`screens`（`screen_width || 'x' || screen_height`）。
- `GET /v1/stats/pages`：增 `hosts`（`page_origin`）。
- `GET /v1/stats/events`：每行增 `visitorKey`、`tag: VisitorTag | null`。

### 新接口

- `GET /v1/stats/global?from&to&bots&tagged` → `{ granularity, apps: [{ app, current: StatsKpi, previous: StatsKpi, series: [{ bucket, pv, uv }] }] }`，一次分组查询，按 `app_name` 输出。
- `GET /v1/stats/sources?<scope>` → `{ referrers: Distribution[], utmSource: Distribution[], utmMedium: Distribution[], utmCampaign: Distribution[] }`。referrer 按域名聚合并排除与 `page_origin` 同域的来源；空值归「直接访问」。
- `GET /v1/stats/visitors?<scope>&limit` → `{ visitors: VisitorSummary[] }`，按最近访问倒序。`VisitorSummary = { visitorKey, tag, firstSeen, lastSeen, sessions, pv, userIds: string[], geo: GeoRegion, browser, os, deviceType }`。
- `GET /v1/stats/visitors/:key?<scope>` → `{ profile: VisitorSummary & { lifetimeFirstSeen, lifetimeSessions, apps: string[] }, events: EventRow[] }`。

### UTM

- 入库时从 `pageSearch` 解析 `utm_source / utm_medium / utm_campaign`（`URLSearchParams`），写入迁移 0004 新增的三列 `utm_source, utm_medium, utm_campaign text NOT NULL DEFAULT ''`。
- 一次性回填脚本 `scripts/backfill-utm.ts`。

## 五、后台

- 路由：`#/global`（全局总览，侧栏第一项）、`#/visitors`（访客）、`#/sources`（来源）；其余保持。
- 全局总览：隐藏应用下拉；每 app 一张卡（PV/UV/会话/跳出率/时长 + 环比 + 迷你曲线），一张多折线趋势图（每 app 一条，PV/UV 切换）；点卡片切到该 app 概览。
- 访客：表格（标签、访客键缩写、首次/最近访问、会话、PV、地域、设备/浏览器、userId），点行打开详情抽屉（画像、事件时间线、标签编辑：label、排除开关、备注，保存/删除）。
- 来源：Referrer 域名、UTM source/medium/campaign 四个分布。
- 下钻：`DistributionList` 与页面表格行可点击 → `Filters` 增维度字段并同步 URL；`FilterBar` 显示可移除 chip；`tagged` 切换加入 FilterBar。
- 事件明细：增「访客」列（标签 chip + 键缩写，点开访客详情）。

## 六、站点接入

| 项目 | appName | 改动 | 发布 |
| --- | --- | --- | --- |
| warrior-of-light | `warrior-of-light` | `src/components/analytics.tsx` + `layout.tsx` 传 userId | `publish.sh --deploy` |
| toy-fund/apps/funds | `toy-fund` | `index.html` umami → SDK | `apps/funds/publish.sh` |
| skillctl | `skillctl` | 三个页面模板 `<head>` 注入；`SKILLCTL_NO_TELEMETRY=1` 关闭；README 说明 | 1.2.2 `npm publish` |

服务器 `.env` `ALLOWED_APPS` 追加三者。

## 验收

- 三站线上 HTML 只含新 SDK，真实事件落库。
- `jz.lion1ou.tech` 与 `t.lion1ou.tech` 同一浏览器访问得到同一 `visitor_key`。
- 打标「本人」并排除后，KPI 与全局总览不再计入该访客；切 `tagged=include` 恢复。
- 全局总览多项目曲线；来源/UTM、跳出率/时长、下钻、语言/屏幕/主机名均有数据。
- 服务端、SDK、后台测试全绿；lint 通过。

## 回滚

迁移 0004 有 down 脚本；SDK 由服务端托管，回退服务端即回退 SDK；站点侧仅脚本地址不变，无需回滚；skillctl 可 `npm deprecate` 或发 1.2.3。
