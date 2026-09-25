import { CATEGORY_PILLS } from '../../lib/adminUi'

export default function CategoryPill({ category }) {
  const config = CATEGORY_PILLS[category] || CATEGORY_PILLS.General
  return (
    <span className={`design-pill ${config.className}`}>
      {config.icon} {config.label}
    </span>
  )
}
