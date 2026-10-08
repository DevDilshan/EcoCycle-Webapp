import { MessageSquare, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'

const NOTIFIER_RECOMMENDATION_LABELS = {
  approve: 'Suggest approve',
  reject: 'Suggest reject',
  request_revision: 'Suggest ask resident to revise',
}

const POLICY_RULE_LABELS = {
  HAZARDOUS_CATEGORY: 'Hazardous waste (policy)',
  EXCESSIVE_BULK_PICKUPS: 'Bulk pickup monthly limit (policy)',
  LOW_CLASSIFICATION_CONFIDENCE: 'Low classification confidence',
  POSSIBLE_CONTAMINATION: 'Possible contamination (text review)',
  CATEGORY_DESCRIPTION_MISMATCH: 'Description vs category mismatch (text review)',
  PROHIBITED_ITEMS_MENTIONED: 'Prohibited items mentioned (text review)',
  MIXED_WASTE_CONCERN: 'Mixed waste concern (text review)',
}

function labelPolicyRule(code) {
  if (!code) return code
  if (POLICY_RULE_LABELS[code]) return POLICY_RULE_LABELS[code]
  if (code.startsWith('LOW_CLASSIFICATION_CONFIDENCE')) {
    return POLICY_RULE_LABELS.LOW_CLASSIFICATION_CONFIDENCE
  }
  return code
}

/**
 * Pipeline breakdown for a flagged pickup on the admin review screen.
 * Classifier = category; Policy validator = rule codes (no LLM); Notifier = review draft (LLM).
 * `insight` is agentInsight from GET /api/approvals/{id}; `note` when pipeline JSON is missing.
 */
export default function AgentInsightPanel({ insight, note, loading }) {
  if (loading) {
    return (
      <div className="ac-insight">
        <p>Loading pipeline insight…</p>
      </div>
    )
  }

  if (!insight) {
    return (
      <div className="ac-insight">
        <p>{note || 'No pipeline insight stored for this request.'}</p>
      </div>
    )
  }

  const confidencePct = Math.round((insight.confidence ?? 0) * 100)
  const notifierLabel = NOTIFIER_RECOMMENDATION_LABELS[insight.recommendation]
  const notifierBody = insight.adminSummary?.trim()
  const classifierBody = insight.classificationReasoning?.trim()
  const policyRules = insight.violatedRules?.length
    ? insight.violatedRules.map(labelPolicyRule)
    : []

  return (
    <div className="ac-insight">
      <p className="ac-insight-intro">Three pipeline steps relevant to this review:</p>

      <section className="ac-insight-block">
        <h4>
          <ScanSearch size={15} strokeWidth={2} aria-hidden="true" />
          Classifier
        </h4>
        <p className="ac-insight-meta">
          {insight.category || 'Unclassified'} · {confidencePct}% confident ·{' '}
          {insight.imageUsed ? 'photo analysed' : 'description only'}
        </p>
        {classifierBody && <p>{classifierBody}</p>}
      </section>

      <section className="ac-insight-block">
        <h4>
          <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
          Policy validator
        </h4>
        {policyRules.length > 0 ? (
          <ul className="ac-insight-rules">
            {policyRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : (
          <p className="ac-insight-muted">No policy rule violations recorded (may still be flagged for low confidence).</p>
        )}
        {insight.policyLlmReasoning?.trim() && (
          <p className="ac-insight-llm-note">
            <strong>Policy review note:</strong> {insight.policyLlmReasoning.trim()}
          </p>
        )}
      </section>

      <section className="ac-insight-block">
        <h4>
          <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
          Notifier
          {notifierLabel ? ` · ${notifierLabel}` : null}
        </h4>
        {notifierBody ? (
          <p>{notifierBody}</p>
        ) : insight.recommendationReasoning?.trim() ? (
          <p>{insight.recommendationReasoning.trim()}</p>
        ) : (
          <p className="ac-insight-muted">No notifier summary (pickup may predate the agent pipeline).</p>
        )}
        {insight.residentNotification?.trim() && (
          <p className="ac-insight-draft-inline">
            <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
            <span>
              <strong>Draft for resident:</strong> {insight.residentNotification.trim()}
            </span>
          </p>
        )}
      </section>
    </div>
  )
}
