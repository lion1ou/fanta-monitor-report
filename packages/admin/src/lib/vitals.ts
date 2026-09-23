import { VITAL_THRESHOLDS, type VitalMetric } from '@fanta/shared'

export type Rating = 'good' | 'needsImprovement' | 'poor' | 'none'

export const rateMetric = (metric: VitalMetric, value: number | null | undefined): Rating => {
  const threshold = VITAL_THRESHOLDS[metric]
  if (threshold === undefined || value == null) return 'none'
  if (value <= threshold[0]) return 'good'
  if (value <= threshold[1]) return 'needsImprovement'
  return 'poor'
}

export const METRIC_LABELS: Record<VitalMetric, { name: string, desc: string }> = {
  lcp: { name: 'LCP', desc: '最大内容绘制' },
  fcp: { name: 'FCP', desc: '首次内容绘制' },
  cls: { name: 'CLS', desc: '累积布局偏移' },
  inp: { name: 'INP', desc: '交互到下一帧' },
  fid: { name: 'FID', desc: '首次输入延迟' },
  ttfb: { name: 'TTFB', desc: '首字节时间' },
  load: { name: 'Load', desc: '页面完全加载' },
  domReady: { name: 'DOM Ready', desc: 'DOM 解析完成' }
}

export const RATING_LABELS: Record<Exclude<Rating, 'none'>, string> = {
  good: '良好',
  needsImprovement: '待改进',
  poor: '较差'
}
