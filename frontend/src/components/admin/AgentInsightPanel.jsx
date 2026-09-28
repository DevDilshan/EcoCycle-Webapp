import { Sparkles } from 'lucide-react'

const RECOMMENDATION_LABELS = {
  approve: 'Validator suggests approving',
  reject: 'Validator suggests rejecting',
  request_revision: 'Validator suggests asking for a revision',
}

/**
 * What the agent pipeline decided about a flagged pickup, for the admin review
 * screen. `insight` is the agentInsight object from GET /api/approvals/{id};
 * `note` is agentResultNote, set only when there is no insight to show.
 */
export default function AgentInsightPanel({ insight, note, loading }) {
  if (loading) {
    return (
      <div className="ac-insight">
        <p>Loading the agent analysis…</p>
      </div>
    )
  }

  if (!insight) {
    return (
      <div className="ac-insight">
        <p>{note || 'No agent analysis available for this request.'}</p>
      </div>
    )
  }

  const recommendation = RECOMMENDATION_LABELS[insight.recommendation]
  // Confidence arrives as 0..1 from the classifier.
  const confidencePct = Math.round((insight.confidence ?? 0) * 100)

  // AdminSummary is written for exactly this panel; the classifier reasoning is
  // the fallback when the pipeline did not produce one.
  const body = insight.adminSummary || insight.classificationReasoning

  return (
    <div className="ac-insight">
      <h4>
        <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
        {recommendation || 'Validator analysis'}
      </h4>
      {body && <p>{body}</p>}
      <p className="ac-insight-meta">
        {insight.category || 'Unclassified'} · {confidencePct}% confident ·{' '}
        {insight.imageUsed ? 'photo analysed' : 'text only'}
        {insight.violatedRules?.length ? ` · ${insight.violatedRules.join(', ')}` : null}
      </p>
    </div>
  )
}
