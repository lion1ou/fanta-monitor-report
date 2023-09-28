import { getType } from './network'

// 获取系统信息
const getOS = () => {
  const ua = window.navigator.userAgent
  let os = ''
  let osVersion = ''
  const osArr = [
    { s: 'Windows 10', r: /(Windows 10.0|Windows NT 10.0)/ },
    { s: 'Windows 8.1', r: /(Windows 8.1|Windows NT 6.3)/ },
    { s: 'Windows 8', r: /(Windows 8|Windows NT 6.2)/ },
    { s: 'Windows 7', r: /(Windows 7|Windows NT 6.1)/ },
    { s: 'Windows Vista', r: /Windows NT 6.0/ },
    { s: 'Windows Server 2003', r: /Windows NT 5.2/ },
    { s: 'Windows XP', r: /(Windows NT 5.1|Windows XP)/ },
    { s: 'Windows 2000', r: /(Windows NT 5.0|Windows 2000)/ },
    { s: 'Windows ME', r: /(Win 9x 4.90|Windows ME)/ },
    { s: 'Windows 98', r: /(Windows 98|Win98)/ },
    { s: 'Windows 95', r: /(Windows 95|Win95|Windows_95)/ },
    { s: 'Windows NT 4.0', r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/ },
    { s: 'Windows CE', r: /Windows CE/ },
    { s: 'Windows 3.11', r: /Win16/ },
    { s: 'Android', r: /Android/ },
    { s: 'Open BSD', r: /OpenBSD/ },
    { s: 'Sun OS', r: /SunOS/ },
    { s: 'Linux', r: /(Linux|X11)/ },
    { s: 'iOS', r: /(iPhone|iPad|iPod|iOS)/ },
    { s: 'Mac OS X', r: /Mac OS X/ },
    { s: 'Mac OS', r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/ },
    { s: 'QNX', r: /QNX/ },
    { s: 'UNIX', r: /UNIX/ },
    { s: 'BeOS', r: /BeOS/ },
    { s: 'OS/2', r: /OS\/2/ },
    { s: 'Search Bot', r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/ },
    { s: 'HarmonyOS', r: /HarmonyOS/ }
  ]
  for (const iterator of osArr) {
    if (iterator.r.test(ua)) {
      os = iterator.s
      break
    }
  }

  let execRes
  if (/Windows/.test(os)) {
    execRes = /Windows (.*)/.exec(os)
    osVersion = execRes ? execRes[1] : ''
    os = 'Windows'
  }
  switch (os) {
    case 'Mac OS X':
      execRes = /Mac OS X (10[\.\_\d]+)/.exec(ua)
      osVersion = execRes ? execRes[1].replace(/_/g, '.') : ''
      break
    case 'Android':
      execRes = /Android ([\.\_\d]+)/.exec(ua)
      osVersion = execRes ? execRes[1] : ''
      break
    case 'iOS':
      execRes = /OS ([\.\_\d]+)/.exec(ua)
      osVersion = execRes ? execRes[1].replace(/_/g, '.') : ''
      break
    case 'HarmonyOS':
      execRes = /HarmonyOS ([\.\_\d]+)/.exec(ua)
      osVersion = execRes ? execRes[1].replace(/_/g, '.') : ''
      break
  }

  return {
    os,
    osVersion
  }
}
// 获取浏览器信息
const getBrower = () => {
  const ua = window.navigator.userAgent
  let browser = ''
  let browserVersion = ''

  let verOffset = ua.indexOf('Opera')
  if (verOffset !== -1) {
    browser = 'Opera'
    browserVersion = ua.substring(verOffset + 6)
    verOffset = ua.indexOf('Version')
    if (verOffset !== -1) {
      browserVersion = ua.substring(verOffset + 8)
    }
  }

  if (ua.indexOf('OPR') !== -1) {
    browser = 'Opera'
    verOffset = ua.indexOf('OPR')
    browserVersion = ua.substring(verOffset + 4)
  } else if (ua.indexOf('MSIE') !== -1) {
    browser = 'Microsoft Internet Explorer'
    verOffset = ua.indexOf('MSIE')
    browserVersion = ua.substring(verOffset + 5)
  } else if (ua.indexOf('Chrome') !== -1) {
    browser = 'Chrome'
    verOffset = ua.indexOf('Chrome')
    browserVersion = ua.substring(verOffset + 7)
  } else if (ua.indexOf('Safari') !== -1) {
    browser = 'Safari'
    verOffset = ua.indexOf('Safari')
    browserVersion = ua.substring(verOffset + 7)
    if (ua.indexOf('Version') !== -1) {
      verOffset = ua.indexOf('Version')
      browserVersion = ua.substring(verOffset + 8)
    }
  } else if (ua.indexOf('Firefox') !== -1) {
    browser = 'Firefox'
    verOffset = ua.indexOf('Firefox')
    browserVersion = ua.substring(verOffset + 8)
  } else if (ua.indexOf('Trident/') !== -1) {
    browser = 'Microsoft Internet Explorer'
    browserVersion = ua.substring(ua.indexOf('rv:') + 3)
  } else if (/weibo/i.test(ua)) {
    browser = 'Weibo'
  } else if (/ qq/i.test(ua)) {
    browser = 'QQ'
  } else if (/mqqbrowser/i.test(ua)) {
    browser = 'QQBrowser'
  } else if (/UCBrowser/i.test(ua)) {
    browser = 'UC'
  } else if (ua.lastIndexOf(' ') + 1 < ua.lastIndexOf('/')) {
    let nameOffset = ua.lastIndexOf(' ')
    verOffset = ua.lastIndexOf('/')
    browser = ua.substring(nameOffset, verOffset)
    browserVersion = ua.substring(verOffset + 1)
  }

  const alipayMatches = ua.match(/\s*AlipayClient\/([\d\.]+)/i)
  if (alipayMatches) {
    if (ua.indexOf('DingTalk') > -1) {
      browser = 'DingTalk'
    } else if (ua.indexOf('AlipayIDE') > -1) {
      browser = 'AlipayIDE'
    } else if (ua.indexOf('MiniProgram') > -1) {
      browser = 'AliMP'
    } else {
      browser = 'AlipayClient'
    }
    browserVersion = alipayMatches[1] || '0.0.0'
  }

  const wechatMatches = ua.match(/\s*MicroMessenger\/([\d\.]+)/i)
  if (wechatMatches) {
    if (ua.indexOf('wechatdevtools') > -1) {
      browser = 'WechatIDE'
    } else if (ua.indexOf('miniProgram') > -1) {
      browser = 'WechatMP'
    } else {
      browser = 'WechatClient'
    }

    browserVersion = wechatMatches[1] || '0.0.0'
  }

  const utoolsMatches = ua.match(/\s*uTools\/([\d\.]+)/i)
  if (utoolsMatches) {
    browser = 'uTools'
    browserVersion = utoolsMatches[1]
  }

  return {
    browser,
    browserVersion
  }
}

const getNetwork = () => {
  if (!navigator || typeof navigator !== 'object') {
    return null
  }
  const { nType, nEffectiveType } = getType()

  return {
    nType,
    nEffectiveType,
  }
}

const device = {
  userAgent: window.navigator.userAgent,
  ...getOS(),
  ...getBrower(),
  ...getNetwork()
}

export default device
