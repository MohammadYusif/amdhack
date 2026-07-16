"use client"
// «جرّب ملفك» — score a real, consented, pre-anonymized bank statement
// through the same VANC pipeline as the demo personas. The JSON this screen
// accepts is produced offline by backend/statement_pdf.py (PII stripped at
// ingestion); nothing identifying ever reaches the browser or the API.
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { PhoneFrame } from "@/components/PhoneFrame"
import { AlinmaLogo } from "@/components/AlinmaShell"
import FactorBar from "@/components/FactorBar"
import ScoreGauge from "@/components/ScoreGauge"
import { importStatement } from "@/lib/api"
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

const TIER_AR: Record<string, string> = {
  GREEN: "أخضر — مؤهّل",
  YELLOW: "أصفر — مشروط",
  BUILDING: "قيد التأهيل",
}

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

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: "var(--text-1)", marginBottom: 12,
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<"pick" | "analyzing" | "result">("pick")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportAssessment | null>(null)
  const [statement, setStatement] = useState<ImportedStatement | null>(null)
  const [showPayload, setShowPayload] = useState(false)
  const [liveAiBusy, setLiveAiBusy] = useState(false)

  async function analyze(stmt: ImportedStatement) {
    setPhase("analyzing")
    setError(null)
    // let the analyzing animation breathe — the API itself is instant
    const [res] = await Promise.all([
      importStatement(stmt),
      new Promise(r => setTimeout(r, 2200)),
    ])
    setResult(res)
    setPhase("result")
  }

  async function onFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as ImportedStatement
      if (!Array.isArray(parsed.transactions)) throw new Error("bad shape")
      setStatement(parsed)
      await analyze(parsed)
    } catch (e) {
      setPhase("pick")
      setError(
        e instanceof Error && e.message !== "bad shape" && e.message !== "Unexpected token"
          ? e.message
          : "الملف غير صالح — اختر ملف JSON المُنتَج من أداة إخفاء الهوية"
      )
    }
  }

  async function regenerateLive() {
    if (!statement || liveAiBusy) return
    setLiveAiBusy(true)
    try {
      const res = await importStatement(statement, true)
      setResult(res)
    } finally {
      setLiveAiBusy(false)
    }
  }

  const buckets = result ? Object.entries(result.monthly_buckets) : []
  const maxFlow = Math.max(1, ...buckets.flatMap(([, v]) => [v.income, v.expenses]))
  const minIncomeMonth = buckets.length
    ? buckets.reduce((min, cur) => (cur[1].income < min[1].income ? cur : min))[0]
    : null
  const excluded: Record<string, number> =
    result?.evidence?.client_diversity?.excluded_credits ?? {}

  return (
    <PhoneFrame>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
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

            {phase === "pick" && (
              <motion.div key="pick" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ ...card, textAlign: "center", padding: "28px 20px" }}>
                  <div style={{ fontSize: 42, marginBottom: 12 }}>📄</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>
                    اختر ملف كشف الحساب المجهّل
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.8, marginBottom: 18 }}>
                    الملف يُنتَج محلياً من كشف PDF عبر أداة إخفاء الهوية —
                    تُحذف الأسماء والحسابات والبطاقات قبل أن يغادر أي بيان جهازك.
                  </div>
                  <input
                    ref={fileRef} type="file" accept=".json,application/json" hidden
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
                    🔒 الخصوصية أولاً
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.9 }}>
                    إخفاء الهوية يتم <b>عند الاستيراد وليس بعده</b> — فحص تسرّب فاشل-مغلق
                    يمنع أي اسم أو رقم حساب من المرور. المرسِلون يظهرون كرموز مستعارة فقط،
                    ولا يصل إلى نموذج الذكاء الاصطناعي سوى خمس درجات رقمية.
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "analyzing" && (
              <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  style={{
                    width: 56, height: 56, borderRadius: "50%",
                    border: "4px solid var(--surface-2)", borderTopColor: "#1B6B4A", marginBottom: 24,
                  }}
                />
                {["تحليل التدفق النقدي الشهري…", "استبعاد التحويلات الذاتية والإيداعات النقدية…", "حساب العوامل الأربعة من كشفك مباشرة…"].map((txt, i) => (
                  <motion.div key={txt}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.6 }}
                    style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10, fontWeight: 600 }}>
                    {txt}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {phase === "result" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

                {/* Medallion pipeline strip — bronze → silver → gold */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, direction: "rtl" }}>
                  {[
                    { icon: "🥉", title: "خام", sub: `${result.transaction_count} عملية · لا يُحفظ` },
                    {
                      icon: "🥈", title: "منقّى",
                      sub: (() => {
                        const sv = result.pipeline?.silver
                        if (sv?.entities_resolved == null) return "مجهّل الهوية"
                        const merged = sv.name_variants_merged ?? 0
                        // show the merge story when there is one; otherwise
                        // state the honest distinct-entity count
                        return merged > 0
                          ? `${sv.raw_sender_names} اسم ← ${sv.entities_resolved} كيان`
                          : `${sv.entities_resolved} كيان · موحّد بالهوية`
                      })(),
                    },
                    { icon: "🥇", title: "ذهبي", sub: "٤ عوامل حيّة · VANC" },
                  ].map((s, i) => (
                    <motion.div key={s.title}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.15 }}
                      style={{
                        flex: 1, background: "var(--surface)", borderRadius: 14,
                        border: "1px solid var(--border)", padding: "8px 6px", textAlign: "center",
                      }}>
                      <div style={{ fontSize: 15 }}>{s.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-1)" }}>{s.title}</div>
                      <div style={{ fontSize: 8.5, color: "var(--text-3)", marginTop: 2 }}>{s.sub}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Integrity badge — three states: verified match / mismatch /
                    nothing to verify (statement carried no printed summary) */}
                {(() => {
                  // Each reported total is parsed by its own regex and is
                  // independently nullable, and *_match is false when the
                  // reported figure is absent. So only judge the sides the
                  // statement actually printed — otherwise a statement whose
                  // deposits parse perfectly but whose withdrawals summary is
                  // missing gets accused of failing its own integrity check.
                  const depReported = result.integrity.reported_total_deposits != null
                  const wdReported = result.integrity.reported_total_withdrawals != null
                  const verifiable = depReported || wdReported
                  const ok = (!depReported || result.integrity.deposits_match)
                    && (!wdReported || result.integrity.withdrawals_match)
                  const bg = !verifiable ? "var(--surface-2)"
                    : ok ? "var(--tier-green-bg, #E8F5ED)" : "var(--tier-red-bg, #FDE8E8)"
                  const fg = !verifiable ? "var(--text-2)"
                    : ok ? "var(--tier-green-text, #1A6B3A)" : "var(--tier-red-text, #8B1A1A)"
                  const icon = !verifiable ? "ℹ" : ok ? "✓" : "⚠"
                  const label = !verifiable
                    ? "فحص السلامة: الكشف لا يتضمن ملخصاً مطبوعاً للمقارنة"
                    : ok
                      ? "فحص السلامة: المجاميع مطابقة لملخص الكشف المطبوع"
                      : "فحص السلامة: المجاميع لا تطابق ملخص الكشف — تُحال للمراجعة"
                  return (
                <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, background: bg, border: "none" }}>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: fg }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }} dir="ltr">
                      {result.transaction_count} tx · {fmtSAR(result.integrity.parsed_total_deposits)} in · {fmtSAR(result.integrity.parsed_total_withdrawals)} out
                    </div>
                  </div>
                </div>
                  )
                })()}

                {/* Monthly cash flow */}
                <div style={card}>
                  <div style={sectionTitle}>التدفق النقدي الشهري — من كشفك الحقيقي</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, direction: "ltr" }}>
                    {buckets.map(([month, v]) => (
                      <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 84 }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: Math.max(3, (v.income / maxFlow) * 84) }}
                            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                            style={{
                              width: 7, borderRadius: 3,
                              background: month === minIncomeMonth ? "var(--tier-red-text, #C0392B)" : "#1B6B4A",
                              animation: month === minIncomeMonth ? "worstPulse 1.6s ease-in-out infinite" : undefined,
                            }}
                          />
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: Math.max(3, (v.expenses / maxFlow) * 84) }}
                            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                            style={{ width: 7, borderRadius: 3, background: "var(--border)" }}
                          />
                        </div>
                        <span style={{ fontSize: 7.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>
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
                  <div style={{ ...card, borderColor: "rgba(200,150,26,0.35)" }}>
                    <div style={sectionTitle}>🛡️ مبالغ استُبعدت من الدخل — حماية من تضخيم الدخل</div>
                    {Object.entries(excluded).map(([k, v]) => (
                      <div key={k} style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: 12, color: "var(--text-2)", marginBottom: 6,
                      }}>
                        <span>{EXCLUDED_LABEL[k] ?? k}</span>
                        <b dir="ltr">{fmtSAR(v)}</b>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, lineHeight: 1.7 }}>
                      المحرك لا يجامل: تحويل أموالك بين حساباتك ليس دخلاً،
                      والنقد غير القابل للتتبع لا يُحتسب.
                    </div>
                  </div>
                )}

                {/* Score gauge */}
                <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 16px" }}>
                  <ScoreGauge score={result.score.composite} tier={result.score.tier} />
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)", marginTop: 6 }}>
                    {TIER_AR[result.score.tier]}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 4, textAlign: "center", lineHeight: 1.7 }}>
                    {result.score.tier === "BUILDING"
                      ? "لا تمويل حالياً — وخارطة الطريق أدناه ترسم مسارك"
                      : "مؤهّل للعرض التمويلي عبر ضابط الائتمان"}
                  </div>
                </div>

                {/* Factors with provenance */}
                <div style={card}>
                  <div style={sectionTitle}>العوامل الخمسة — ٤ منها محسوبة من كشفك مباشرة</div>
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

                {/* AI explanation */}
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)" }}>شرح التقييم</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                      background: result.explanation.source === "claude-live" ? "#E8F0FE" : "var(--surface-2)",
                      color: result.explanation.source === "claude-live" ? "#1A56DB" : "var(--text-3)",
                    }}>
                      {result.explanation.source === "claude-live" ? "Claude — مباشر" : "قالب فوري"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 2 }}>
                    {result.explanation.ar}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={regenerateLive} disabled={liveAiBusy} style={{
                      flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "9px 0", fontSize: 11.5, fontWeight: 700,
                      color: "var(--text-2)", cursor: liveAiBusy ? "wait" : "pointer",
                    }}>
                      {liveAiBusy ? "جارٍ التوليد…" : "🤖 توليد مباشر عبر Claude"}
                    </button>
                    <button onClick={() => setShowPayload(s => !s)} style={{
                      flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "9px 0", fontSize: 11.5, fontWeight: 700,
                      color: "var(--text-2)", cursor: "pointer",
                    }}>
                      🔒 ماذا يصل للنموذج؟
                    </button>
                  </div>
                  {showPayload && (
                    <div style={{
                      marginTop: 10, background: "#02141E", borderRadius: 12, padding: 12,
                    }}>
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

                {/* Roadmap */}
                <div style={card}>
                  <div style={sectionTitle}>
                    خارطة التحسين — من {result.roadmap.current_score} إلى{" "}
                    <span style={{ color: "#1A6B3A" }}>{result.roadmap.projected_score}</span>
                  </div>
                  {result.roadmap.actions.map((a, i) => (
                    <motion.div key={a.action_en}
                      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.1 }}
                      style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom: i < result.roadmap.actions.length - 1 ? "1px solid var(--border)" : "none",
                      }}>
                      <div style={{
                        background: "var(--tier-green-bg, #E8F5ED)", color: "#1A6B3A",
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
                    </motion.div>
                  ))}
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 10, lineHeight: 1.8 }}>
                    {result.roadmap.summary_ar}
                  </div>
                </div>

                <button onClick={() => { setPhase("pick"); setResult(null); setStatement(null) }} style={{
                  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "12px 0", fontSize: 13, fontWeight: 700,
                  color: "var(--text-2)", cursor: "pointer",
                }}>
                  استيراد ملف آخر
                </button>
              </motion.div>
            )}
        </div>
      </div>
    </PhoneFrame>
  )
}
