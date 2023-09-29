const initState = {
  debug: true
}

const Store = {
  state: initState,
  getDebug () {
    return this.state.debug
  },
  setDebug (debug: boolean) {
    this.state.debug = debug
  }
}

export default Store
