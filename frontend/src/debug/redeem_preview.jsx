import { Gift } from 'lucide-react'
import { AcCard } from '../components/admin/AcUi'
import { AcStatusPill } from '../components/admin/AcPills'
import RedemptionTicket from '../components/resident/RedemptionTicket'
import { redemptionPillStatus, redemptionStatusLabel } from '../lib/redemption'
import '../styles/admin.css'

// Sample data only: this page makes no API calls and changes no records.
const samples = [
  { id: 'a', status: 'Pending', reason: 'Reusable shopping bag', points: 40, date: '5 Oct 2026' },
  {
    id: 'b', status: 'Approved', reason: 'Grocery voucher (Rs. 500)', points: 120, date: '4 Oct 2026',
    collectionCode: 'ECO-7F3K-92QD',
    deliveryInstructions: 'Show this code at Counter 3, Town Hall, weekdays 9 am to 4 pm.',
  },
  {
    id: 'c', status: 'Approved', reason: 'Compost bin', points: 200, date: '28 Sep 2026',
    collectionCode: 'ECO-M4TX-8HRP', deliveryInstructions: 'Show this code at your municipal council office to collect your reward.',
    fulfilledAt: '2026-10-01T09:30:00Z',
  },
  {
    id: 'e', status: 'Approved', delivery: 'Email', reason: 'Mobile data voucher', points: 150, date: '3 Oct 2026',
    collectionCode: 'ECO-K9WD-3VTB', residentEmail: 'resident@example.com',
    deliveryInstructions: 'We will email this reward to your account email address within 3 working days.',
  },
  {
    id: 'f', status: 'Approved', delivery: 'Post', reason: 'Seed starter kit', points: 90, date: '2 Oct 2026',
    collectionCode: 'ECO-B6NZ-P4GC', deliveryAddress: '12 Galle Road, Colombo 03',
    deliveryInstructions: 'We will post this reward to the address you gave within 7 working days.',
  },
  { id: 'd', status: 'Rejected', reason: 'Bus pass top-up', points: 300, date: '20 Sep 2026', adminNote: 'Out of stock this month' },
]

export default function RedeemPreview() {
  return (
    <div className="admin-console" style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <p>Development preview · sample data, nothing is saved</p>
      <AcCard title="My redemption requests" subtitle="Once an admin approves, your points are deducted and you get a code to collect the reward">
        <ul className="ac-list">
          {samples.map((item) => (
            <li className="ac-row" key={item.id} style={{ flexWrap: 'wrap' }}>
              <span className="ac-ic"><Gift size={18} strokeWidth={2} aria-hidden="true" /></span>
              <span className="ac-grow">
                <strong>{item.reason}</strong>
                <span className="ac-sub">
                  {item.points} pts · {item.date}{item.adminNote ? ` · Admin: ${item.adminNote}` : ''}
                </span>
              </span>
              <AcStatusPill status={redemptionPillStatus(item)} label={redemptionStatusLabel(item)} />
              <RedemptionTicket item={item} />
            </li>
          ))}
        </ul>
      </AcCard>
    </div>
  )
}
