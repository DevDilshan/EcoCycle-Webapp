const RECOMMENDATION_LABELS = {
  approve: { label: 'Agent suggests: approve', tone: 'ok' },
  reject: { label: 'Agent suggests: reject', tone: 'danger' },
  request_revision: { label: 'Agent suggests: request revision', tone: 'warn' },
}

/**
 * What the agent pipeline decided about a flagged pickup, for the admin review
 * screen. `insight` is the agentInsight object from GET /api/approvals/{id};
 * `note` is agentResultNote, set only when there is no insight to show.
 */
export default function AgentInsightPanel({ insight, note, loading }) {
  if (loading) {
    return <div className="agent-insight agent-insight-muted">Loading AI analysis…</div>
  }

  if (!insight) {
    return (
      <div className="agent-insight agent-insight-muted">
        {note || 'No AI analysis available for this request.'}
      </div>
    )
  }

  const recommendation = RECOMMENDATION_LABELS[insight.recommendation] || null
  // Confidence arrives as 0..1 from the classifier.
  const confidencePct = Math.round((insight.confidence ?? 0) * 100)

  return (
    <div className="agent-insight">
      <div className="agent-insight-head">
        <span className="agent-insight-chip">{insight.category || 'Unclassified'}</span>
        <span className="agent-insight-chip agent-insight-chip-plain">
          {confidencePct}% confident
        </span>
        {insight.imageUsed ? (
          <span className="agent-insight-chip agent-insight-chip-plain">photo analysed</span>
        ) : (
          <span className="agent-insight-chip agent-insight-chip-plain">text only</span>
        )}
        {recommendation && (
          <span className={`agent-insight-chip agent-insight-chip-${recommendation.tone}`}>
            {recommendation.label}
          </span>
        )}
      </div>

      {insight.classificationReasoning && (
        <p className="agent-insight-line">
          <strong>Why this category:</strong> {insight.classificationReasoning}
        </p>
      )}

      {insight.violatedRules?.length > 0 && (
        <p className="agent-insight-line">
          <strong>Rules broken:</strong> {insight.violatedRules.join(', ')}
        </p>
      )}

      {insight.adminSummary && (
        <p className="agent-insight-line">
          <strong>Summary for you:</strong> {insight.adminSummary}
        </p>
      )}

      {insight.recommendationReasoning && (
        <p className="agent-insight-line">
          <strong>Why that recommendation:</strong> {insight.recommendationReasoning}
        </p>
      )}

      {insight.residentNotification && (
        <details className="agent-insight-draft">
          <summary>Draft message for the resident</summary>
          <p>{insight.residentNotification}</p>
        </details>
      )}
    </div>
  )
}
