import { isbot } from 'isbot'
import type { BotVerdict, TrackEvent } from '@fanta/shared'

// 服务端爬虫判定：自动化驱动信号 > 服务端 UA 库 > SDK 自带 UA 列表 > 正常访客
export const classifyBot = (event: TrackEvent): BotVerdict => {
  if (event.isWebdriver === true) return 'webdriver'
  if (isbot(event.userAgent)) return 'ua'
  if (event.isBot) return 'sdk'
  return 'none'
}
