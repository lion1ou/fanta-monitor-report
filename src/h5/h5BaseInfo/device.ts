const ua = window.navigator.userAgent

// 获取系统信息
export const getOS = (): {
  os: string
  osVersion: string
} => {
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
    { s: 'HarmonyOS', r: /HarmonyOS/ },
    { s: 'BlackBerry', r: /BlackBerry|RIM|BB10/ }
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

const checkBot = (): {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
} | null => {
// 判断是否是机器人
  const botArr = [
    { s: 'Googlebot', r: /Googlebot/, v: /Googlebot\/([\d\.]+)/ },
    { s: 'Baiduspider', r: /Baiduspider/, v: /Baiduspider\/([\d\.]+)/ },
    { s: 'Bingbot', r: /Bingbot/, v: /Bingbot\/([\d\.]+)/ },
    { s: '360Spider', r: /360Spider|HaosouSpider/, v: /360Spider\/([\d\.]+)/ },
    { s: 'YisouSpider', r: /YisouSpider/, v: /YisouSpider\/([\d\.]+)/ },
    { s: 'YodaoBot', r: /YodaoBot/, v: /YodaoBot\/([\d\.]+)/ },
    { s: 'YandexBot', r: /YandexBot/, v: /YandexBot\/([\d\.]+)/ },
    { s: 'Sogouspider', r: /Sogou (\S+) Spider/, v: /Sogou (\S+) Spider\/([\d\.]+)/ },
    { s: 'Bytespider', r: /Bytespider/, v: /Bytespider\/([\d\.]+)/ },
    { s: 'ia_archiver', r: /ia_archiver/, v: /ia_archiver/ },
    { s: 'nuhk', r: /nuhk/, v: /nuhk\/([\d\.]+)/ },
    { s: 'Openbot', r: /Openbot/, v: /Openbot\/([\d\.]+)/ },
    { s: 'Slurp', r: /Slurp/, v: /Slurp\/([\d\.]+)/ },
    { s: 'MSNBot', r: /MSNBot/, v: /MSNBot\/([\d\.]+)/ },
    { s: 'Ask Jeeves\/Teoma', r: /Ask Jeeves\/Teoma/, v: /Ask Jeeves\/Teoma/ },
    { s: 'Yammybot', r: /Yammybot/, v: /Yammybot\/([\d\.]+)/ }
  ]

  for (const iterator of botArr) {
    if (iterator.r.test(ua)) {
      const matches = iterator.v.exec(ua)
      return {
        browser: iterator.s,
        browserVersion: matches ? matches[1] : '',
        isBot: true,
        isWebview: false
      }
    }
  }
  return null
}

// 获取浏览器信息
export const getBrower = (): {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
} => {
  let browser = ''
  let browserVersion = ''
  const isBot = false
  const isWebview = ua.includes('; wv)')

  // 判断是否是机器人
  const botInfo = checkBot()
  if (botInfo) {
    return botInfo
  }

  const browserArr = [
    // 浏览器信息,前后顺序有关联
    // 国外浏览器
    { s: 'Safari', r: /Safari/, v: /Safari\/([\d\.]+)/ }, // 已测试
    { s: 'Chrome', r: /Chrome|Chromium|CriOS/, v: /[Chrome|Chromium|CriOS]\/([\d\.]+)/ }, // 已测试
    { s: 'IE', r: /MSIE|Trident/, v: /MSIE ([\d\.]+);|rv:([\d\.]+)/ }, // 已测试
    { s: 'Edge', r: /Edge|Edg\/|EdgA|EdgiOS/, v: /Edge\/([\d\.]+)|Edg\/([\d\.]+)|EdgA\/([\d\.]+)|EdgiOS\/([\d\.]+)/ }, // 已测试
    { s: 'Firefox', r: /Firefox|FxiOS/, v: /Firefox\/([\d\.]+)|FxiOS\/([\d\.]+)/ }, // 已测试
    { s: 'Chromium', r: /Chromium/, v: /Chromium\/([\d\.]+)/ }, // 只有较老版本的 Chromium 才会包含 Chromium 字段
    { s: 'Opera', r: /Opera|OPR/, v: /Opera\/([\d\.]+)|OPR\/([\d\.]+)/ }, // 已测试
    { s: 'Vivaldi', r: /Vivaldi/, v: /Vivaldi\/([\d\.]+)/ }, // 已测试
    { s: 'Yandex', r: /YaBrowser/, v: /YaBrowser\/([\d\.]+)/ },
    { s: 'Arora', r: /Arora/, v: /Arora\/([\d\.]+)/ },
    { s: 'Lunascape', r: /Lunascape/, v: /Lunascape[\/\s]([\d\.]+)/ },
    { s: 'QupZilla', r: /QupZilla/, v: /QupZilla[\/\s]([\d\.]+)/ },
    { s: 'Kindle', r: /Kindle|Silk\//, v: /Kindle\/([\d\.]+)|Silk\/([\d\.]+)/ },
    { s: 'Iceweasel', r: /Iceweasel/, v: /Iceweasel\/([\d\.]+)/ },
    { s: 'Konqueror', r: /Konqueror/, v: /Konqueror\/([\d\.]+)/ },
    { s: 'Iceape', r: /Iceape/, v: /Iceape\/([\d\.]+)/ },
    { s: 'SeaMonkey', r: /SeaMonkey/, v: /SeaMonkey\/([\d\.]+)/ },
    { s: 'Epiphany', r: /Epiphany/, v: /Epiphany\/([\d\.]+)/ },
    { s: 'Electron', r: /Electron/, v: /Electron\/([\d\.]+)/ },
    // 国内浏览器
    { s: '360', r: /QihooBrowser|QHBrowser/, v: /QihooBrowser\/([\d\.]+)|QHBrowser\/([\d\.]+)/ },
    { s: '360EE', r: /360EE/, v: /360EE\/([\d\.]+)/ },
    { s: '360SE', r: /360SE/, v: /360SE\/([\d\.]+)/ },
    { s: 'UC', r: /UCBrowser| UBrowser|UCWEB/, v: /UCBrowser\/([\d\.]+)| UBrowser\/([\d\.]+)|UCWEB\/([\d\.]+)/ }, // 已测试
    { s: 'QQBrowser', r: /QQBrowser/, v: /QQBrowser\/([\d\.]+)/ }, // 已测试
    { s: 'Sogou', r: /MetaSr|Sogou/, v: /MetaSr\s([\d\.]+)|SogouMobileBrowser\/([\d\.]+)/ }, // 已测试
    { s: 'Quark', r: /Quark/, v: /Quark\/([\d\.]+)/ }, // 已测试
    { s: 'Liebao', r: /LBBROWSER|LieBaoFast/, v: /LBBROWSER\/([\d\.]+)|LieBaoFast\/([\d\.]+)/ }, // 已测试
    { s: 'TheWorld', r: /TheWorld/, v: /TheWorld ([\d\.]+)/ }, // 已测试
    // 手机厂商
    { s: 'MiuiBrowser', r: /MiuiBrowser/, v: /MiuiBrowser\/([\d\.]+)/ }, // 已测试
    { s: 'HuaweiBrowser', r: /HuaweiBrowser|HUAWEI\/|HBPC\//, v: /HuaweiBrowser\/([\d\.]+)|HUAWEI\/([\d\.]+)|HBPC\/([\d\.]+)/ },
    { s: 'HONOR', r: /HONOR\//, v: /HONOR\/([\d\.]+)/ },
    { s: 'VivoBrowser', r: /VivoBrowser/, v: /VivoBrowser\/([\d\.]+)/ },
    { s: 'OPPOBrowser', r: /HeyTapBrowser/, v: /HeyTapBrowser\/([\d\.]+)/ },
    // 应用容器
    { s: 'QQ', r: /QQ\//, v: /QQ\/([\d\.]+)/ },
    { s: 'Baidu', r: /Baidu|BIDUBrowser|baidubrowser|baiduboxapp|BaiduHD/, v: /BIDUBrowser[\s\/]([\d\.]+)|baidubrowser[\s\/]([\d\.]+)|baiduboxapp\/([\d\.]+)|BaiduHD\/([\d\.]+)/ },
    { s: 'Weibo', r: /Weibo/, v: /Weibo__([\d\.]+)/ },
    { s: 'Douban', r: /com.douban.frodo/, v: /com.douban.frodo\/([\d\.]+)/ },
    { s: 'Douyin', r: /aweme/, v: /aweme\/([\d\.]+)/ },
    { s: 'Toutiao', r: /NewsArticle/, v: /NewsArticle\/([\d\.]+)/ },
    { s: 'Taobao', r: /AliApp\(TB/, v: /AliApp\(TB\/([\d\.]+)/ },
    { s: 'uTools', r: /uTools/, v: /uTools\/([\d\.]+)/ }

  ]

  for (let i = browserArr.length - 1; i >= 0; i--) {
    const iterator = browserArr[i]
    if (iterator.r.test(ua)) {
      const matches = iterator.v.exec(ua)
      console.log('matches', matches)
      browser = iterator.s
      browserVersion = matches ? (matches[1] || matches[0]?.split('/')[1]) : ''
      break
    }
  }

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

// 获取设备类型
export const getDeviceType = (): string => {
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
// 获取屏幕方向
export const getOrientation = (): string => {
  const orientation = window.screen.orientation
  return orientation
    .type
    .startsWith('portrait')
    ? 'portrait'
    : 'landscape'
}
// 获取屏幕信息
export const getScreenInfo = () => {
  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }
}

export const getMobileModel = () => {
  let brand = 'unknown'
  let model = 'unknown'

  const androidBrandArr = [
    { s: 'Huawei', r: /huawei/ },
    { s: 'HONOR', r: /honor/ },
    { s: 'OPPO', r: /oppo/ },
    { s: 'Vivo', r: /vivo/ },
    { s: 'Xiaomi', r: /xiaomi/ },
    { s: 'Redmi', r: /redmi/ },
    { s: 'OnePlus', r: /oneplus/ },
    { s: 'Realme', r: /realme/ },
    { s: 'Meizu', r: /meizu/ },
    { s: 'Samsung', r: /sm-/ },
    { s: 'LG', r: /lg-/ },
    { s: 'Sony', r: /sony/ },
    { s: 'Motorola', r: /motorola/ },
    { s: 'Lenovo', r: /lenovo/ },
    { s: 'ZTE', r: /zte/ },
    { s: 'Nubia', r: /nubia/ },
    { s: 'Letv', r: /letv/ },
    { s: 'Htc', r: /htc/ },
    { s: 'Asus', r: /asus/ },
    { s: 'Google', r: /google/ },
    { s: 'BlackBerry', r: /blackberry/ },
    { s: 'Nokia', r: /nokia/ },
    { s: 'Microsoft', r: /microsoft/ },
    { s: 'Panasonic', r: /panasonic/ }
  ]

  console.log('手机品牌：' + brand)
  console.log('手机型号：' + model)

  if (ua.match(/iPhone/i)) { // iPhone
    brand = 'iPhone'
    const matches = /Mobile\/([\dA-Z]+)/.exec(ua)
    model = matches ? matches[1] : 'unknown'
  } else if (ua.match(/iPad/i)) { // iPad
    brand = 'iPad'
    const matches = /Mobile\/([\dA-Z]+)/.exec(ua)
    model = matches ? matches[1] : 'unknown'
  } else if (ua.match(/Tablet/i)) { // Android tablets
    model = 'Android tablet'
    brand = 'unknown'
    androidBrandArr.forEach((item) => {
      if (item.r.test(ua.toLowerCase())) {
        brand = item.s
      }
    })
    const regInfo = ua.match(/\((.*?)\)/)
    const info = regInfo ? regInfo[1] : ''
    const arr = info.split(';').reverse()
    arr.forEach((item) => {
      if (item.includes('Build/')) {
        model = item.trim()
      }
    })
  } else if (ua.match(/Android/i)) { // Android phones
    model = 'Android phone'
    brand = 'unknown'
    androidBrandArr.forEach((item) => {
      if (item.r.test(ua.toLowerCase())) {
        brand = item.s
      }
    })
    const regInfo = ua.match(/\((.*?)\)/)
    const info = regInfo ? regInfo[1] : ''
    const arr = info.split(';').reverse()
    arr.forEach((item) => {
      if (item.includes('Build/')) {
        model = item
      }
    })
  }

  return {
    mobileBrand: brand,
    mobileModel: model
  }
}
