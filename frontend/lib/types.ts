export interface Profile {
  id: string
  name_ar: string
  name_en: string
  profession_ar: string
  profession_en: string
  avatar_initials: string
}

export interface FactorScores {
  expense_discipline: number
  income_stability: number
  client_diversity: number
  savings_behavior: number
  contract_verification: number
}

export interface LoanRecommendation {
  amount: number
  duration_months: number
  apr: number
  monthly_installment: number
  is_dbr_compressed: boolean
}

export interface MihanScore {
  composite: number
  tier: "GREEN" | "YELLOW" | "BUILDING"
  factors: FactorScores
  loan: LoanRecommendation | null
  worst_month_income: number
  repayment_capacity: number
  max_installment: number
  phase: string
  dbr_cap_pct: number
  vanc_income: number | null
  vanc_mean?: number | null
  vanc_sigma?: number | null
}

export interface WathqResult {
  cr: string
  trade_name_ar: string
  trade_name_en: string
  status: string
  verified: boolean
  risk_flag: string | null
  months_active: number
  message_ar: string
  message_en: string
  declared_name: string
  source?: "WATHQ_LIVE" | "SIMULATED"
}

export interface SimahReport {
  file_type: "THIN" | "EMPTY"
  total_facilities: number
  exception_sandbox_applicable: boolean
  exception_sandbox_triggered: boolean
  note_ar: string
  note_en: string
}

export interface FullAssessment {
  profile: Profile & { selected_buffer: string }
  pipeline: {
    step1_kyc:      { status: string; method: string }
    step2_lean_ais: { status: string; transactions_pulled: number; months: number }
    step3_simah:    { status: string; file_type: string }
    step4_wathq:   { status: string; clients_verified: number; total_clients: number }
    step5_scoring:  { status: string; composite: number; tier: string }
  }
  score: MihanScore
  simah: SimahReport
  wathq_results: WathqResult[]
  exception_sandbox_triggered: boolean
  loan_recommendation: LoanRecommendation | null
  next_step: "APPROVE_FOR_REVIEW" | "IMPROVEMENT_ROADMAP"
}

// ── Real-statement import (جرّب ملفك) ──

export interface ImportedTransaction {
  date: string
  type: string
  debit: number
  credit: number
  counterparty: string
  category: string
}

export interface ImportedStatement {
  period_start: string
  period_end: string
  currency: string
  opening_balance: number
  reported_total_deposits: number | null
  reported_total_withdrawals: number | null
  transactions: ImportedTransaction[]
}

export interface ImportAssessment {
  source: string
  anonymization: string
  // medallion pipeline provenance (bronze → silver → gold), counts only
  pipeline: {
    bronze: { stage: string; persisted: boolean; note?: string }
    silver: {
      stage: string
      raw_sender_names?: number
      entities_resolved?: number
      name_variants_merged?: number
      self_transfer_entities?: number
      pii_scan?: string
      note?: string
    }
    gold: { stage: string; factors_computed_live: number; engine: string }
  }
  period: { start: string; end: string }
  transaction_count: number
  monthly_buckets: Record<string, { income: number; expenses: number }>
  effective_factors: FactorScores
  // per-factor evidence map: provenance + method-specific numbers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidence: Record<string, Record<string, any>>
  score: MihanScore
  integrity: {
    parsed_total_deposits: number
    reported_total_deposits: number | null
    parsed_total_withdrawals: number
    reported_total_withdrawals: number | null
    deposits_match: boolean
    withdrawals_match: boolean
  }
  roadmap: Roadmap
  explanation: {
    ar: string
    en: string
    source: "template" | "claude-live"
    ai_privacy: {
      payload_sent_to_ai: { model: string; system: string; user_message: string }
      note_en: string
      note_ar: string
    }
  }
  // decision-intelligence layer — same blocks the persona dashboards render
  regulatory_explainability: RegulatoryExplainability
  forward_outlook: ForwardOutlook
  underwriter_recommendation: UnderwriterRecommendation
  // only on /import-statement-pdf responses: the zero-PII statement that
  // survived in-memory anonymization (reused for live-AI regeneration)
  anonymized_statement?: ImportedStatement
}

// ── Regulatory Explainability (XAI) ──

