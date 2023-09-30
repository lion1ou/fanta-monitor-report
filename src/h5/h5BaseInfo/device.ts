// 获取系统信息
export const getOS = (): {
  os: string
  osVersion: string
} => {
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
    { s: 'Chrome OS', r: /CrOS/ },
    { s: 'Symbian', r: /Symbian/ },
    { s: 'BlackBerry', r: /BlackBerry|RIM/ },
    { s: 'MeeGo', r: /MeeGo/ },
    { s: 'Ubuntu', r: /Ubuntu/ },
    { s: 'Windows Phone', r: /Windows Phone/ },
    { s: 'Debian', r: /Debian/ },
    { s: 'FreeBSD', r: /FreeBSD/ },
    { s: 'WebOS', r: /webOS|hpwOS/ },
    { s: 'HarmonyOS', r: /HarmonyOS/ }
  ]
  for (const iterator of osArr) {
    if (iterator.r.test(ua)) {
      os = iterator.s
      break
    }
  }

  let execRes
  if (os.includes('Windows')) {
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
export const getBrower = (): {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
} => {
  const ua = window.navigator.userAgent
  let browser = ''
  let browserVersion = ''
  let isBot = false
  const isWebview = ua.includes('; wv)')

  // 判断是否是机器人
  const botArr = [
    { s: 'Googlebot', r: /Googlebot/ },
    { s: 'Baiduspider', r: /Baiduspider/ },
    { s: 'Bingbot', r: /Bingbot/ },
    { s: '360Spider', r: /360Spider|HaosouSpider/ },
    { s: 'YisouSpider', r: /YisouSpider/ },
    { s: 'YodaoBot', r: /YodaoBot/ },
    { s: 'YandexBot', r: /YandexBot/ },
    { s: 'Sogouspider', r: /Sogou (\S+) Spider/ },
    { s: 'Bytespider', r: /Bytespider/ },
    { s: 'ia_archiver', r: /ia_archiver/ },
    { s: 'nuhk', r: /nuhk/ },
    { s: 'Openbot', r: /Openbot/ },
    { s: 'Slurp', r: /Slurp/ },
    { s: 'MSNBot', r: /MSNBot/ },
    { s: 'Ask Jeeves\/Teoma', r: /Ask Jeeves\/Teoma/ },
    { s: 'Yammybot', r: /Yammybot/ }
  ]

  for (const iterator of botArr) {
    if (iterator.r.test(ua)) {
      browser = iterator.s
      isBot = true
      break
    }
  }

  // let verOffset = ua.indexOf('Opera')
  // if (verOffset !== -1) {
  //   browser = 'Opera'
  //   browserVersion = ua.substring(verOffset + 6)
  //   verOffset = ua.indexOf('Version')
  //   if (verOffset !== -1) {
  //     browserVersion = ua.substring(verOffset + 8)
  //   }
  // }

  // if (ua.includes('OPR')) {
  //   browser = 'Opera'
  //   verOffset = ua.indexOf('OPR')
  //   browserVersion = ua.substring(verOffset + 4)
  // } else if (ua.includes('MSIE')) {
  //   browser = 'Microsoft Internet Explorer'
  //   verOffset = ua.indexOf('MSIE')
  //   browserVersion = ua.substring(verOffset + 5)
  // } else if (ua.includes('Chrome')) {
  //   browser = 'Chrome'
  //   verOffset = ua.indexOf('Chrome')
  //   browserVersion = ua.substring(verOffset + 7)
  // } else if (ua.includes('Safari')) {
  //   browser = 'Safari'
  //   verOffset = ua.indexOf('Safari')
  //   browserVersion = ua.substring(verOffset + 7)
  //   if (ua.includes('Version')) {
  //     verOffset = ua.indexOf('Version')
  //     browserVersion = ua.substring(verOffset + 8)
  //   }
  // } else if (ua.includes('Firefox')) {
  //   browser = 'Firefox'
  //   verOffset = ua.indexOf('Firefox')
  //   browserVersion = ua.substring(verOffset + 8)
  // } else if (ua.includes('Trident/')) {
  //   browser = 'Microsoft Internet Explorer'
  //   browserVersion = ua.substring(ua.indexOf('rv:') + 3)
  // } else if (/weibo/i.test(ua)) {
  //   browser = 'Weibo'
  // } else if (/ qq/i.test(ua)) {
  //   browser = 'QQ'
  // } else if (/mqqbrowser/i.test(ua)) {
  //   browser = 'QQBrowser'
  // } else if (/UCBrowser/i.test(ua)) {
  //   browser = 'UC'
  // } else if (ua.lastIndexOf(' ') + 1 < ua.lastIndexOf('/')) {
  //   const nameOffset = ua.lastIndexOf(' ')
  //   verOffset = ua.lastIndexOf('/')
  //   browser = ua.substring(nameOffset, verOffset)
  //   browserVersion = ua.substring(verOffset + 1)
  // }

  const browserMap: Record<string, boolean> = {
    // 浏览器 - 国外浏览器
    Safari: ua.includes('Safari'),
    Chrome: ua.includes('Chrome') || ua.includes('CriOS'),
    IE: ua.includes('MSIE') || ua.includes('Trident'),
    Edge: ua.includes('Edge') || ua.includes('Edg/') || ua.includes('EdgA') || ua.includes('EdgiOS'),
    Firefox: ua.includes('Firefox') || ua.includes('FxiOS'),
    'Firefox Focus': ua.includes('Focus'),
    Chromium: ua.includes('Chromium'),
    Opera: ua.includes('Opera') || ua.includes('OPR'),
    Vivaldi: ua.includes('Vivaldi'),
    Yandex: ua.includes('YaBrowser'),
    Brave: !!(window.navigator as any).brave,
    Arora: ua.includes('Arora'),
    Lunascape: ua.includes('Lunascape'),
    QupZilla: ua.includes('QupZilla'),
    'Coc Coc': ua.includes('coc_coc_browser'),
    Kindle: ua.includes('Kindle') || ua.includes('Silk/'),
    Iceweasel: ua.includes('Iceweasel'),
    Konqueror: ua.includes('Konqueror'),
    Iceape: ua.includes('Iceape'),
    SeaMonkey: ua.includes('SeaMonkey'),
    Epiphany: ua.includes('Epiphany'),
    // 浏览器 - 国内浏览器
    360: ua.includes('QihooBrowser') || ua.includes('QHBrowser'),
    '360EE': ua.includes('360EE'),
    '360SE': ua.includes('360SE'),
    UC: ua.includes('UCBrowser') || ua.includes(' UBrowser') || ua.includes('UCWEB'),
    QQBrowser: ua.includes('QQBrowser'),
    QQ: ua.includes('QQ/'),
    Baidu: ua.includes('Baidu') || ua.includes('BIDUBrowser') || ua.includes('baidubrowser') || ua.includes('baiduboxapp') || ua.includes('BaiduHD'),
    Maxthon: ua.includes('Maxthon'),
    Sogou: ua.includes('MetaSr') || ua.includes('Sogou'),
    Liebao: ua.includes('LBBROWSER') || ua.includes('LieBaoFast'),
    '2345Explorer': ua.includes('2345Explorer') || ua.includes('Mb2345Browser') || ua.includes('2345chrome') || (window as any).chrome.adblock2345 || (window as any).chrome.common2345,
    '115Browser': ua.includes('115Browser'),
    TheWorld: ua.includes('TheWorld'),
    Quark: ua.includes('Quark'),
    Qiyu: ua.includes('Qiyu'),
    // 浏览器 - 手机厂商
    XiaoMi: ua.includes('MiuiBrowser'),
    Huawei: ua.includes('HuaweiBrowser') || ua.includes('HUAWEI/') || ua.includes('HONOR') || ua.includes('HBPC/'),
    Vivo: ua.includes('VivoBrowser'),
    OPPO: ua.includes('HeyTapBrowser'),
    // 浏览器 - 客户端
    Taobao: ua.includes('AliApp(TB'),
    Alipay: ua.includes('AliApp(AP'),
    Weibo: ua.includes('Weibo'),
    Douban: ua.includes('com.douban.frodo'),
    Suning: ua.includes('SNEBUY-APP'),
    iQiYi: ua.includes('IqiyiApp'),
    DingTalk: ua.includes('DingTalk'),
    Douyin: ua.includes('aweme')
  }

  Object.keys(browserMap).forEach((key: string) => {
    if (browserMap[key]) {
      browser = key
    }
  })

  // 阿里环境判断
  const alipayMatches = ua.match(/\s*AlipayClient\/([\d\.]+)/i)
  if (alipayMatches) {
    if (ua.includes('DingTalk')) {
      browser = 'DingTalk'
    } else if (ua.includes('AlipayIDE')) {
      browser = 'AlipayIDE'
    } else if (ua.includes('MiniProgram')) {
      browser = 'AliMP'
    } else {
      browser = 'AlipayClient'
    }
    browserVersion = alipayMatches[1] || '0.0.0'
  }
  // 微信环境判断
  const wechatMatches = ua.match(/\s*MicroMessenger\/([\d\.]+)/i)
  if (wechatMatches) {
    if (ua.includes('wechatdevtools')) {
      browser = 'WechatIDE'
    } else if (ua.includes('miniProgram')) {
      browser = 'WechatMP'
    } else if (ua.includes('wxwork')) {
      browser = 'WechatWork'
    } else {
      browser = 'WechatClient'
    }

    browserVersion = wechatMatches[1] || '0.0.0'
  }
  // utools 环境判断
  const utoolsMatches = ua.match(/\s*uTools\/([\d\.]+)/i)
  if (utoolsMatches) {
    browser = 'uTools'
    browserVersion = utoolsMatches[1]
  }

  return {
    browser,
    browserVersion,
    isBot,
    isWebview
  }
}

export const getDeviceType = (): string => {
  const ua = window.navigator.userAgent
  const typeArr = [
    { s: 'Mobile', r: /Mobi|iPh|480/ },
    { s: 'Tablet', r: /Tablet|Nexus 7/ },
    { s: 'iPad', r: /iPad/ }
  ]

  for (const iterator of typeArr) {
    if (iterator.r.test(ua)) {
      return iterator.s
    }
  }
  return 'Desktop'
}

export const getBrowerEngine = (): string => {
  const ua = window.navigator.userAgent
  // 判断浏览器内核
  const engineArr = [
    { s: 'Trident', r: /Trident|NET CLR/ },
    { s: 'Presto', r: /Presto/ },
    { s: 'WebKit', r: /AppleWebKit/ },
    { s: 'Gecko', r: /Gecko\/|Trident\/|Firefox\/|rv:/ },
    { s: 'Blink', r: /Chrome|Chromium|CriOS/ },
    { s: 'KHTML', r: /KHTML/ }
  ]

  for (const iterator of engineArr) {
    if (iterator.r.test(ua)) {
      return iterator.s
    }
  }
  return 'Unknow'
}
