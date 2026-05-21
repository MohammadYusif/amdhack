"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { AlinmaHeader } from "@/components/AlinmaHeader"
import { getFullAssessment, getExplanation, getRoadmap, requestHumanReview, getProofOfIncomeUrl } from "@/lib/api"
import { TIER_CONFIG, COLORS } from "@/lib/config"
import type { FullAssessment, Roadmap } from "@/lib/types"

type Phase = "onboarding" | "scanning" | "result" | "officer"

const PIPELINE_STEPS = [
  { key: "step1_kyc",      label_ar: "تحقق هوية Nafath + ملف بنكي افتراضي",  icon: "🪪" },
  { key: "step2_lean_ais", label_ar: "سحب البيانات — Lean AIS — 24 شهراً",    icon: "🏦" },
  { key: "step3_simah",    label_ar: "فحص سجل SIMAH الائتماني",               icon: "📋" },
  { key: "step4_wathiq",   label_ar: "التحقق من العملاء — Wathiq",             icon: "✅" },
  { key: "step5_scoring",  label_ar: "حساب نتيجة مِهَن",                       icon: "🔢" },
]

export default function ProfileDemoPage() {
  const params = useParams()
  const profileId = params.profileId as string
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("onboarding")
  const [assessment, setAssessment] = useState<FullAssessment | null>(null)
  const [explanation, setExplanation] = useState("")
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [approved, setApproved] = useState(false)

  const runPipeline = useCallback(async () => {
    setPhase("scanning")
    setCompletedSteps(0)

    // Load data in background
    const [assessmentData, explanationText, roadmapData] = await Promise.all([
      getFullAssessment(profileId),
      getExplanation(profileId, "ar"),
      getRoadmap(profileId),
    ])

    // Animate steps — 1 second each
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 1000))
      setCompletedSteps(i)
    }

    setAssessment(assessmentData)
    setExplanation(explanationText)
    setRoadmap(roadmapData)

    await new Promise(r => setTimeout(r, 500))
    setPhase("result")
  }, [profileId])

  if (phase === "onboarding") {
    return (
      <div className="min-h-screen" style={{ background: "#F4F6F9" }}>
        <AlinmaHeader subtitle="تمويل المستقلين — مِهَن" />
        <div className="max-w-md mx-auto p-4 pt-6 space-y-4">

          <h1 className="text-xl font-bold" style={{ color: "#02141E" }}>
            تمويل المستقلين
          </h1>
          <p className="text-sm text-gray-500">
            نحتاج للوصول إلى بياناتك المصرفية عبر Open Banking للتقييم.
            لن يتم تخزين أي بيانات.
          </p>

          {/* Step indicators */}
          <div className="bg-white rounded-2xl p-4 shadow space-y-3">
            {[
              { icon: "🪪", text: "التحقق من هويتك عبر Nafath" },
              { icon: "🏦", text: "الوصول إلى بياناتك المصرفية عبر Lean" },
              { icon: "⚡", text: "تقييم فوري خلال 60 ثانية" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm text-gray-700">{s.text}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <div className="text-xs text-gray-500 mb-2">الموافقة على المشاركة</div>
            <div className="text-sm text-gray-700 mb-4">
              أوافق على منح بنك الإنماء صلاحية الوصول إلى سجلاتي المصرفية
              عبر Lean Technologies لأغراض التقييم الائتماني فقط.
            </div>
            <button
              onClick={runPipeline}
              className="w-full py-3 rounded-xl text-white font-bold text-base"
              style={{ background: "#02141E" }}>
              موافق — ابدأ التقييم
            </button>
          </div>

        </div>
      </div>
    )
  }

  if (phase === "scanning") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#02141E" }}>
        <AlinmaHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-white text-center mb-8">
            <div className="text-5xl mb-4">⚡</div>
            <div className="text-xl font-bold mb-1">جارٍ التقييم</div>
            <div className="text-sm opacity-60">تحليل البيانات المصرفية...</div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            {PIPELINE_STEPS.map((step, i) => {
              const done = i < completedSteps
              const active = i === completedSteps
              return (
                <div key={step.key}
                  className="flex items-center gap-3 rounded-xl p-3 transition-all"
                  style={{
                    background: done ? "rgba(27,107,74,0.3)" : active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${done ? "#1B6B4A" : active ? "rgba(255,255,255,0.3)" : "transparent"}`,
                  }}>
                  <span className="text-xl w-8 text-center">
                    {done ? "✅" : active ? "⏳" : step.icon}
                  </span>
                  <span className="text-sm text-white opacity-90">{step.label_ar}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (phase === "result" && assessment) {
    const tier = assessment.score.tier
    const tierConf = TIER_CONFIG[tier]
    const loan = assessment.loan_recommendation

    return (
      <div className="min-h-screen" style={{ background: "#F4F6F9" }}>
        <AlinmaHeader subtitle="نتيجة التقييم" />
        <div className="max-w-md mx-auto p-4 pt-4 space-y-4">

          {/* Score card */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-5 text-center" style={{ background: tierConf.bg }}>
              <div className="text-6xl font-black mb-1" style={{ color: tierConf.color }}>
                {assessment.score.composite}
              </div>
              <div className="text-sm font-bold" style={{ color: tierConf.color }}>
                نتيجة مِهَن — درجة {tierConf.label_ar}
              </div>
            </div>

            {/* Factor bars */}
            <div className="p-4 space-y-2">
              {[
                { key: "expense_discipline",    label: "انضباط المصروفات", weight: "30%" },
                { key: "income_stability",       label: "استقرار الدخل",    weight: "25%" },
                { key: "client_diversity",       label: "تنوع العملاء",    weight: "20%" },
                { key: "savings_behavior",       label: "سلوك الادخار",    weight: "15%" },
                { key: "contract_verification",  label: "توثيق العقود",    weight: "10%" },
              ].map(f => {
                const value = assessment.score.factors[f.key as keyof typeof assessment.score.factors] as number
                return (
                  <div key={f.key}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{f.label} <span className="text-gray-400">({f.weight})</span></span>
                      <span className="font-bold">{value}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${value}%`, background: tierConf.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI explanation */}
          {explanation && (
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-xs font-medium text-gray-400 mb-2">تحليل مِهَن</div>
              <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
            </div>
          )}

          {/* Loan offer or roadmap */}
          {tier === "BUILDING" && roadmap ? (
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-xs font-medium text-gray-400 mb-1">خطة التطوير</div>
              <p className="text-sm text-gray-600 mb-3">{roadmap.summary_ar}</p>
              <div className="space-y-2">
                {roadmap.actions.slice(0, 3).map((action, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                    <span className="text-xs font-bold mt-0.5" style={{ color: COLORS.amber }}>
                      +{action.projected_gain}
                    </span>
                    <span className="text-sm text-gray-700">{action.action_ar}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-gray-400 text-center">
                النتيجة المتوقعة: {roadmap.projected_score} ({roadmap.projected_tier === "GREEN" ? "أخضر" : "أصفر"})
              </div>
            </div>
          ) : loan ? (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="px-4 py-3" style={{ background: "#02141E" }}>
                <div className="text-white font-bold">عرض التمويل</div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "مبلغ التمويل", value: `${loan.amount.toLocaleString()} ريال` },
                  { label: "المدة",        value: `${loan.duration_months} شهر` },
                  { label: "نسبة الربح",   value: `${loan.apr}%` },
                  { label: "القسط الشهري", value: `${loan.monthly_installment.toLocaleString()} ريال` },
                ].map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                    <div className="font-bold text-gray-900">{f.value}</div>
                  </div>
                ))}
              </div>
              {loan.is_dbr_compressed && (
                <div className="px-4 pb-3 text-xs text-amber-600">
                  * تم تعديل المبلغ ليتوافق مع حد الاستقطاع 45% من الدخل
                </div>
              )}
            </div>
          ) : null}

          {/* Wathiq results */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs font-medium text-gray-400 mb-3">التحقق من العملاء — Wathiq</div>
            <div className="space-y-2">
              {assessment.wathiq_results.map((w, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{w.trade_name_ar}</span>
                  <span className={w.risk_flag ? "text-amber-500" : "text-green-600"}>
                    {w.risk_flag ? "⚠️ مراجعة" : "✅ موثّق"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SIMAH summary */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs font-medium text-gray-400 mb-2">تقرير SIMAH</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{assessment.simah.note_ar}</span>
              {assessment.exception_sandbox_triggered && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#E8F5EE", color: "#1B6B4A" }}>
                  استثناء مُطبَّق
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pb-6">
            {tier !== "BUILDING" && (
              <button
                onClick={() => setPhase("officer")}
                className="w-full py-3 rounded-xl text-white font-bold"
                style={{ background: "#02141E" }}>
                عرض لوحة مسؤول الائتمان ←
              </button>
            )}
            <a
              href={getProofOfIncomeUrl(profileId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl text-center font-bold border-2"
              style={{ borderColor: "#02141E", color: "#02141E" }}>
              تحميل بيان التدفق النقدي (PDF)
            </a>
            <button
              onClick={() => router.push("/demo")}
              className="w-full py-3 rounded-xl text-gray-500 text-sm border">
              جرّب ملفاً آخر
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "officer" && assessment) {
    const tier = assessment.score.tier
    const tierConf = TIER_CONFIG[tier]
    const loan = assessment.loan_recommendation

    return (
      <div className="min-h-screen" style={{ background: "#F0F2F5" }}>
        {/* Officer header */}
        <div className="px-4 py-3" style={{ background: "#02141E", borderBottom: "3px solid #033957" }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-white font-bold">بنك الإنماء — نظام التمويل</div>
              <div className="text-xs opacity-60 text-white">لوحة مسؤول الائتمان</div>
            </div>
            <div className="text-xs px-2 py-1 rounded" style={{ background: "#033957", color: "#CD907E" }}>
              داخلي — سري
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 pt-4 space-y-4">

          {/* Applicant + score side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-xs text-gray-400 mb-2">المتقدم</div>
              <div className="font-bold text-gray-900">{assessment.profile.name_ar}</div>
              <div className="text-sm text-gray-500">
                {assessment.profile.id === "mohammad" ? "مطور تطبيقات" : assessment.profile.id === "noura" ? "مصممة جرافيك" : "مصور"}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">نتيجة مِهَن</div>
              <div className="text-4xl font-black" style={{ color: tierConf.color }}>
                {assessment.score.composite}
              </div>
              <div className="text-xs font-bold" style={{ color: tierConf.color }}>
                درجة {tierConf.label_ar}
              </div>
            </div>
          </div>

          {/* Pipeline status */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs font-medium text-gray-400 mb-3">حالة خط التقييم</div>
            <div className="space-y-2">
              {PIPELINE_STEPS.map((step) => (
                <div key={step.key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{step.label_ar}</span>
                  <span className="text-green-600 font-medium">✅ مكتمل</span>
                </div>
              ))}
            </div>
          </div>

          {/* SIMAH vs repayment capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-xs text-gray-400 mb-2">SIMAH</div>
              <div className="font-bold" style={{ color: "#C0392B" }}>
                {assessment.simah.file_type === "EMPTY" ? "ملف فارغ" : "ملف شحيح"}
              </div>
              <div className="text-xs text-gray-500 mt-1">{assessment.simah.note_ar}</div>
              {assessment.exception_sandbox_triggered && (
                <div className="mt-2 text-xs px-2 py-1 rounded" style={{ background: "#E8F5EE", color: "#1B6B4A" }}>
                  استثناء sandbox مُطبَّق
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-xs text-gray-400 mb-2">قدرة السداد</div>
              <div className="font-bold text-gray-900">
                {assessment.score.repayment_capacity.toLocaleString()} ريال/شهر
              </div>
              <div className="text-xs text-gray-500 mt-1">
                45% من الحد الأدنى × 80%
              </div>
            </div>
          </div>

          {/* Loan recommendation */}
          {loan && (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="px-4 py-3" style={{ background: "#033957" }}>
                <div className="text-white font-bold text-sm">توصية التمويل</div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "مبلغ التمويل", value: `${loan.amount.toLocaleString()} ريال` },
                  { label: "المدة",        value: `${loan.duration_months} شهر` },
                  { label: "نسبة الربح",   value: `${loan.apr}%` },
                  { label: "القسط الشهري", value: `${loan.monthly_installment.toLocaleString()} ريال` },
                ].map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                    <div className="font-bold">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wathiq client list */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-xs font-medium text-gray-400 mb-3">توثيق العملاء — Wathiq</div>
            {assessment.wathiq_results.map((w, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">{w.trade_name_ar}</div>
                  <div className="text-xs text-gray-400">CR: {w.cr} — {w.months_active} شهراً</div>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${w.risk_flag ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                  {w.risk_flag ? "⚠️ مراجعة" : "✅ موثّق"}
                </div>
              </div>
            ))}
          </div>

          {/* Decision buttons */}
          <div className="grid grid-cols-3 gap-3 pb-6">
            <button
              onClick={async () => {
                await requestHumanReview(profileId, "طلب مراجعة من لوحة المسؤول")
                alert("تم إرسال طلب المراجعة ✓")
              }}
              className="py-3 rounded-xl text-sm font-medium border text-gray-600">
              مراجعة
            </button>
            <button
              onClick={() => alert("تم رفض الطلب")}
              className="py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "#C0392B" }}>
              رفض
            </button>
            <button
              onClick={() => {
                setApproved(true)
                alert("✅ تمت الموافقة على التمويل!")
              }}
              className="py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: approved ? "#1B6B4A" : "#02141E" }}>
              {approved ? "✅ موافقة" : "اعتماد"}
            </button>
          </div>

        </div>
      </div>
    )
  }

  return null
}
