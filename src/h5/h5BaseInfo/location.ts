import log from '../../utils/log'

const getLocation = async (): Promise<{
  location: { lat: number, lng: number }
  flag: string
}> => {
  return await new Promise((resolve, reject) => {
    function geoShowPosition (position: any) {
      if (position) {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        resolve({ location, flag: 'success' })
      } else {
        log.warn(`getPosWarn: position is null；${JSON.stringify(navigator.geolocation)}`)
        reject(new Error('get location fail'))
      }
    }

    function geoShowError (error: any) {
      log.error(`getPosError:${error.code},${JSON.stringify(navigator.geolocation)},${error.message}`)
      reject(error)
    }

    navigator.geolocation.getCurrentPosition(geoShowPosition, geoShowError)
  })
}

export {
  getLocation
}
