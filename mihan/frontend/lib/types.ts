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

export interface WathiqResult {
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
    step4_wathiq:   { status: string; clients_verified: number; total_clients: number }
    step5_scoring:  { status: string; composite: number; tier: string }
  }
  score: MihanScore
  simah: SimahReport
  wathiq_results: WathiqResult[]
  exception_sandbox_triggered: boolean
  loan_recommendation: LoanRecommendation | null
  next_step: "APPROVE_FOR_REVIEW" | "IMPROVEMENT_ROADMAP"
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
