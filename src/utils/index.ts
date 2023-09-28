import axios from 'axios'

export const getIp = async (): Promise<string> => {
  const res = await axios.get('https://api.ipify.org?format=json')
  return res.data.ip
}
