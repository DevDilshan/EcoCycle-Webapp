export function getHomePath(role) {
  if (role === 'admin') return '/admin'
  if (role === 'collector') return '/collector'
  return '/dashboard'
}