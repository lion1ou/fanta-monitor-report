import log from './log'

const addZero = (num: number) => {
  return num < 10 ? `0${num}` : num
}

const getTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 月份从 0 开始，所以要加 1
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  return {
    date: `${year}${addZero(month)}${addZero(day)}`,
    time: `${addZero(hours)}:${addZero(minutes)}:${addZero(seconds)}`
  }
}

export const getUUID = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
  const { date } = getTime()
  return `${s4()}${s4()}-${s4()}${s4()}-${s4()}${s4()}-${date}`
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
