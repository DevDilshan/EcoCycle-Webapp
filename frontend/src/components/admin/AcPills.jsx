import {
  Calendar,
  CircleAlert,
  CircleCheckBig,
  CircleDot,
  Clock,
  Cpu,
  Eye,
  Flag,
  FlaskConical,
  Leaf,
  Package,
  Pencil,
  Recycle,
  ScanSearch,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'

/**
 * Status always reads as an icon plus a word, never colour alone, so the
 * meaning survives for anyone who cannot separate the tones.
 */
const STATUSES = {
  Pending: ['warn', Clock, 'Pending'],
  Classified: ['info', ScanSearch, 'Classified'],
  Approved: ['warn', ShieldCheck, 'Awaiting approval'],
  Scheduled: ['info', Calendar, 'Scheduled'],
  Completed: ['ok', CircleCheckBig, 'Collected'],
  Rejected: ['bad', X, 'Rejected'],
  RevisionRequested: ['warn', Pencil, 'Revision asked'],
  Missed: ['bad', TriangleAlert, 'Missed'],
  Flagged: ['bad', Flag, 'Flagged'],
  Open: ['bad', CircleAlert, 'Open'],
  InProgress: ['warn', Eye, 'In review'],
  Resolved: ['ok', CircleCheckBig, 'Resolved'],
  Active: ['ok', CircleCheckBig, 'Active'],
  Inactive: ['neutral', CircleDot, 'Inactive'],
}

export function AcStatusPill({ status, label }) {
  const [tone, Icon, defaultLabel] = STATUSES[status] || ['neutral', CircleDot, status]
  return (
    <span className={`ac-pill ac-s-${tone}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {label || defaultLabel || status}
    </span>
  )
}

const CATEGORIES = {
  Recyclable: Recycle,
  Organic: Leaf,
  EWaste: Cpu,
  'E-Waste': Cpu,
  Hazardous: FlaskConical,
  Bulk: Package,
  General: Trash2,
}

const CATEGORY_LABELS = { EWaste: 'E-waste' }

/** Category as an icon tile plus its name, with the classifier's confidence. */
export function AcCategory({ category, confidence }) {
  if (!category) return <span className="ac-conf">Not classified</span>
  const Icon = CATEGORIES[category] || Trash2
  return (
    <span className="ac-cat">
      <span className="ac-ct"><Icon size={15} strokeWidth={2} aria-hidden="true" /></span>
      {CATEGORY_LABELS[category] || category}
      {confidence != null && <span className="ac-conf">{Math.round(confidence * 100)}%</span>}
    </span>
  )
}

export function AcCategoryIcon({ category, size = 14 }) {
  const Icon = CATEGORIES[category] || Trash2
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />
}

export { CATEGORY_LABELS }
