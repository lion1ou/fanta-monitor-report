const initState = {
  debug: false
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
