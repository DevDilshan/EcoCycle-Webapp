import { ChevronRight } from 'lucide-react'
import { formatCompactDate, formatRequestId } from '../../lib/adminUi'
import { AcStatusPill } from './AcPills'

const TYPE_LABELS = {
  missed: 'Missed pickup',
  late: 'Late collection',
  damage: 'Damaged bin',
  default: 'General',
}

function inferType(description = '') {
  const text = description.toLowerCase()
  if (/miss/.test(text)) return 'missed'
  if (/late|delay/.test(text)) return 'late'
  if (/damage|broken|bin/.test(text)) return 'damage'
  return 'default'
}

/**
 * One complaint as a table row. The design puts complaints in a table with a
 * resolve drawer, so this renders a <tr> and must be used inside a <tbody>.
 */
export default function ComplaintRowCard({ complaint, residentLabel, onView }) {
  const typeLabel = TYPE_LABELS[inferType(complaint.description)]

  return (
    <tr
      tabIndex={0}
      onClick={() => onView(complaint)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onView(complaint)
        }
      }}
    >
      <td className="ac-id">{formatRequestId(complaint.id, 'CMP')}</td>
      <td>
        <strong>{residentLabel || 'Resident'}</strong>
        <span className="ac-sub">{complaint.description?.slice(0, 60) || 'No description'}</span>
      </td>
      <td>{typeLabel}</td>
      <td>{formatCompactDate(complaint.createdAt)}</td>
      <td><AcStatusPill status={complaint.status} /></td>
      <td className="ac-chevron">
        <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
      </td>
    </tr>
  )
}
