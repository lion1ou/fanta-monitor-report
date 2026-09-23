# fanta-monitor

浏览器埋点 SDK（`fanta-monitor-report`）与配套采集服务（`@fanta/server`），事件写入 PostgreSQL。

## 目录

- `packages/shared`：事件契约（JSON Schema 与推导类型）
- `packages/sdk`：浏览器 SDK，产物 `dist/fanta-report.{cjs,es,umd}.js`
- `packages/server`：Fastify 采集服务、统计查询接口与数据库迁移
- `packages/admin`：管理后台（Vite + React），构建产物由服务端托管在 `/admin/`

## 开发

```bash
npm install
npm run build          # shared → sdk → server → admin
npm run lint
npm test               # 服务端集成测试需要 TEST_DATABASE_URL
```

`npm run lint` 带 `--fix`；`@typescript-eslint/prefer-optional-chain` 的自动修复在本仓库版本下会把 `x === null || x === undefined` 改写成 `x === undefined`，遇到需要同时判空的地方写 `x == null`。

## 服务端

```bash
cp packages/server/.env.example packages/server/.env   # 填写 DATABASE_URL 与 ALLOWED_APPS
npm run migrate -- up                                   # 回滚：npm run migrate -- down
npm run dev:server                                      # 或构建后 npm start -w packages/server
```

环境变量：`DATABASE_URL`、`ALLOWED_APPS`（必填）；`PORT=5001`、`CORS_ORIGIN=*`、`TRUST_PROXY=false`、`LOG_LEVEL=info`；后台相关见下节。

接口：`POST /v1/track` 接收 `{ events: TrackEvent[] }`（1–50 条，`text/plain` 或 `application/json`）；`GET /v1/track.gif?d=<base64url(event)>` 像素上报；`GET /health`。

爬虫判定：写入时计算 `bot_verdict`，优先级 `webdriver`（SDK 上报 `navigator.webdriver`）> `ua`（服务端 [isbot](https://github.com/omrilotan/isbot) 命中）> `sdk`（SDK 自带 UA 列表）> `none`。历史数据用 `npm run backfill:bots -w packages/server` 重算。

IP 地域：写入时按客户端 IP（`TRUST_PROXY=true` 时取 `X-Forwarded-For`）用 [ip2region](https://github.com/lionsoul2014/ip2region) 离线库解析 `geo_country / geo_province / geo_city`；私有与保留地址记为「内网」，未命中留空。数据文件不进仓库，首次部署与定期更新执行 `npm run geo:download -w packages/server`（下载到 `GEO_XDB_DIR`，默认 `packages/server/data/geo`，约 48MB）；未下载时服务正常采集但地域为空，启动日志有提示。历史数据用 `npm run backfill:geo -w packages/server` 回填。

## 管理后台

```bash
# packages/server/.env
ADMIN_TOKEN=<随机串>            # 不配置则 /admin 与 /v1/stats/* 不注册
STATS_TIMEZONE=Asia/Shanghai   # 分桶时区，默认 UTC

npm run dev:admin              # 开发：http://localhost:5173/admin/，/v1 代理到 5001
npm run build && npm start -w packages/server   # 生产：http://localhost:5001/admin/
```

板块：概览（PV / UV / 会话 / 登录用户 / 错误率 / 爬虫占比 + 趋势）、页面（路径排名、入口页、来源）、访客与设备（国家 / 省份 / 城市地域分布，设备 / OS / 浏览器 / 分辨率 / 网络 / 语言分布，真实访客 vs 爬虫）、性能（LCP / FCP / CLS / INP / FID / TTFB / Load / DOM Ready 的 p50 / p75 / p95 与 Web Vitals 评级）、错误（分组、趋势、明细）、事件明细（过滤、分页、地域、原始 `trackData`）。

口径：PV 为 PageView 事件数；UV 按 `COALESCE(NULLIF(finger_print,''), uuid)` 去重；时间范围 ≤ 48 小时按小时分桶，否则按天；默认排除爬虫，顶部可切换「包含 / 仅爬虫」。

查询接口：`GET /v1/stats/{apps,overview,pages,devices,performance,errors,errors/occurrences,events}`，需 `Authorization: Bearer <ADMIN_TOKEN>`，公共参数 `app`、`from`、`to`（毫秒时间戳）、`bots=exclude|include|only`。

## SDK

```html
<script src="fanta-report.umd.js"></script>
<script>
  FantaReport.initReport({ reportHost: 'https://your-host/v1/track', appName: 'yourApp' })
  FantaReport.click({ button: 'buy' })
</script>
```

`initReport` 参数：`reportHost`、`appName` 必填；`appVersion`、`userId`、`debug`、`enableGeo=false`、`autoTrack={ pageView, error, performance }`（默认全开）、`batchSize=10`、`flushInterval=5000`、`enableImgFallback=true`、`cookieDomain`（访客 id cookie `fanta_uid` 的 Domain，缺省取主机名末两段，如 `jz.lion1ou.tech` → `.lion1ou.tech`，同主域站点共享同一访客；localhost/IP 不写 cookie，仅用 localStorage）。

方法：`pageView / click / error / custom(data?)`、`setUserId(userId)`、`flush()`。

自动采集：SPA 路由 PV、JS 错误 / Promise 拒绝 / 资源加载错误、页面隐藏时的导航耗时与 FP/FCP/LCP/CLS/FID/INP。每个事件附带 canvas 指纹、`isBot`（UA 列表或 `navigator.webdriver`）与 `isWebdriver`。

服务端会把 `packages/sdk/dist` 公开托管在 `/sdk/`（`Cache-Control: public, max-age=300`），接入方可直接引用 `https://<host>/sdk/fanta-report.umd.js`，SDK 升级随服务发布生效，无需改业务方。已启用 `autoTrack.pageView` 时不要再手动调用 `pageView()`，否则 PV 重复。

## 部署

线上：`https://track.lion1ou.tech`（nginx → pm2 `fanta-monitor` :5020，PostgreSQL 在 NAS）。

```bash
npm run deploy        # 本地构建 → 打包产物/迁移/xdb → scp → 远端 npm ci --omit=dev → pm2 restart → /health
```

- 只上传运行所需文件，`packages/server/.env` 由服务器维护（含 `DATABASE_URL`、`ADMIN_TOKEN`），不随包覆盖。
- 服务启动时自动执行未应用的迁移；xdb 随包上传，服务器无需访问 GitHub。
- nginx 配置见 `deploy/nginx-track.lion1ou.tech.conf`；DNS 生效后执行一次 `certbot --nginx -d track.lion1ou.tech` 补 HTTPS。
- 首次接入新站点需把 `appName` 加入服务器 `.env` 的 `ALLOWED_APPS` 并 `pm2 restart fanta-monitor`。

## 参考

- 浏览器指纹：https://github.com/fingerprintjs/fingerprintjs
- 设备识别：https://github.com/skillnull/DeviceJs/blob/master/device.js
- 浏览器识别：https://github.com/mumuy/browser/blob/master/browser.js
