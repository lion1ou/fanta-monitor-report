/* eslint-disable @typescript-eslint/member-delimiter-style */
// 获取网络类型
import log from '../../utils/log';
import { getLocal, getUUID, setLocal } from '../../utils'
import { ajaxGet } from '../../common/request'
import { UUID_LOCAL_KEY } from '../../common/constant';

declare const navigator: any;

export const getIp = async (): Promise<string> => {
  try {
    const res: any = await ajaxGet('https://api.ipify.org?format=json');
    return res.data.ip;
  } catch (error) {
    log.warn('获取ip失败：', error);
    try {
      const res: any = await ajaxGet('https://api.infoip.io/ip');
      return res.data;
    } catch (error) {
      log.error('获取ip重试失败：', error);
      return '';
    }
  }
};

const isWifi = (): boolean => {
  try {
    let wifi = true;
    const ua = navigator.userAgent;
    const conn = navigator.connection;
    // 判断是否微信环境
    if (ua.includes('MicroMessenger')) {
      if (ua.includes('WIFI')) {
        return true;
      } else {
        wifi = false;
      }
      // 判断是否支持navigator.connection
    } else if (conn) {
      wifi = conn.type === 'wifi';
    }
    return wifi;
  } catch (e) {
    log.error('判断是否wifi失败：', e);
    return false;
  }
};

export const getNetworkType = async (): Promise<{
  networkType: string;
  networkEffectiveType: string;
}> => {
  return await new Promise((resolve, reject) => {
    const network = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    resolve({
      networkType: isWifi() ? 'wifi' : network.type || 'unknown', // 链接类型，bluetooth cellular ethernet none wifi wimax other unknown
      networkEffectiveType: network.effectiveType || 'unknown', // 返回连接的有效类型，比如 “slow-2g”，“2g”，“3g” 或 “4g”
    });
  });
};

const getLocation = async (): Promise<{
  location: { lat: number; lng: number };
  flag: string;
}> => {
  return await new Promise((resolve, reject) => {
    function geoShowPosition (position: any) {
      if (position) {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        resolve({ location, flag: 'success' });
      } else {
        log.warn(`getPosWarn: position is null；${JSON.stringify(navigator.geolocation)}`);
        reject(new Error('get location fail'));
      }
    }

    function geoShowError (error: any) {
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

export const uuid = () => {
  const localData = getLocal(UUID_LOCAL_KEY)
  const id = localData ?? getUUID()
  setLocal(UUID_LOCAL_KEY, id)
  return id
}
