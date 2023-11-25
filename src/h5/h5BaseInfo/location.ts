export const getLocation = () => {
  console.log(window.location)

  const path = window.location.pathname
  return {
    path
  }
}
