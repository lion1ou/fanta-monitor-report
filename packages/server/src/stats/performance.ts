import type { Pool } from 'pg'
import { VITAL_METRICS, VITAL_THRESHOLDS, type MetricSummary, type PerformanceStats, type VitalMetric } from '@fanta/shared'
import { bucketExpr, bucketsSql, scopeParams, scopedSql, type Scope } from './scope.js'

// PostgreSQL 会把未加引号的标识符折叠为小写（domReady -> domready），SQL 列名与结果行取值统一用小写
const col = (metric: VitalMetric) => metric.toLowerCase()

// 只接受纯数字文本，避免脏数据让整条 SQL 失败
const metricExpr = (metric: VitalMetric) =>
  `CASE WHEN track_data ->> '${metric}' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (track_data ->> '${metric}')::float8 END AS ${col(metric)}`

const PERF_CTE = (scope: Scope) => `
scoped AS (${scopedSql(scope)}),
perf AS (SELECT track_time, page_path, ${VITAL_METRICS.map(metricExpr).join(', ')} FROM scoped WHERE track_type = 'Performance')`

const summaryColumns = (metric: VitalMetric) => {
  const c = col(metric)
  const threshold = VITAL_THRESHOLDS[metric]
  const rating = threshold
    ? `count(*) FILTER (WHERE ${c} <= ${threshold[0]})::int AS ${c}_good,
       count(*) FILTER (WHERE ${c} > ${threshold[0]} AND ${c} <= ${threshold[1]})::int AS ${c}_ni,
       count(*) FILTER (WHERE ${c} > ${threshold[1]})::int AS ${c}_poor`
    : `0 AS ${c}_good, 0 AS ${c}_ni, 0 AS ${c}_poor`
  return `percentile_cont(ARRAY[0.5, 0.75, 0.95]) WITHIN GROUP (ORDER BY ${c}) AS ${c}_p, count(${c})::int AS ${c}_n, ${rating}`
}

const SUMMARY_SQL = (scope: Scope) => `WITH ${PERF_CTE(scope)} SELECT ${VITAL_METRICS.map(summaryColumns).join(', ')} FROM perf`

const SERIES_SQL = (scope: Scope) => `
WITH ${PERF_CTE(scope)}, buckets AS (${bucketsSql})
SELECT b.bucket,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY p.lcp) AS lcp,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY p.fcp) AS fcp,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY p.inp) AS inp
FROM buckets b LEFT JOIN perf p ON ${bucketExpr.replace('track_time', 'p.track_time')} = b.bucket
GROUP BY b.bucket ORDER BY b.bucket`

const PAGES_SQL = (scope: Scope) => `
WITH ${PERF_CTE(scope)}
SELECT page_path AS path, count(*)::int AS samples,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY lcp) AS lcp,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY fcp) AS fcp,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY inp) AS inp
FROM perf GROUP BY page_path ORDER BY samples DESC, path LIMIT 20`

type SummaryRow = Record<string, number | number[] | null>

const toSummary = (row: SummaryRow, metric: VitalMetric): MetricSummary => {
  const c = col(metric)
  const p = (row[`${c}_p`] as number[] | null) ?? [null, null, null]
  return {
    p50: p[0],
    p75: p[1],
    p95: p[2],
    samples: row[`${c}_n`] as number,
    good: row[`${c}_good`] as number,
    needsImprovement: row[`${c}_ni`] as number,
    poor: row[`${c}_poor`] as number
  }
}

export const queryPerformance = async (pool: Pool, scope: Scope): Promise<PerformanceStats> => {
  const params = scopeParams(scope)
  const [summary, series, pages] = await Promise.all([
    pool.query<SummaryRow>(SUMMARY_SQL(scope), params),
    pool.query<{ bucket: Date, lcp: number | null, fcp: number | null, inp: number | null }>(SERIES_SQL(scope), [...params, scope.granularity, scope.timezone]),
    pool.query<PerformanceStats['pages'][number]>(PAGES_SQL(scope), params)
  ])
  const metrics = Object.fromEntries(VITAL_METRICS.map((metric) => [metric, toSummary(summary.rows[0], metric)])) as Record<VitalMetric, MetricSummary>
  return {
    granularity: scope.granularity,
    metrics,
    series: series.rows.map((row) => ({ bucket: row.bucket.toISOString(), lcp: row.lcp, fcp: row.fcp, inp: row.inp })),
    pages: pages.rows
  }
}
