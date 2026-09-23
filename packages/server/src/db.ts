import { Pool } from 'pg'
import type { GeoRegion, TrackEvent } from '@fanta/shared'
import { classifyBot } from './bot.js'

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

// 服务端派生列：爬虫判定、webdriver 标记与按 client_ip 解析的地域，随事件一起写入
const INSERT_SQL = `
INSERT INTO track_events (track_time, client_ip, geo_country, geo_province, geo_city, bot_verdict, is_webdriver, ${COLUMNS.map(([column]) => column).join(', ')})
SELECT to_timestamp(t."trackTime" / 1000.0), NULLIF($2, '')::inet, $3, $4, $5, t."botVerdict", COALESCE(t."isWebdriver", false), ${COLUMNS.map(([, field]) => `t."${field}"`).join(', ')}
FROM jsonb_to_recordset($1::jsonb) AS t("trackTime" bigint, "botVerdict" text, "isWebdriver" boolean, ${COLUMNS.map(([, field, pgType]) => `"${field}" ${pgType}`).join(', ')})
ON CONFLICT (app_name, track_id) DO NOTHING
RETURNING 1`

// 一条 SQL 写入整批；(app_name, track_id) 已存在的事件跳过；返回实际写入条数
export const insertTrackEvents = async (pool: Pool, events: TrackEvent[], clientIp: string, geo: GeoRegion): Promise<number> => {
  const rows = events.map((event) => ({ ...event, botVerdict: classifyBot(event) }))
  const { rowCount } = await pool.query(INSERT_SQL, [JSON.stringify(rows), clientIp, geo.country, geo.province, geo.city])
  return rowCount ?? 0
}
