/** Match all search words, preserving source order and original display names. */
export function filterServiceAreas(zones, query) {
  const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  const words = normalize(query).trim().split(/\s+/u).filter(Boolean)
  return zones.filter((zone) => words.every((word) => normalize(zone.name).includes(word)))
}
