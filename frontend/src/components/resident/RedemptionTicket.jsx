import { useState } from 'react'
import { CheckCircle2, Copy, Mail, Package, Ticket } from 'lucide-react'
import { formatDate } from '../../lib/api'
import { deliveryOf } from '../../lib/redemption'

const ICONS = { Collect: Ticket, Email: Mail, Post: Package }

/**
 * The slip for an approved redemption: the resident's code and how the reward
 * reaches them (collected in person, emailed, or posted to the address they
 * gave). Once an admin records the hand-over the slip turns into a receipt.
 * Requests approved before codes existed have none, and render nothing.
 */
export default function RedemptionTicket({ item }) {
  const [copied, setCopied] = useState(false)
  if (item.status !== 'Approved' || !item.collectionCode) return null

  if (item.fulfilledAt) {
    return (
      <div className="ac-ticket ac-ticket-done">
        <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>
          {deliveryOf(item).done} on {formatDate(item.fulfilledAt)} · code <code>{item.collectionCode}</code>
        </span>
      </div>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.collectionCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the code is on screen to read out.
    }
  }

  const Icon = ICONS[item.delivery] ?? Ticket
  const collect = (item.delivery ?? 'Collect') === 'Collect'

  return (
    <div className="ac-ticket">
      <span className="ac-ticket-ic"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
      <span className="ac-ticket-body">
        <small>{collect ? 'Your collection code' : 'Your reference code'}</small>
        <code className="ac-ticket-code">{item.collectionCode}</code>
        <span className="ac-ticket-how">{item.deliveryInstructions}</span>
        {item.delivery === 'Email' && item.residentEmail && <span className="ac-ticket-to">To: {item.residentEmail}</span>}
        {item.delivery === 'Post' && item.deliveryAddress && <span className="ac-ticket-to">To: {item.deliveryAddress}</span>}
      </span>
      <button type="button" className="ac-btn ac-btn-ghost ac-btn-sm" onClick={copy}>
        <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
        {copied ? 'Copied' : 'Copy code'}
      </button>
    </div>
  )
}
