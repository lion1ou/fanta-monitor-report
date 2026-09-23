# 全局总览、跨站访客、访客标记与 umami 能力迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后台可跨项目看 PV/UV、按访客打标签并排除、看来源/UTM/跳出率/时长并下钻；三个新项目接入 SDK；同一浏览器跨 *.lion1ou.tech 站点是同一访客。

**Architecture:** 服务端加一次迁移（visitor_key 生成列、UTM 列、visitor_tags 表），`Scope` 统一承载爬虫/标记/维度过滤；新增 global/sources/visitors 三组查询与标签写接口；SDK 用注册域 cookie 共享 uuid；后台新增三页并给分布列表加下钻。

**Tech Stack:** Fastify 5 + pg、Vitest（真实 PG：`TEST_DATABASE_URL=postgres://localhost:5432/fanta_monitor_test`）、Rollup SDK、Vite + React 18 + recharts。

**Spec:** `docs/superpowers/specs/2026-09-23-global-visitors-umami-design.md`

## Global Constraints

- 所有 SQL 维度过滤走白名单映射 + 参数化，禁止拼接用户输入。
- 秘钥只在服务器 `.env`；测试用 `stubGeoResolver`。
- 测试放各包 `__test__/`；服务端测试依赖 `TEST_DATABASE_URL`。
- 提交遵循 Conventional Commits，中文描述。

---

## Task 1：迁移 0004 + 访客键口径

- [ ] `packages/server/migrations/0004_visitors.up.sql` / `.down.sql`：visitor_key 生成列 + 索引；`utm_source/utm_medium/utm_campaign`；`visitor_tags` 表。
- [ ] `shared`：`VisitorTag`、`TaggedMode`、`DimensionFilters` 类型；`StatsKpi` 增 `bounceRate/avgVisitDuration/excludedVisitors`。
- [ ] `scope.ts`：`VISITOR_EXPR = 'visitor_key'`；`statsQuerySchema` 增 `tagged` 与维度字段；`Scope.filterCondition` 合并爬虫 + 标记 + 维度条件，`scopeParams` 返回追加的维度参数。
- [ ] 测试：seed 中用 uuid 区分访客；`stats.test.ts` 断言 UV 按 uuid 计；维度过滤 & 非白名单字段 400。

## Task 2：入库 UTM + 概览 KPI 扩展

- [ ] `db.ts` 解析 `pageSearch` 的 utm 三项写入；`track.test.ts` 断言。
- [ ] `overview.ts`：KPI 增跳出率、时长、excludedVisitors；测试用 seed 中的单 PV 会话/多事件会话断言。
- [ ] `scripts/backfill-utm.ts` + `package.json` `backfill:utm`。

## Task 3：访客标签接口 + 事件明细标签

- [ ] `routes/visitors.ts`：`PUT/DELETE /v1/visitors/:key/tag`（复用 admin token 校验）。
- [ ] `events.ts` 增 `visitorKey`、`tag`（LEFT JOIN）。
- [ ] 测试：upsert/删除/404；打标排除后 overview UV 减少；`tagged=include` 恢复。

## Task 4：global / sources / visitors 查询

- [ ] `stats/global.ts`：按 app 分组 KPI + 序列；`routes/stats.ts` 注册 `/v1/stats/global`（schema 无 app）。
- [ ] `stats/sources.ts`：referrer 域名（排除自身）、UTM 三分布。
- [ ] `stats/visitors.ts`：列表 + 详情（画像 + 事件）。
- [ ] `devices.ts` 增 languages/screens；`pages.ts` 增 hosts。
- [ ] 测试覆盖每个接口的结构与关键数值。

## Task 5：SDK cookie 访客 id

- [ ] `common/visitorId.ts`：cookie/localStorage 解析与写回；`store.ts` 使用；`cookieDomain` 配置。
- [ ] `__test__/visitorId.test.ts`（jsdom：cookie 优先、域推导、localhost 不写 cookie、失败回退）。
- [ ] SDK 版本 0.2.0。

## Task 6：后台

- [ ] `state/filters.ts` 增 `tagged` 与维度字段、URL 序列化；`FilterBar` 增标记切换与维度 chip。
- [ ] `DistributionList`/页面表格行支持点击下钻。
- [ ] `pages/Global.tsx`、`pages/Visitors.tsx`（含详情抽屉与标签编辑）、`pages/Sources.tsx`；`Sidebar` 与 `App.tsx` 路由；全局页隐藏应用下拉。
- [ ] `Overview.tsx` 新 KPI；`Devices.tsx` 新维度；`Pages.tsx` 主机名；`Events.tsx` 访客列。
- [ ] RTL 测试：全局页渲染多 app、访客页标签编辑调用 PUT、下钻点击写入 filters。

## Task 7：发布与接入

- [ ] 全量门禁（lint / build / 三包测试）。
- [ ] `npm run deploy`；`backfill:utm`；服务器 `ALLOWED_APPS` 追加 `warrior-of-light,toy-fund,skillctl`。
- [ ] warrior-of-light：`analytics.tsx` + layout；`publish.sh --deploy`。
- [ ] toy-fund funds：`index.html`；`apps/funds/publish.sh`。
- [ ] skillctl：三个模板注入、`SKILLCTL_NO_TELEMETRY`、README、1.2.2、`npm publish`。
- [ ] 生产验证：三站真实事件；跨站同 visitor_key；打标排除生效；全局总览曲线。
