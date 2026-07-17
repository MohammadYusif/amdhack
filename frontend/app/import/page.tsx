"use client"
// «جرّب ملفك» — score a real, consented bank statement through the same VANC
// pipeline as the demo personas. Two inputs: a raw statement PDF (anonymized
// in memory by /import-statement-pdf — same fail-closed anonymizer as the
// offline CLI, PDF never persisted) or the pre-anonymized JSON produced
// offline by backend/statement_pdf.py.
//
// The flow mirrors the persona demo deliberately: the same dark pipeline
// scanning screen (import-specific steps), then the same full-width officer
// dashboard layout as /banker/[id] — same header, grid, and panels — so an
// imported statement feels like the same service, not a side tool.
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { PhoneFrame } from "@/components/PhoneFrame"
import { AlinmaLogo } from "@/components/AlinmaShell"
import FactorBar from "@/components/FactorBar"
import ScoreGauge from "@/components/ScoreGauge"
import TierBadge from "@/components/TierBadge"
import RegulatoryXAIPanel from "@/components/RegulatoryXAIPanel"
import ForwardOutlookPanel from "@/components/ForwardOutlookPanel"
import UnderwriterAgent from "@/components/UnderwriterAgent"
import { importStatement, importStatementPdf } from "@/lib/api"
import { TIER_CONFIG } from "@/lib/config"
import type { ImportAssessment, ImportedStatement } from "@/lib/types"

const FACTOR_META: Record<string, { ar: string; en: string }> = {
  expense_discipline:    { ar: "انضباط المصروفات", en: "Expense discipline" },
  income_stability:      { ar: "استقرار الدخل", en: "Income stability" },
  client_diversity:      { ar: "تنوع مصادر الدخل", en: "Client diversity" },
  savings_behavior:      { ar: "سلوك الادخار", en: "Savings behavior" },
  contract_verification: { ar: "توثيق العقود", en: "Contract verification" },
}

const PROVENANCE_LABEL: Record<string, string> = {
  COMPUTED_FROM_IMPORTED_STATEMENT: "⚡ محسوب من كشفك",
  NOT_AVAILABLE_FOR_IMPORT: "بانتظار التصريح بالعملاء",
}

const EXCLUDED_LABEL: Record<string, string> = {
  SELF_TRANSFER: "تحويلات ذاتية بين حساباتك",
  CASH_DEPOSIT: "إيداعات نقدية (مصدر غير موثّق)",
  REFUND: "مبالغ مستردة من متاجر",
}

// Same visual language as the persona ScanningPhase — import-specific steps
const PIPELINE_STEPS = [
  { key: "bronze",    ar: "استخراج العمليات من الكشف — برونزي", icon: "🥉" },
  { key: "silver",    ar: "إخفاء الهوية وتوحيد الكيانات — فضي",  icon: "🛡️" },
  { key: "integrity", ar: "فحص السلامة مقابل ملخص الكشف",        icon: "✅" },
  { key: "factors",   ar: "حساب العوامل الأربعة من كشفك مباشرة",  icon: "⚡" },
  { key: "vanc",      ar: "تشغيل محرك تحليل مِهَن — VANC",        icon: "📊" },
]

