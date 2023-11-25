import log from './log'

export const getUUID = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
  // return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
  //   var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  //   return v.toString(16);
  // }
}

export const setLocal = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    log.error(error)
    return false
  }
}

export const getLocal = (key: string) => {
  let res = localStorage.getItem(key)
  if (!res) {
    return null
  } else {
    try {
      res = JSON.parse(res)
      return res
    } catch (error) {
      log.error(error)
      return res
    }
  }
}
