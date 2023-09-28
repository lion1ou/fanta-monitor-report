import Store from '../common/store'

const lvlColorMap: Record<string, string> = {
  log: '#59aaff',
  info: '#29c3e0',
  warn: '#ffcc2b',
  error: '#f37f89',
  in_Error: '#ff0000'
}

const baseLog = (level: string, msg: any, optionalParams: any, canLog: () => boolean) => {
  if (!canLog()) {
    return
  }

  if (optionalParams) {
    console.log(`%c${level.toUpperCase()}%c [芬达 * 埋点] %c${msg}%o`, `color:${lvlColorMap[level]};background:#000;padding: 1px 4px;`, 'color:#0f9a9e', 'color:#666', optionalParams)
  } else {
    console.log(`%c${level.toUpperCase()}%c [芬达 * 埋点] %c${msg}`, `color:${lvlColorMap[level]};background:#000;padding: 1px 4px;`, 'color:#0f9a9e', 'color:#666')
  }
}

const log = {
  info: (msg: any, optionalParams?: any) => {
    baseLog('info', msg, optionalParams, () => {
      return Store.getDebug()
    })
  },

  warn: (msg: any, optionalParams?: any) => {
    baseLog('warn', msg, optionalParams, () => {
      return Store.getDebug()
    })
  },

  error: (msg: any, optionalParams?: any) => {
    baseLog('error', msg, optionalParams, () => {
      return Store.getDebug()
    })
  },

  internalError: (msg: string, error?: Error) => {
    baseLog('in_Error', msg, error, () => {
      return Store.getDebug()
    })
  },

  deprecated: (method: string) => {
    log.warn(`${method}方法已废弃，请删除`)
  }
}

export default log
