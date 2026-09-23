import log from '../../common/log';

interface NetworkInformationLike {
  type?: string
  effectiveType?: string
}

const getConnection = (): NetworkInformationLike | undefined => {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike
    mozConnection?: NetworkInformationLike
    webkitConnection?: NetworkInformationLike
  }
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection
}

const isWifi = (): boolean => {
  const ua = navigator.userAgent
  if (ua.includes('MicroMessenger')) return ua.includes('WIFI')
  return getConnection()?.type === 'wifi'
}

export const getNetworkType = async (): Promise<{ networkType: string, networkEffectiveType: string }> => {
  const connection = getConnection()
  return {
    networkType: isWifi() ? 'wifi' : connection?.type ?? 'unknown', // bluetooth cellular ethernet none wifi wimax other unknown
    networkEffectiveType: connection?.effectiveType ?? 'unknown' // slow-2g 2g 3g 4g
  }
}

const getLocation = async (): Promise<{
  location: { lat: number, lng: number }
  flag: string
}> => {
  return await new Promise((resolve, reject) => {
    function geoShowPosition (position: GeolocationPosition) {
      if (position) {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        resolve({ location, flag: 'success' });
      } else {
        log.warn(`getPosWarn: position is null；${JSON.stringify(navigator.geolocation)}`);
        reject(new Error('get location fail'));
      }
    }

    function geoShowError (error: GeolocationPositionError) {
      log.error(
        `getPosError:${error.code},${JSON.stringify(navigator.geolocation)},${error.message}`
      );
      reject(error);
    }

    navigator.geolocation.getCurrentPosition(geoShowPosition, geoShowError);
  });
};

export const getGeo = async () => {
  try {
    const res = await getLocation();
    return res;
  } catch (error) {
    log.error('获取定位失败：', error);
  }
};
