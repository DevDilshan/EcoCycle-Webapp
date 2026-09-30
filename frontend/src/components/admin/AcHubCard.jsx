import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

/**
 * A launcher tile for an admin section: icon, what it is, what it holds right
 * now, and one clear action. The whole tile is a single link, so it works with
 * a keyboard and reads as one control to a screen reader.
 */
export default function AcHubCard({ icon, eyebrow, title, description, meta, action, to, attention = false }) {
  return (
    <Link to={to} className={`ac-hub-card${attention ? ' has-attention' : ''}`}>
      <span className="ac-hub-icon" aria-hidden="true">{icon}</span>
      <span className="ac-hub-eyebrow">{eyebrow}</span>
      <span className="ac-hub-title">{title}</span>
      <span className="ac-hub-desc">{description}</span>
      {meta && <span className="ac-hub-meta">{meta}</span>}
      <span className="ac-hub-action">
        {action}
        <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden="true" />
      </span>
    </Link>
  )
}
