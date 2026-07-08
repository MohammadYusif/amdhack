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