function fmtSAR(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} ر.س`
}

function monthLabel(key: string): string {
  const months = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"]
  return `${months[parseInt(key.slice(5, 7), 10) - 1]} ${key.slice(2, 4)}`
}

const card: React.CSSProperties = {
  background: "var(--surface)", borderRadius: 18, padding: 16,
  border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", marginBottom: 14,
}

// Same panel style the banker detail page uses
const panel: React.CSSProperties = {
  background: "var(--surface)", borderRadius: 20,
  boxShadow: "var(--shadow-sm)", padding: 20,
}

/** Arabic message for a failure the user can act on.
 *  JSON.parse throws SyntaxError with a V8-authored English string — never
 *  show that. A failed fetch surfaces as TypeError ("Failed to fetch"),
 *  also English. Backend rejections (unparseable PDF, PII-scan refusal)
 *  arrive as plain Errors whose message is already Arabic. */
function arabicError(e: unknown): string {
  if (e instanceof SyntaxError || (e instanceof Error && e.message === "bad shape"))
    return "الملف غير صالح — اختر كشف حساب PDF أو ملف JSON المُنتَج من أداة إخفاء الهوية"
  if (e instanceof TypeError)
    return "تعذّر الاتصال بالخادم — تأكد أن الواجهة الخلفية تعمل على المنفذ 9000"
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع"
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<"pick" | "scanning" | "customer" | "officer">("pick")
  const [completedSteps, setCompletedSteps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportAssessment | null>(null)
  const [statement, setStatement] = useState<ImportedStatement | null>(null)
  const [showPayload, setShowPayload] = useState(false)
  const [liveAiBusy, setLiveAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  /** Run the request behind the same stepped pipeline animation the persona
   *  flow uses: steps tick on a minimum display time so the checkmarks are
   *  never faster than the eye, and the last step lands only when the real
   *  API response is in. */
  async function runPipeline(request: Promise<ImportAssessment>, anonFromPdf: boolean) {
    setPhase("scanning")
    setCompletedSteps(0)
    setError(null)
    const STEP_MIN_MS = 1000
    const stepper = (async () => {
      for (let i = 1; i <= 4; i++) {
        await sleep(STEP_MIN_MS)
        setCompletedSteps(i)
      }
    })()
    const res = await request
    await stepper
    await sleep(STEP_MIN_MS * 0.6)
    setCompletedSteps(5)
    if (anonFromPdf && res.anonymized_statement) setStatement(res.anonymized_statement)
    setResult(res)
    await sleep(700)
    // customer sees their own result first — the officer view comes after,
    // exactly like the persona journey
    setPhase("customer")
  }

  async function onFile(file: File) {
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await runPipeline(importStatementPdf(file), true)
        return
      }
      const parsed = JSON.parse(await file.text()) as ImportedStatement
      if (!Array.isArray(parsed.transactions)) throw new Error("bad shape")
      setStatement(parsed)
      await runPipeline(importStatement(parsed), false)
    } catch (e) {
      setPhase("pick")
      setError(arabicError(e))
    }
  }

  async function regenerateLive() {
    if (!statement || liveAiBusy) return
    setLiveAiBusy(true)
    setAiError(null)
    try {
      const res = await importStatement(statement, true)
      setResult(res)
    } catch (e) {
      setAiError(`${arabicError(e)} — النص المعروض من القالب`)
    } finally {
      setLiveAiBusy(false)
    }
  }

  function reset() {
    setPhase("pick"); setResult(null); setStatement(null)
    setCompletedSteps(0); setAiError(null); setShowPayload(false)
  }

  // ── OFFICER — full-width dashboard, same layout as /banker/[id] ──
  if (phase === "officer" && result) {
    return (
      <ImportOfficerDashboard
        result={result}
        aiError={aiError}
        liveAiBusy={liveAiBusy}
        showPayload={showPayload}
        setShowPayload={setShowPayload}
        onRegenerateLive={regenerateLive}
        canRegenerate={!!statement}
        onReset={reset}
        onExit={() => setPhase("customer")}
      />
    )
  }

  // ── PHONE-WRAPPED PHASES (pick + scanning + customer) ───────────
  // Plain conditional rendering (no AnimatePresence mode="wait"): the phase
  // swap must never wait on an exit animation — entry animations still play
  // via initial/animate on each phase.
  return (
    <PhoneFrame dark={phase === "scanning"}>
      <>
        {phase === "pick" && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
            {/* Header */}
            <div style={{
              background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
              padding: "14px 20px 22px", flexShrink: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => router.push("/demo")} style={{
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10, padding: "7px 10px", cursor: "pointer",
                    color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlinmaLogo size={26} />
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>ALINMA BANK</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>تمويل مِهَن</div>
                    </div>
                  </div>
                </div>
                <div style={{
                  background: "rgba(46,168,107,0.18)", border: "1px solid rgba(46,168,107,0.4)",
                  borderRadius: 10, padding: "5px 12px", color: "#5BC98F", fontSize: 11, fontWeight: 700,
                }}>
                  بيانات حقيقية
                </div>
              </div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                جرّب ملفك
              </div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                كشف حساب حقيقي — مجهّل الهوية — يُقيَّم بنفس محرك VANC
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 24px" }}>
              <div style={{ ...card, textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>
                  اختر كشف الحساب — PDF مباشرة أو JSON مجهّل
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.8, marginBottom: 18 }}>
                  ارفع كشف PDF وسيُجهّل داخل الذاكرة فقط — تُحذف الأسماء
                  والحسابات والبطاقات قبل أي حفظ أو تقييم، ولا يُخزَّن الملف الخام أبداً.
                </div>
                <input
                  ref={fileRef} type="file"
                  accept=".json,.pdf,application/json,application/pdf" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
                />
                <button onClick={() => fileRef.current?.click()} style={{
                  background: "linear-gradient(135deg, #1B6B4A, #14523A)", color: "#fff",
                  border: "none", borderRadius: 14, padding: "13px 28px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%",
                }}>
                  استيراد الملف
                </button>
                {error && (
                  <div style={{
                    marginTop: 14, background: "var(--tier-red-bg, #FDE8E8)", color: "var(--tier-red-text, #8B1A1A)",
                    borderRadius: 12, padding: "10px 14px", fontSize: 12, fontWeight: 600,
                  }}>
                    {error}
                  </div>
                )}
              </div>

              <div style={{ ...card, background: "var(--surface-2)", border: "none", boxShadow: "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
                  🔒 الخصوصية — ضمان ثلاثي الطبقات
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.9 }}>
                  <b>١.</b> الكشف يصل إلى خادم البنك فقط ويُعالج <b>في الذاكرة</b> —
                  الملف الخام لا يُحفظ أبداً.
                  <br />
                  <b>٢.</b> إخفاء الهوية يتم <b>عند الاستيراد وليس بعده</b> — فحص تسرّب
                  فاشل-مغلق يمنع أي اسم أو رقم حساب من المرور، والمرسِلون يظهرون
                  كرموز مستعارة فقط.
                  <br />
                  <b>٣.</b> لا يصل إلى نموذج الذكاء الاصطناعي سوى <b>خمس درجات رقمية</b> —
                  لا أسماء، لا عمليات، لا أرقام حسابات.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "scanning" && (
          <ImportScanningPhase key="scanning" completedSteps={completedSteps} />
        )}
        {phase === "customer" && result && (
          <CustomerResultPhase
            key="customer"
            result={result}
            onOfficer={() => setPhase("officer")}
            onBack={reset}
          />
        )}
      </>
    </PhoneFrame>
  )
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER RESULT — same look as the persona result screen
// ═══════════════════════════════════════════════════════════════
function ArcGauge({ score, color }: { score: number; color: string }) {
  const r = 88
  const cx = 100; const cy = 105
  const arcLen = Math.PI * r
  const offset = arcLen * (1 - score / 100)

  return (
    <svg viewBox="0 0 200 122" style={{ width: 220, margin: "0 auto", display: "block" }}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#EAE2DA" strokeWidth={16} strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={16} strokeLinecap="round"
        strokeDasharray={arcLen} strokeDashoffset={offset}
        className="score-gauge-fill"
      />
      <text x={cx} y={cy - 12} textAnchor="middle" style={{
        fontSize: 46, fontWeight: 800, fill: color,
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}>
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" style={{
        fontSize: 11, fill: "#8A96A4",
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}>
        نتيجة مِهَن / ١٠٠
      </text>
    </svg>
  )
}

function FactorRow({ label, weight, value, color, source }: {
  label: string; weight: string; value: number; color: string; source?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          {label} <span style={{ color: "var(--text-3)", fontSize: 10 }}>({weight})</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }} dir="ltr">{value}</span>
      </div>
      <div className="factor-bar-track">
        <div className="factor-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      {source && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 8, color: color }}>◆</span>
          <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>المصدر: {source}</span>
        </div>
      )}
    </div>
  )
}

function CustomerResultPhase({ result, onOfficer, onBack }: {
  result: ImportAssessment
  onOfficer: () => void
  onBack: () => void
}) {
  const [showPayload, setShowPayload] = useState(false)
  const score = result.score
  const tier = score.tier
  const tc = TIER_CONFIG[tier]
  const loan = score.loan

  const FACTOR_SOURCES: Record<string, string> = {
    expense_discipline:    "⚡ محسوب من كشفك — نسبة المصروفات",
    income_stability:      "⚡ محسوب من كشفك — CV",
    client_diversity:      "⚡ محسوب من كشفك — مؤشر HHI",
    savings_behavior:      "⚡ محسوب من كشفك — صافي التدفق",
    contract_verification: "بانتظار التصريح بالعملاء — Wathq",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)", position: "relative" }}
    >
      {/* Header — same as the persona result screen */}
      <div style={{
        background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
        padding: "14px 20px 20px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "7px 10px", cursor: "pointer",
          color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>نتيجة التقييم</div>
        <span style={{
          background: "rgba(46,168,107,0.18)", border: "1px solid rgba(46,168,107,0.4)",
          borderRadius: 10, padding: "5px 12px", color: "#5BC98F", fontSize: 11, fontWeight: 700,
        }}>
          بيانات حقيقية
        </span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 16px 24px" }}>

        {/* Score gauge — same card as the persona result */}
        <div style={{
          background: "var(--surface)", borderRadius: 20, padding: "20px 16px 16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)", textAlign: "center",
        }}>
          <ArcGauge score={score.composite} color={tc.color} />
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <span style={{
              background: tc.bg, color: tc.color, fontWeight: 700, fontSize: 13,
              padding: "5px 14px", borderRadius: 99,
            }}>
              {tier === "GREEN" ? "✓ مؤهّل للتمويل" : tier === "YELLOW" ? "تمويل مشروط" : "قيد التأهيل"}
            </span>
          </div>
          {tier === "BUILDING" && (
            <div style={{
              marginTop: 10, padding: "6px 12px",
              background: "var(--tier-red-bg, #FDE8E8)", borderRadius: 10,
              fontSize: 11, color: "var(--tier-red-text, #8B1A1A)", fontWeight: 600,
            }}>
              لا تمويل حالياً — خطة التحسين أدناه ترسم مسارك
            </div>
          )}
          {/* Key income metrics */}
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            {[
              { label: "أدنى دخل شهري", value: score.worst_month_income.toLocaleString(), unit: "ريال" },
              { label: "طاقة السداد", value: score.repayment_capacity.toLocaleString(), unit: "ريال/شهر" },
            ].map(m => (
              <div key={m.label} style={{ textAlign: "center", padding: "4px 0" }}>
                <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-1)" }} dir="ltr">
                  {m.value}
                  <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text-3)", marginRight: 3 }}> {m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Factor bars — same card style as the persona result */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
            عوامل التقييم الائتماني
          </div>
          {[
            { key: "expense_discipline",    label: "انضباط المصروفات", weight: "30%" },
            { key: "income_stability",      label: "استقرار الدخل",    weight: "25%" },
            { key: "client_diversity",      label: "تنوع العملاء",     weight: "20%" },
            { key: "savings_behavior",      label: "سلوك الادخار",     weight: "15%" },
            { key: "contract_verification", label: "توثيق العقود",     weight: "10%" },
          ].map(f => (
            <FactorRow
              key={f.key}
              label={f.label}
              weight={f.weight}
              value={result.effective_factors[f.key as keyof typeof result.effective_factors]}
              color={tc.color}
              source={FACTOR_SOURCES[f.key]}
            />
          ))}
        </div>

        {/* AI explanation — same ai-badge card as the persona result */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "14px 16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="ai-badge">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              تحليل مِهَن
            </span>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>ذكاء اصطناعي</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.75 }}>
            {result.explanation.ar}
          </p>
          {/* Transparency: the literal, complete payload the AI model received */}
          <button onClick={() => setShowPayload(s => !s)} style={{
            width: "100%", marginTop: 12,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "9px 0", fontSize: 11.5, fontWeight: 700,
            color: "var(--text-2)", cursor: "pointer", fontFamily: "inherit",
          }}>
            {showPayload ? "إخفاء التفاصيل ▲" : "🔒 ماذا وصل للذكاء الاصطناعي عنك؟"}
          </button>
          {showPayload && (
            <div style={{ marginTop: 10, background: "#02141E", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10.5, color: "#5BC98F", fontWeight: 700, marginBottom: 8 }}>
                هذا كل ما وصل للنموذج — حرفياً:
              </div>
              <pre dir="ltr" style={{
                margin: 0, fontSize: 10, color: "#5BC98F",
                whiteSpace: "pre-wrap", fontFamily: "monospace",
              }}>
                {result.explanation.ai_privacy.payload_sent_to_ai.user_message}
              </pre>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 8, lineHeight: 1.7 }}>
                {result.explanation.ai_privacy.note_ar}
              </div>
            </div>
          )}
        </div>

        {/* Loan offer or improvement roadmap — same treatment as personas */}
        {tier === "BUILDING" ? (
          <div style={{
            background: "var(--surface)", borderRadius: 18, padding: "16px",
            marginBottom: 14, boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>خطة تحسين درجتك</div>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.7 }}>
              {result.roadmap.summary_ar}
            </p>
            {result.roadmap.actions.slice(0, 4).map((action, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", borderRadius: 12, marginBottom: 8,
                background: "var(--surface-2)",
              }}>
                <span style={{
                  fontWeight: 800, fontSize: 12, color: "#D4900A",
                  background: "#FEF5E4", padding: "2px 7px", borderRadius: 8,
                  flexShrink: 0,
                }} dir="ltr">
                  +{action.projected_gain}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                  {action.action_ar}
                </span>
              </div>
            ))}
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
              النتيجة المتوقعة: <strong style={{ color: "#D4900A" }}>{result.roadmap.projected_score}</strong>
            </div>
          </div>
        ) : loan ? (
          <div style={{
            background: "linear-gradient(135deg, #02141E 0%, #033957 100%)",
            borderRadius: 18, overflow: "hidden", marginBottom: 14,
            boxShadow: "0 8px 24px rgba(2,20,30,0.3)",
          }}>
            <div style={{ padding: "14px 16px 0" }}>
              <div style={{ color: "#CD907E", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                عرض التمويل المعتمد
              </div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 1, background: "rgba(255,255,255,0.06)", margin: "10px 0 0",
            }}>
              {[
                { label: "مبلغ التمويل", value: `${loan.amount.toLocaleString()} ريال` },
                { label: "المدة",        value: `${loan.duration_months} شهر` },
                { label: "نسبة الربح",   value: `${loan.apr}%` },
                { label: "القسط الشهري", value: `${loan.monthly_installment.toLocaleString()} ريال` },
              ].map(f => (
                <div key={f.label} style={{
                  padding: "14px", background: "rgba(255,255,255,0.04)",
                  textAlign: "center",
                }}>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginBottom: 5 }}>
                    {f.label}
                  </div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }} dir="ltr">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 14 }} />
          </div>
        ) : null}

        {/* Actions — continue to the officer view, same as personas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onOfficer}
            style={{
              width: "100%", padding: "15px",
              background: "linear-gradient(135deg, #033957 0%, #02141E 100%)",
              color: "#fff", border: "none", borderRadius: 14,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 6px 18px rgba(2,20,30,0.3)",
            }}
          >
            الانتقال للوحة مسؤول الائتمان
          </motion.button>
          <button
            onClick={onBack}
            style={{
              width: "100%", padding: "13px",
              background: "transparent", color: "var(--text-3)",
              border: "1px solid var(--border)", borderRadius: 14,
              fontSize: 13, cursor: "pointer",
            }}
          >
            استيراد ملف آخر
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCANNING — identical visual language to the persona pipeline screen
// ═══════════════════════════════════════════════════════════════
function ImportScanningPhase({ completedSteps }: { completedSteps: number }) {
  const progress = (completedSteps / 5) * 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ flex: 1, display: "flex", flexDirection: "column", background: "#02141E" }}
    >
      {/* Header */}
      <div style={{ padding: "20px 20px 16px", textAlign: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 6, letterSpacing: "0.5px" }}>
          محرك التحليل الائتماني · مِهَن
        </div>
        <motion.div
          key={completedSteps === 5 ? "done" : "loading"}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}
        >
          {completedSteps === 5 ? "✓ اكتمل التحليل" : "جارٍ التحليل..."}
        </motion.div>

        {/* Progress bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            height: 4, background: "rgba(255,255,255,0.08)",
            borderRadius: 99, overflow: "hidden",
          }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{
                height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg, #9A8CB9, #CD907E)",
              }}
            />
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>
            {completedSteps} / 5 خطوات
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, padding: "4px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < completedSteps
          const active = i === completedSteps && completedSteps < 5

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 16,
                background: done
                  ? "rgba(26,107,58,0.18)"
                  : active
                    ? "rgba(154,140,185,0.12)"
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${
                  done ? "rgba(26,107,58,0.4)"
                  : active ? "rgba(154,140,185,0.35)"
                  : "rgba(255,255,255,0.05)"
                }`,
                animation: active ? "stepPulse 2s ease-in-out infinite" : undefined,
                transition: "all 0.4s ease",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: done
                  ? "rgba(26,107,58,0.35)"
                  : active ? "rgba(154,140,185,0.25)"
                  : "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 4.5" stroke="#5CB88A" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="20" style={{ animation: "checkIn 0.4s ease both" }} />
                  </svg>
                ) : active ? (
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(154,140,185,0.3)",
                    borderTopColor: "#ACA8FF",
                    animation: "spin 0.7s linear infinite",
                  }} />
                ) : (
                  <span>{step.icon}</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  color: done ? "#5CB88A" : active ? "#BEB9F0" : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: done || active ? 600 : 400,
                  transition: "color 0.3s",
                }}>
                  {step.ar}
                </div>
                {active && (
                  <div style={{ color: "rgba(154,140,185,0.6)", fontSize: 10, marginTop: 2 }}>
                    جارٍ المعالجة...
                  </div>
                )}
                {done && (
                  <div style={{ color: "rgba(26,107,58,0.6)", fontSize: 10, marginTop: 2 }}>
                    مكتمل
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// RESULT — full-width officer dashboard, same layout as /banker/[id]
// ═══════════════════════════════════════════════════════════════
function ImportOfficerDashboard({
  result, aiError, liveAiBusy, showPayload, setShowPayload,
  onRegenerateLive, canRegenerate, onReset, onExit,
}: {
  result: ImportAssessment
  aiError: string | null
  liveAiBusy: boolean
  showPayload: boolean
  setShowPayload: (fn: (s: boolean) => boolean) => void
  onRegenerateLive: () => void
  canRegenerate: boolean
  onReset: () => void
  onExit: () => void
}) {
  const score = result.score
  const buckets = Object.entries(result.monthly_buckets)
  const maxFlow = Math.max(1, ...buckets.flatMap(([, v]) => [v.income, v.expenses]))
  const minIncomeMonth = buckets.length
    ? buckets.reduce((min, cur) => (cur[1].income < min[1].income ? cur : min))[0]
    : null
  const excluded: Record<string, number> =
    result.evidence?.client_diversity?.excluded_credits ?? {}

  // Integrity — judge only the sides the statement actually printed
  const depReported = result.integrity.reported_total_deposits != null
  const wdReported = result.integrity.reported_total_withdrawals != null
  const verifiable = depReported || wdReported
  const integrityOk = (!depReported || result.integrity.deposits_match)
    && (!wdReported || result.integrity.withdrawals_match)

  return (
    <div className="banker-page">

      {/* Header — same banker-header as the persona officer view */}
      <header className="banker-header" style={{ gap: 16, justifyContent: "flex-start" }}>
        <AlinmaLogo size={28} />
        <button onClick={onExit} style={{
          color: "rgba(255,255,255,0.7)", fontSize: 12, background: "none",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          ← عودة لشاشة العميل
        </button>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />

        <div style={{ flex: 1 }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
            كشف حساب مستورد — مجهّل الهوية
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }} dir="ltr">
            {result.transaction_count} tx · {result.period.start} → {result.period.end}
          </p>
        </div>

        <span style={{
          background: "rgba(46,168,107,0.18)", border: "1px solid rgba(46,168,107,0.4)",
          borderRadius: 99, padding: "4px 12px", color: "#5BC98F", fontSize: 11, fontWeight: 700,
        }}>
          بيانات حقيقية
        </span>
        <TierBadge tier={score.tier} size="md" isEn={false} />
        <button onClick={onReset} style={{
          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
          padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
        }}>
          استيراد ملف آخر
        </button>
      </header>

      <div className="banker-content banker-detail-grid">

        {/* ── Left column — scores (same order as /banker/[id]) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score panel */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
              نتيجة مِهَن
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <ScoreGauge score={score.composite} tier={score.tier} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["أدنى شهر", `SAR ${score.worst_month_income.toLocaleString()}`],
                  ["الطاقة الاستيعابية", `SAR ${score.repayment_capacity.toLocaleString()}`],
                  ["عدد العمليات", `${result.transaction_count}`],
                  ["فترة الكشف", `${buckets.length} أشهر`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{label}: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}
                      dir="ltr" className="ltr">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Factor breakdown */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
              تفاصيل العوامل — ٤ منها محسوبة من كشفك مباشرة
            </p>
            {Object.entries(FACTOR_META).map(([key, meta]) => (
              <div key={key}>
                <FactorBar
                  labelAr={meta.ar} labelEn={meta.en}
                  score={result.effective_factors[key as keyof typeof result.effective_factors]}
                />
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: -8, marginBottom: 12 }}>
                  {PROVENANCE_LABEL[result.evidence[key]?.provenance] ?? result.evidence[key]?.provenance}
                </div>
              </div>
            ))}
          </div>

          {/* Integrity — the import's counterpart to the SIMAH panel slot */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
              فحص سلامة الكشف
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: !verifiable ? "var(--text-3)"
                  : integrityOk ? "var(--tier-green-text)" : "var(--tier-red-text)",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: !verifiable ? "var(--text-2)"
                  : integrityOk ? "var(--tier-green-text)" : "var(--tier-red-text)",
              }}>
                {!verifiable
                  ? "الكشف لا يتضمن ملخصاً مطبوعاً للمقارنة"
                  : integrityOk
                    ? "المجاميع مطابقة لملخص الكشف المطبوع"
                    : "المجاميع لا تطابق ملخص الكشف — تُحال للمراجعة"}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }} dir="ltr" className="ltr">
              {fmtSAR(result.integrity.parsed_total_deposits)} in · {fmtSAR(result.integrity.parsed_total_withdrawals)} out
            </p>
            {/* Medallion provenance strip */}
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {[
                { icon: "🥉", title: "خام", sub: `${result.transaction_count} عملية · لا يُحفظ` },
                {
                  icon: "🥈", title: "منقّى",
                  sub: (() => {
                    const sv = result.pipeline?.silver
                    if (sv?.entities_resolved == null) return "مجهّل الهوية"
                    const merged = sv.name_variants_merged ?? 0
                    return merged > 0
                      ? `${sv.raw_sender_names} اسم ← ${sv.entities_resolved} كيان`
                      : `${sv.entities_resolved} كيان · موحّد بالهوية`
                  })(),
                },
                { icon: "🥇", title: "ذهبي", sub: "٤ عوامل حيّة · VANC" },
              ].map(s => (
                <div key={s.title} style={{
                  flex: 1, background: "var(--surface-2)", borderRadius: 12,
                  padding: "8px 6px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 14 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-1)" }}>{s.title}</div>
                  <div style={{ fontSize: 8.5, color: "var(--text-3)", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Forward-Looking Default Probability */}
          {result.forward_outlook && <ForwardOutlookPanel outlook={result.forward_outlook} isEn={false} />}

          {/* Regulatory Explainability (XAI) */}
          {result.regulatory_explainability && (
            <RegulatoryXAIPanel xai={result.regulatory_explainability} isEn={false} />
          )}
        </div>

        {/* ── Right column — decisions (same order as /banker/[id]) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Autonomous Underwriting Agent */}
          {result.underwriter_recommendation && (
            <UnderwriterAgent
              profileId="imported-statement"
              recommendation={result.underwriter_recommendation}
              isEn={false}
            />
          )}

          {/* AI explanation */}
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="ai-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill="currentColor" />
                </svg>
                ذكاء اصطناعي
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                تفسير مُنشأ بالذكاء الاصطناعي
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                marginRight: "auto",
                background: result.explanation.source === "claude-live" ? "#E8F0FE" : "var(--surface-2)",
                color: result.explanation.source === "claude-live" ? "#1A56DB" : "var(--text-3)",
              }}>
                {result.explanation.source === "claude-live" ? "Claude — مباشر" : "قالب فوري"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
              {result.explanation.ar}
            </p>
            {aiError && (
              <div style={{
                marginTop: 10, background: "var(--tier-red-bg, #FDE8E8)",
                color: "var(--tier-red-text, #8B1A1A)", borderRadius: 10,
                padding: "8px 12px", fontSize: 11, fontWeight: 600,
              }}>
                {aiError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {canRegenerate && (
                <button onClick={onRegenerateLive} disabled={liveAiBusy} style={{
                  flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "9px 0", fontSize: 11.5, fontWeight: 700,
                  color: "var(--text-2)", cursor: liveAiBusy ? "wait" : "pointer", fontFamily: "inherit",
                }}>
                  {liveAiBusy ? "جارٍ التوليد…" : "🤖 توليد مباشر عبر Claude"}
                </button>
              )}
              <button onClick={() => setShowPayload(s => !s)} style={{
                flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "9px 0", fontSize: 11.5, fontWeight: 700,
                color: "var(--text-2)", cursor: "pointer", fontFamily: "inherit",
              }}>
                🔒 ماذا يصل للنموذج؟
              </button>
            </div>
            {showPayload && (
              <div style={{ marginTop: 10, background: "#02141E", borderRadius: 12, padding: 12 }}>
                <pre dir="ltr" style={{
                  margin: 0, fontSize: 10, color: "#5BC98F",
                  whiteSpace: "pre-wrap", fontFamily: "monospace",
                }}>
                  {result.explanation.ai_privacy.payload_sent_to_ai.user_message}
                </pre>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 8, lineHeight: 1.7 }}>
                  {result.explanation.ai_privacy.note_ar}
                </div>
              </div>
            )}
          </div>

          {/* Loan recommendation or roadmap */}
          {score.loan ? (
            <div style={panel}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
                توصية التمويل
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["مبلغ التمويل", `SAR ${score.loan.amount.toLocaleString()}`],
                  ["مدة السداد", `${score.loan.duration_months} شهراً`],
                  ["نسبة الربح", `${score.loan.apr}%`],
                  ["القسط الشهري", `SAR ${score.loan.monthly_installment.toLocaleString()}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={panel}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
                خارطة التحسين — من {result.roadmap.current_score} إلى{" "}
                <span style={{ color: "var(--tier-green-text, #1A6B3A)" }}>{result.roadmap.projected_score}</span>
              </p>
              {result.roadmap.actions.map((a, i) => (
                <div key={a.action_en} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: i < result.roadmap.actions.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    background: "var(--tier-green-bg, #E8F5ED)", color: "var(--tier-green-text, #1A6B3A)",
                    borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800,
                    flexShrink: 0,
                  }} dir="ltr">
                    +{a.projected_gain}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-1)" }}>{a.action_ar}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }} dir="ltr">
                      ~{a.timeline_days}d · {a.difficulty}
                    </div>
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 10, lineHeight: 1.8 }}>
                {result.roadmap.summary_ar}
              </p>
            </div>
          )}

          {/* Monthly cash flow */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
              التدفق النقدي الشهري — من كشفك الحقيقي
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, direction: "ltr" }}>
              {buckets.map(([month, v]) => (
                <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 84 }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(3, (v.income / maxFlow) * 84) }}
                      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                      style={{
                        width: 8, borderRadius: 3,
                        background: month === minIncomeMonth ? "var(--tier-red-text, #C0392B)" : "#1B6B4A",
                        animation: month === minIncomeMonth ? "worstPulse 1.6s ease-in-out infinite" : undefined,
                      }}
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(3, (v.expenses / maxFlow) * 84) }}
                      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                      style={{ width: 8, borderRadius: 3, background: "var(--border)" }}
                    />
                  </div>
                  <span style={{ fontSize: 8, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                    {monthLabel(month)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10.5, color: "var(--text-3)" }}>
              <span><span style={{ color: "#1B6B4A" }}>■</span> دخل معتمد</span>
              <span><span style={{ color: "var(--border)" }}>■</span> مصروفات</span>
              <span><span style={{ color: "var(--tier-red-text, #C0392B)" }}>■</span> أدنى شهر — أساس السداد</span>
            </div>
          </div>

          {/* Excluded income — the anti-inflation control */}
          {Object.keys(excluded).length > 0 && (
            <div style={{ ...panel, border: "1px solid rgba(200,150,26,0.35)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
                🛡️ مبالغ استُبعدت من الدخل — حماية من تضخيم الدخل
              </p>
              {Object.entries(excluded).map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: "var(--text-2)", marginBottom: 6,
                }}>
                  <span>{EXCLUDED_LABEL[k] ?? k}</span>
                  <b dir="ltr">{fmtSAR(v)}</b>
                </div>
              ))}
              <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, lineHeight: 1.7 }}>
                المحرك لا يجامل: تحويل أموالك بين حساباتك ليس دخلاً،
                والنقد غير القابل للتتبع لا يُحتسب.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
