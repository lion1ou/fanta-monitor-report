export const getLocation = () => {
  const pagePath = window?.location?.pathname || ''
  const pageOrigin = window?.location?.origin || ''
  const pageSearch = window?.location?.search?.split('?')[1] || ''
  const pageProtocol = window?.location?.protocol || ''
  return {
    pagePath,
    pageOrigin,
    pageSearch,
    pageProtocol
  }
}
