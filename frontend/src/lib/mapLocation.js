/** Only explicitly saved, valid coordinates identify an individual pickup. */
export function pickupPoint(pickup) {
  const lat = pickup?.latitude
  const lng = pickup?.longitude
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? [lat, lng] : null
}

export function pickupDirections(pickup) {
  const point = pickupPoint(pickup)
  const destination = point ? point.join(',') : pickup?.address?.trim()
  if (!destination) return null
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1', destination, travelmode: 'driving',
  })}`
}

export function deviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is unavailable. Choose a point on the map instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.latitude, coords.longitude]),
      () => reject(new Error('Could not get your location. Check location access or choose a point on the map.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
}
