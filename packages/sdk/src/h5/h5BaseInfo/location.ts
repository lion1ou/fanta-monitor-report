import type { PageInfo } from '../../types'

export const getPageInfo = (): PageInfo => ({
  pageOrigin: window.location.origin,
  pagePath: window.location.pathname,
  pageSearch: window.location.search.replace(/^\?/, ''),
  pageProtocol: window.location.protocol,
  pageTitle: document.title,
  referrer: document.referrer
})