export interface PrincipalFactor {
  factor: string
  label_ar: string
  label_en: string
  score: number
  weight_pct: number
  weighted_points: number
  contribution_pct: number
}

export interface AdverseReason {
  code: string
  reason_ar: string
  reason_en: string
}

export interface RegulatoryExplainability {
  profile_id?: string
  source: string
  decision: "APPROVE_FOR_OFFICER_REVIEW" | "DECLINE_NO_OFFER_WITH_ROADMAP"
  composite: number
  tier: string
  principal_factors: PrincipalFactor[]
  dbr_justification: {
    income_basis_sar: number
    income_basis_method_en: string
    income_basis_method_ar: string
    dbr_cap_pct: number
    max_affordable_installment_sar: number
    offered_installment_sar: number
    installment_headroom_sar: number
    dbr_compressed: boolean
    affordability_flag: string
    citation_en: string
    citation_ar: string
  }
  adverse_action: {
    is_adverse: boolean
    outcome: "DECLINED_NO_OFFER" | "OFFER_REDUCED"
    principal_reasons: AdverseReason[]
    notice_ar: string
    notice_en: string
  } | null
  cautionary: {
    has_caution: boolean
    marginal_approval: {
      code: string
      margin_above_threshold: number
      reason_ar: string
      reason_en: string
    } | null
    watch_factors: {
      code: string
      label_ar: string
      label_en: string
      score: number
      reason_ar: string
      reason_en: string
    }[]
    notice_ar: string
    notice_en: string
  } | null
  fairness_check: {
    attestation_type: string
    protected_attributes_used_in_score: string[]
    protected_attributes_excluded: { ar: string; en: string }[]
    scored_inputs: string[]
    model_type: string
    model_note_en: string
    model_note_ar: string
    ai_payload_pii_exposure: string
    ai_payload_note_en: string
    human_in_the_loop: boolean
    human_note_en: string
  }
  auditability: {
    deterministic: boolean
    reproducible_from: string
    content_hash: string
    hash_algorithm: string
    logged_to_sama_audit: boolean
    note_en: string
  }
  point_in_time?: {
    issued_at: string
    record_hash: string
    hash_algorithm: string
  }
  standards_referenced: string[]
}

// ── Predictive Behavioral Intelligence (forward outlook) ──

export interface OutlookSignal {
  signal: string
  label_ar: string
  label_en: string
  risk_value: number
  coefficient: number
  contribution: number
}

export interface ForwardOutlook {
  profile_id?: string
  horizon_months: number
  default_probability_6m_pct: number
  risk_band: "LOW" | "MODERATE" | "ELEVATED" | "HIGH"
  trend_direction: "IMPROVING" | "STABLE" | "DETERIORATING"
  trend_pct_per_month: number
  intercept: number
  signals: OutlookSignal[]
  hybrid_inputs: string[]
  method: {
    model_type: string
    learned_parameters: boolean
    formula: string
    note_en: string
    note_ar: string
  }
}

// ── Autonomous Underwriting Agent ──

export interface UnderwriterRecommendation {
  action:
    | "APPROVE_ROUTE_TO_OFFICER"
    | "APPROVE_WITH_CONDITIONS"
    | "DECLINE_ISSUE_ROADMAP"
  headline_en: string
  headline_ar: string
  rationale_en: string[]
  rationale_ar: string[]
  conditions: { en: string; ar: string }[]
  confidence: "HIGH" | "MEDIUM"
  source: "template" | "claude-live"
  disclaimer_en: string
  disclaimer_ar: string
}

export interface AgentAnswer {
  profile_id?: string
  question?: string
  answer_en: string
  // null on live-Claude answers (the model answers in the question's
  // language directly); template answers always carry both languages
  answer_ar?: string | null
  grounding: string[]
  source: "template" | "claude-live"
}

export interface RoadmapAction {
  action_ar: string
  action_en: string
  factor: string
  projected_gain: number
  timeline_days: number
  difficulty: "low" | "medium" | "high"
}

export interface Roadmap {
  current_score: number
  current_tier: string
  projected_score: number
  projected_tier: string
  actions: RoadmapAction[]
  summary_ar: string
  summary_en: string
}
