"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { PhoneFrame, StatusBar } from "@/components/PhoneFrame"
import { AlinmaLogo } from "@/components/AlinmaShell"
import {
  getFullAssessment, getExplanation, getRoadmap,
  requestHumanReview, getProofOfIncomeUrl, getProfiles,
} from "@/lib/api"
import { TIER_CONFIG, COLORS } from "@/lib/config"
import type { FullAssessment, Roadmap, Profile } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────
type Phase = "home" | "onboarding" | "scanning" | "result" | "officer"
type OnboardingStep = "consent" | "face-scan" | "provisioning"
type BufferOption = "escrow" | "direct-debit" | null

const PIPELINE_STEPS = [
  { key: "step1_kyc",      ar: "توثيق هوية نفاذ + Tech-IBAN",                   icon: "🪪" },
  { key: "step2_lean_ais", ar: "سحب معاملات Lean AIS — ٢٤ شهراً",               icon: "🏦" },
  { key: "step3_simah",    ar: "استعلام سجل SIMAH الائتماني",                    icon: "📋" },
  { key: "step4_wathiq",   ar: "التحقق من العملاء عبر Wathiq",                   icon: "✅" },
  { key: "step5_scoring",  ar: "تشغيل محرك تحليل مِهَن",                         icon: "⚡" },
]

const TRANSACTIONS = [
  { icon: "☕", name_ar: "ستاربكس — الرياض بارك",  amount: -28,   time_ar: "اليوم" },
  { icon: "📦", name_ar: "نون للتسوق",              amount: -245,  time_ar: "أمس" },
  { icon: "💼", name_ar: "دفعة مشروع مستقل",        amount: 4200,  time_ar: "منذ ٣ أيام" },
  { icon: "🔵", name_ar: "SADAD — فاتورة STC",      amount: -180,  time_ar: "منذ ٥ أيام" },
]

// ─── Bottom nav SVG icons ────────────────────────────────────────
function NavHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 12L12 5l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 12v7a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-7"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0}/>
    </svg>
  )
}
function NavTransfer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 9h14M14 6l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 15H5M10 12l-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function NavFinance({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 18l5-6 4 3 4.5-6L21 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {active && <circle cx="19" cy="9" r="2.5" fill="currentColor" opacity="0.25"/>}
    </svg>
  )
}
function NavCards({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="13" rx="2"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.08 : 0}/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M6 15h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function NavMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  )
}

// ─── ScoreGauge ─────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 88
  const cx = 100; const cy = 105
  const arcLen = Math.PI * r

  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const dur = 1400
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(score * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [score])

  const offset = arcLen * (1 - displayed / 100)

  return (
    <svg viewBox="0 0 200 122" style={{ width: 220, margin: "0 auto", display: "block" }}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#EAE2DA" strokeWidth={16} strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={16} strokeLinecap="round"
        strokeDasharray={arcLen} strokeDashoffset={offset}
        className="score-gauge-fill"
      />
      {/* Score number */}
      <text x={cx} y={cy - 12} textAnchor="middle" style={{
        fontSize: 46, fontWeight: 800, fill: color,
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}>
        {displayed}
      </text>
      {/* Label */}
      <text x={cx} y={cy + 12} textAnchor="middle" style={{
        fontSize: 11, fill: "#8A96A4",
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}>
        نتيجة مِهَن / ١٠٠
      </text>
    </svg>
  )
}

// ─── FactorRow ───────────────────────────────────────────────────
function FactorRow({ label, weight, value, color }: {
  label: string; weight: string; value: number; color: string
}) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(value), 300); return () => clearTimeout(t) }, [value])
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          {label} <span style={{ color: "var(--text-3)", fontSize: 10 }}>({weight})</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }} dir="ltr">{value}</span>
      </div>
      <div className="factor-bar-track">
        <div className="factor-bar-fill" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function ProfileDemoPage() {
  const params = useParams()
  const profileId = params.profileId as string
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("home")
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("consent")
  const [completedSteps, setCompletedSteps] = useState(0)
  const [assessment, setAssessment] = useState<FullAssessment | null>(null)
  const [explanation, setExplanation] = useState("")
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [approved, setApproved] = useState(false)
  const [selectedBuffer, setSelectedBuffer] = useState<BufferOption>(null)
  const [scoreVersion, setScoreVersion] = useState<"v1" | "v2">("v2")
  const [profile, setProfile] = useState<Profile | null>(null)

  const dataRef = useRef<Promise<[FullAssessment, string, Roadmap]> | null>(null)

  // Preload profile name
  useEffect(() => {
    getProfiles().then(ps => {
      const p = ps.find(x => x.id === profileId)
      if (p) setProfile(p)
    })
  }, [profileId])

  // Start prefetching when user taps Mihan card
  function handleMihanTap() {
    dataRef.current = Promise.all([
      getFullAssessment(profileId),
      getExplanation(profileId, "ar"),
      getRoadmap(profileId),
    ])
    setPhase("onboarding")
    setOnboardingStep("consent")
  }

  // Nafath auth flow
  async function handleNafath() {
    setOnboardingStep("face-scan")
    await new Promise(r => setTimeout(r, 2600))
    setOnboardingStep("provisioning")
    await new Promise(r => setTimeout(r, 1600))
    runPipeline()
  }

  const runPipeline = useCallback(async () => {
    setPhase("scanning")
    setCompletedSteps(0)

    const [assessmentData, explanationText, roadmapData] = await (dataRef.current ?? Promise.all([
      getFullAssessment(profileId),
      getExplanation(profileId, "ar"),
      getRoadmap(profileId),
    ]))

    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 1100))
      setCompletedSteps(i)
    }

    setAssessment(assessmentData)
    setExplanation(explanationText)
    setRoadmap(roadmapData)

    await new Promise(r => setTimeout(r, 600))
    setPhase("result")
  }, [profileId])

  // ── OFFICER PHASE — full desktop width outside phone ──────────
  if (phase === "officer" && assessment) {
    const tier = assessment.score.tier
    const tc = TIER_CONFIG[tier]
    const loan = assessment.loan_recommendation
    return <OfficerDashboard
      assessment={assessment}
      tierConf={tc}
      loan={loan}
      approved={approved}
      setApproved={setApproved}
      profileId={profileId}
      onBack={() => setPhase("result")}
    />
  }

  // ── PHONE-WRAPPED PHASES ──────────────────────────────────────
  const isDark = phase === "scanning" || onboardingStep === "face-scan" || onboardingStep === "provisioning"

  return (
    <PhoneFrame dark={isDark}>
      <AnimatePresence mode="wait">
        {phase === "home" && (
          <HomePhase key="home" profile={profile} onMihanTap={handleMihanTap} />
        )}
        {phase === "onboarding" && (
          <OnboardingPhase
            key="onboarding"
            step={onboardingStep}
            onNafath={handleNafath}
            onCancel={() => { setPhase("home"); setOnboardingStep("consent") }}
          />
        )}
        {phase === "scanning" && (
          <ScanningPhase key="scanning" completedSteps={completedSteps} />
        )}
        {phase === "result" && assessment && (
          <ResultPhase
            key="result"
            assessment={assessment}
            explanation={explanation}
            roadmap={roadmap}
            selectedBuffer={selectedBuffer}
            setSelectedBuffer={setSelectedBuffer}
            scoreVersion={scoreVersion}
            setScoreVersion={setScoreVersion}
            profileId={profileId}
            onOfficer={() => setPhase("officer")}
            onBack={() => router.push("/demo")}
          />
        )}
      </AnimatePresence>
    </PhoneFrame>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 1 — APP HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════
function HomePhase({ profile, onMihanTap }: { profile: Profile | null; onMihanTap: () => void }) {
  const name = profile?.name_ar ?? "محمد"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}
    >
      {/* ── App header with balance ── */}
      <div style={{
        background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
        padding: "14px 20px 20px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlinmaLogo size={30} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>مرحباً،</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{name}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                  stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Balance card */}
        <div style={{
          background: "rgba(255,255,255,0.09)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18, padding: "16px 18px",
        }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginBottom: 6 }}>
            الرصيد المتاح — حساب جاري
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#fff", fontSize: 34, fontWeight: 800, letterSpacing: "-1px" }} dir="ltr">
              4,500
            </span>
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>ريال</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "1px" }} dir="ltr">
            •••• •••• •••• 7823
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 0" }}>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { label: "تحويل", icon: "↔" },
            { label: "دفع",   icon: "💳" },
            { label: "كشف",   icon: "📄" },
            { label: "المزيد", icon: "⋯" },
          ].map(a => (
            <div key={a.label} style={{
              background: "var(--surface)", borderRadius: 14,
              border: "1px solid var(--border)", padding: "12px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              opacity: 0.5, pointerEvents: "none",
            }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>{a.label}</span>
            </div>
          ))}
        </div>

        {/* ── Mihan featured card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          onClick={onMihanTap}
          style={{
            background: "linear-gradient(135deg, #02141E 0%, #04253C 100%)",
            borderRadius: 20, padding: "18px",
            border: "1.5px solid rgba(205,144,126,0.45)",
            boxShadow: "0 0 0 1px rgba(205,144,126,0.1), 0 10px 28px rgba(2,20,30,0.35)",
            cursor: "pointer", marginBottom: 18, position: "relative", overflow: "hidden",
          }}
        >
          {/* Copper glow */}
          <div style={{
            position: "absolute", top: -30, left: -30, width: 140, height: 140,
            background: "radial-gradient(circle, rgba(205,144,126,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{
                  background: "rgba(205,144,126,0.2)", color: "#CD907E",
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                }}>مخصص لك</span>
                <span style={{
                  background: "rgba(27,107,74,0.25)", color: "#5CB88A",
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                }}>جديد</span>
              </div>
              <span style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>تمويل مِهَن للمستقلين</span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "rgba(205,144,126,0.18)",
              border: "1px solid rgba(205,144,126,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ color: "#CD907E", fontSize: 22, fontWeight: 800 }}>م</span>
            </div>
          </div>

          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
            بناءً على سجلك المصرفي المستمر، تم ترشيحك لتمويل يصل إلى{" "}
            <span style={{ color: "#CD907E", fontWeight: 700 }}>٦٠,٠٠٠ ريال</span>.
            اضغط لاستعراض خياراتك عبر مسار Open Banking.
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              Lean Technologies · ساما ٢٠٢٦
            </span>
            <div style={{
              background: "linear-gradient(135deg, #CD907E, #C5926B)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: 10,
              boxShadow: "0 4px 12px rgba(205,144,126,0.4)",
            }}>
              استكشف ←
            </div>
          </div>
        </motion.div>

        {/* Recent transactions */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
            آخر المعاملات
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
            {TRANSACTIONS.map((tx, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                borderBottom: i < TRANSACTIONS.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "var(--surface-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>{tx.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", marginBottom: 2 }}>
                    {tx.name_ar}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{tx.time_ar}</div>
                </div>
                <div style={{
                  fontWeight: 700, fontSize: 13,
                  color: tx.amount > 0 ? "#1A6B3A" : "var(--text-1)",
                }} dir="ltr">
                  {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        borderTop: "1px solid var(--border)",
        display: "flex", background: "var(--surface)", flexShrink: 0,
      }}>
        {[
          { label: "الرئيسية", active: false },
          { label: "تحويل",   active: false },
          { label: "تمويل",   active: true  },
          { label: "بطاقات",  active: false },
          { label: "المزيد",  active: false },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, padding: "10px 0 14px",
            color: item.active ? "var(--accent)" : "var(--text-3)", cursor: "default",
            transition: "color 0.15s",
          }}>
            {i === 0 && <NavHome active={item.active} />}
            {i === 1 && <NavTransfer />}
            {i === 2 && <NavFinance active={item.active} />}
            {i === 3 && <NavCards active={item.active} />}
            {i === 4 && <NavMore />}
            <span style={{ fontSize: 10, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 3 — CONSENT & VIRTUAL PROFILE
// ═══════════════════════════════════════════════════════════════
function OnboardingPhase({ step, onNafath, onCancel }: {
  step: OnboardingStep
  onNafath: () => void
  onCancel: () => void
}) {
  if (step === "face-scan" || step === "provisioning") {
    return (
      <motion.div
        key={step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#0A0F16", gap: 28, padding: "20px",
          position: "relative",
        }}
      >
        {/* Cancel button — top-right (leading edge in RTL) */}
        <button onClick={onCancel} style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "7px 14px",
          color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          إلغاء
        </button>
        {step === "face-scan" ? (
          <>
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="face-scan-wrapper">
                <div className="face-oval" />
                <div className="scan-line" />
                <div className="face-dot face-dot-left" />
                <div className="face-dot face-dot-right" />
                <div className="face-dot face-dot-nose" />
              </div>
            </motion.div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                جارٍ التحقق من الهوية
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                يُرجى النظر إلى الكاميرا والثبات
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[0.3, 0.5, 0.7, 0.9, 0.5, 0.3].map((o, i) => (
                <div key={i} style={{
                  width: 4, height: 20, borderRadius: 99,
                  background: `rgba(167,154,242,${o})`,
                  animation: `wave 1.2s ${i * 0.1}s ease-in-out infinite alternate`,
                }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                border: "3px solid rgba(154,140,185,0.3)",
                borderTopColor: "var(--alinma-lavender-2)",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                جارٍ إعداد الملف البنكي الافتراضي
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6 }}>
                Tech-IBAN · مطابقة هوية SAMA · تهيئة ملف آمن
              </div>
            </div>
          </>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      key="consent"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}
    >
      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
        padding: "14px 20px 20px", flexShrink: 0,
      }}>
        <div style={{ color: "var(--alinma-copper)", fontSize: 11, marginBottom: 4 }}>
          تمويل مِهَن — الخطوة ١ من ٢
        </div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>
          موافقة Open Banking
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 24px" }}>

        {/* Data access disclosure */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>
          البيانات التي سيتم تحليلها
        </div>
        {[
          { icon: "🏦", title: "الأرصدة التاريخية", desc: "كشف حساب شامل لآخر ٢٤ شهراً" },
          { icon: "💰", title: "إيداعات المصادر الواردة", desc: "تحديد مصادر الدخل وتواترها" },
          { icon: "📊", title: "بيانات SADAD",           desc: "الالتزامات والفواتير الشهرية" },
          { icon: "🔍", title: "أنماط الإنفاق",         desc: "تصنيف المصروفات لقياس الانضباط المالي" },
        ].map(item => (
          <div key={item.title} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "11px 14px", marginBottom: 8,
            background: "var(--surface)", borderRadius: 14,
            border: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", marginBottom: 1 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{item.desc}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: "auto", flexShrink: 0, marginTop: 2 }}>
              <path d="M20 6L9 17l-5-5" stroke="#1A6B3A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        ))}

        {/* SAMA badge */}
        <div style={{
          background: "var(--gold-light)", border: "1px solid #DFC0B5",
          borderRadius: 12, padding: "10px 14px", marginBottom: 16, marginTop: 4,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="#A0503A" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 11, color: "#8B3E28", lineHeight: 1.6 }}>
            يعمل هذا المسار تحت ترخيص البنوك المفتوحة من البنك المركزي السعودي (ساما)
            الصادر في مارس ٢٠٢٦. بياناتك مشفرة ولن تُشارَك مع أطراف ثالثة.
          </div>
        </div>

        {/* Consent checkbox */}
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "12px 14px", marginBottom: 20,
          background: "var(--accent-light)", borderRadius: 12,
          border: "1px solid rgba(131,127,216,0.25)",
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 6, background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4.5L3.8 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            أوافق على منح بنك الإنماء صلاحية الوصول إلى بياناتي المصرفية عبر Lean Technologies
            لأغراض التقييم الائتماني فقط، لمدة لا تتجاوز ٩٠ يوماً.
          </div>
        </div>

        {/* Nafath button */}
        <motion.button
          onClick={onNafath}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%", padding: "16px",
            background: "linear-gradient(135deg, #02141E 0%, #033957 100%)",
            color: "#fff", border: "none", borderRadius: 14,
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: "0 6px 20px rgba(2,20,30,0.35)",
          }}
        >
          <span style={{ fontSize: 20 }}>🪪</span>
          توثيق الهوية عبر نفاذ
        </motion.button>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 4 — PIPELINE ANIMATION
// ═══════════════════════════════════════════════════════════════
function ScanningPhase({ completedSteps }: { completedSteps: number }) {
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
            {completedSteps} / ٥ خطوات
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
              {/* Icon */}
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

              {/* Label */}
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
// SCREEN 5 — SCORE RESULT + OFFER
// ═══════════════════════════════════════════════════════════════
function ResultPhase({
  assessment, explanation, roadmap, selectedBuffer, setSelectedBuffer,
  scoreVersion, setScoreVersion, profileId, onOfficer, onBack,
}: {
  assessment: FullAssessment
  explanation: string
  roadmap: Roadmap | null
  selectedBuffer: BufferOption
  setSelectedBuffer: (v: BufferOption) => void
  scoreVersion: "v1" | "v2"
  setScoreVersion: (v: "v1" | "v2") => void
  profileId: string
  onOfficer: () => void
  onBack: () => void
}) {
  const [shakeBuffer, setShakeBuffer] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const tier = assessment.score.tier
  const tc = TIER_CONFIG[tier]
  const loan = assessment.loan_recommendation

  function handleOfficerClick() {
    if (!selectedBuffer) {
      setShakeBuffer(true)
      setTimeout(() => setShakeBuffer(false), 500)
      return
    }
    onOfficer()
  }

  function handlePdfDownload() {
    setPdfLoading(true)
    window.open(getProofOfIncomeUrl(profileId), "_blank")
    setTimeout(() => setPdfLoading(false), 1800)
  }

  const FACTORS = [
    { key: "expense_discipline",   label: "انضباط المصروفات", weight: "30%" },
    { key: "income_stability",     label: "استقرار الدخل",    weight: "25%" },
    { key: "client_diversity",     label: "تنوع العملاء",    weight: "20%" },
    { key: "savings_behavior",     label: "سلوك الادخار",    weight: "15%" },
    { key: "contract_verification",label: "توثيق العقود",    weight: "10%" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}
    >
      {/* Header */}
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
        {/* v1/v2 toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            display: "flex", background: "rgba(255,255,255,0.1)",
            borderRadius: 10, padding: 2,
          }}>
            {(["v1", "v2"] as const).map(v => (
              <button key={v} onClick={() => setScoreVersion(v)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: scoreVersion === v
                  ? (v === "v2" ? "#9A8CB9" : "#CD907E")
                  : "transparent",
                color: scoreVersion === v ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 11, fontWeight: 700, transition: "all 0.2s",
              }}>
                {v === "v1" ? "مرح. ١" : "VANC"}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>
            {scoreVersion === "v1" ? "Phase 1" : "V2 — تقييم VANC"}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 16px 24px" }}>

        {/* Score gauge */}
        <div style={{
          background: "var(--surface)", borderRadius: 20, padding: "20px 16px 16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)", textAlign: "center",
        }}>
          <ScoreGauge score={assessment.score.composite} color={tc.color} />
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <span style={{
              background: tc.bg, color: tc.color, fontWeight: 700, fontSize: 13,
              padding: "5px 14px", borderRadius: 99,
            }}>
              {tier === "GREEN" ? "✓ مؤهّل للتمويل" : tier === "YELLOW" ? "تمويل مشروط" : "مستوى التطوير"}
            </span>
          </div>
          {assessment.exception_sandbox_triggered && (
            <div style={{
              marginTop: 10, padding: "6px 12px",
              background: "#E8F5ED", borderRadius: 10,
              fontSize: 11, color: "#1A6B3A", fontWeight: 600,
            }}>
              استثناء Sandbox مُطبَّق — SIMAH فارغ تجاوزه مِهَن
            </div>
          )}
        </div>

        {/* Factor bars */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
            تفصيل عوامل التقييم — SAMA AI Explainability
          </div>
          {FACTORS.map(f => (
            <FactorRow
              key={f.key}
              label={f.label}
              weight={f.weight}
              value={assessment.score.factors[f.key as keyof typeof assessment.score.factors] as number}
              color={tc.color}
            />
          ))}
        </div>

        {/* AI explanation */}
        {explanation && (
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
            <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.75 }}>{explanation}</p>
          </div>
        )}

        {/* Loan offer or roadmap */}
        {tier === "BUILDING" && roadmap ? (
          <div style={{
            background: "var(--surface)", borderRadius: 18, padding: "16px",
            marginBottom: 14, boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>خطة تحسين درجتك</div>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12, lineHeight: 1.7 }}>
              {roadmap.summary_ar}
            </p>
            {roadmap.actions.slice(0, 4).map((action, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", borderRadius: 12, marginBottom: 8,
                background: "var(--surface-2)",
              }}>
                <span style={{
                  fontWeight: 800, fontSize: 12, color: COLORS.amber,
                  background: "#FEF5E4", padding: "2px 7px", borderRadius: 8,
                  flexShrink: 0,
                }}>
                  +{action.projected_gain}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                  {action.action_ar}
                </span>
              </div>
            ))}
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
              النتيجة المتوقعة: <strong style={{ color: COLORS.amber }}>{roadmap.projected_score}</strong>
            </div>
          </div>
        ) : loan ? (
          <>
            {/* Loan card */}
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
              {loan.is_dbr_compressed && (
                <div style={{ padding: "10px 14px" }}>
                  <div style={{
                    background: "rgba(205,144,126,0.15)", border: "1px solid rgba(205,144,126,0.3)",
                    borderRadius: 10, padding: "8px 12px",
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚖️</span>
                    <span style={{ fontSize: 11, color: "#CD907E", lineHeight: 1.6 }}>
                      طبّقت ساما حدّ الاستقطاع ٤٥٪ — تم ضبط المبلغ آلياً لضمان قدرتك على السداد.
                    </span>
                  </div>
                </div>
              )}
              <div style={{ height: 14 }} />
            </div>

            {/* Buffer selection */}
            <div style={{
              background: "var(--surface)", borderRadius: 18, padding: "16px",
              marginBottom: 14, boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                اختر ضمانة حماية السداد
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12, lineHeight: 1.6 }}>
                مطلوبة قبل إتمام طلب التمويل
              </div>
              {[
                {
                  id: "escrow" as const,
                  title: "احتياطي ضماني — شهران",
                  desc: "تجميد ما يعادل قسطين في حساب احتياطي لدى الإنماء مدة العقد",
                  icon: "🏦",
                },
                {
                  id: "direct-debit" as const,
                  title: "تفويض خصم مباشر — SAMA",
                  desc: "تفويض بنك الإنماء بالخصم التلقائي من حسابك الجاري وفق أنظمة ساما",
                  icon: "🔒",
                },
              ].map(opt => (
                <motion.div
                  key={opt.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedBuffer(opt.id)}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
                    background: selectedBuffer === opt.id ? "var(--accent-light)" : "var(--surface-2)",
                    border: `1.5px solid ${selectedBuffer === opt.id ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", marginBottom: 2 }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    background: selectedBuffer === opt.id ? "var(--accent)" : "transparent",
                    border: `2px solid ${selectedBuffer === opt.id ? "var(--accent)" : "var(--border-dark)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {selectedBuffer === opt.id && (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : null}

        {/* SIMAH */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "14px 16px",
          marginBottom: 14, boxShadow: "var(--shadow-sm)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>تقرير SIMAH</div>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{assessment.simah.note_ar}</div>
          </div>
          {assessment.exception_sandbox_triggered && (
            <span style={{
              background: "#E8F5ED", color: "#1A6B3A",
              fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
            }}>
              استثناء مُطبَّق
            </span>
          )}
        </div>

        {/* Wathiq */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "14px 16px",
          marginBottom: 18, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
            التحقق من العملاء — Wathiq
          </div>
          {assessment.wathiq_results.map((w, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0",
              borderBottom: i < assessment.wathiq_results.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>
                {w.trade_name_ar}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: w.risk_flag ? "#D4900A" : "#1A6B3A",
                background: w.risk_flag ? "#FEF5E4" : "#E8F5ED",
                padding: "3px 10px", borderRadius: 99,
              }}>
                {w.risk_flag ? "⚠ مراجعة" : "✓ موثّق"}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          {tier !== "BUILDING" && (
            <motion.button
              whileTap={selectedBuffer ? { scale: 0.97 } : {}}
              onClick={handleOfficerClick}
              className={shakeBuffer ? "shake" : ""}
              style={{
                width: "100%", padding: "15px",
                background: selectedBuffer
                  ? "linear-gradient(135deg, #033957 0%, #02141E 100%)"
                  : "rgba(3,57,87,0.45)",
                color: "#fff", border: selectedBuffer ? "none" : "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                fontSize: 14, fontWeight: 700,
                cursor: selectedBuffer ? "pointer" : "not-allowed",
                boxShadow: selectedBuffer ? "0 6px 18px rgba(2,20,30,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              {selectedBuffer ? "لوحة مسؤول الائتمان ←" : "اختر ضمانة السداد أولاً"}
            </motion.button>
          )}
          <button
            onClick={handlePdfDownload}
            disabled={pdfLoading}
            style={{
              width: "100%", padding: "14px",
              background: "var(--surface)", color: pdfLoading ? "var(--text-3)" : "var(--text-1)",
              border: "1.5px solid var(--border)", borderRadius: 14,
              fontSize: 14, fontWeight: 600, cursor: pdfLoading ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "color 0.2s",
            }}
          >
            {pdfLoading ? (
              <>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.12)",
                  borderTopColor: "var(--text-3)",
                  animation: "spin 0.7s linear infinite",
                }} />
                جارٍ التحضير...
              </>
            ) : "تحميل بيان التدفق النقدي PDF"}
          </button>
          <button
            onClick={onBack}
            style={{
              width: "100%", padding: "13px",
              background: "transparent", color: "var(--text-3)",
              border: "1px solid var(--border)", borderRadius: 14,
              fontSize: 13, cursor: "pointer",
            }}
          >
            جرّب ملفاً آخر
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 6 — OFFICER DASHBOARD (full desktop)
// ═══════════════════════════════════════════════════════════════
function OfficerDashboard({
  assessment, tierConf, loan, approved, setApproved, profileId, onBack,
}: {
  assessment: FullAssessment
  tierConf: typeof TIER_CONFIG[keyof typeof TIER_CONFIG]
  loan: typeof assessment.loan_recommendation
  approved: boolean
  setApproved: (v: boolean) => void
  profileId: string
  onBack: () => void
}) {
  const [reviewSent, setReviewSent] = useState(false)

  async function sendReview() {
    await requestHumanReview(profileId, "طلب مراجعة بشرية من لوحة المسؤول")
    setReviewSent(true)
  }

  const exceptionTriggered = assessment.exception_sandbox_triggered

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", direction: "rtl" }}>
      {/* Banker header */}
      <div style={{
        background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64,
        borderBottom: "2px solid rgba(205,144,126,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AlinmaLogo size={30} />
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>نظام التمويل الداخلي</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>بنك الإنماء — لوحة مسؤول الائتمان</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "rgba(205,144,126,0.2)", color: "#CD907E",
            fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 99,
            border: "1px solid rgba(205,144,126,0.3)",
          }}>
            مِهَن — لوحة الائتمان
          </span>
          <span style={{
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
            fontSize: 10, fontWeight: 600, padding: "4px 12px", borderRadius: 99,
          }}>
            داخلي — سري
          </span>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, cursor: "pointer",
          }}>
            ← العودة لنتيجة العميل
          </button>
        </div>
      </div>

      {/* Exception sandbox banner */}
      {exceptionTriggered && (
        <div style={{
          background: "#FEF5E4", borderBottom: "2px solid #D4900A",
          padding: "12px 32px", display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: "#8A5F00", fontSize: 13, marginBottom: 2 }}>
              تحذير: تم تجاوز الرفض التلقائي لملف SIMAH الشحيح
            </div>
            <div style={{ color: "#8A5F00", fontSize: 12, lineHeight: 1.6 }}>
              SIMAH Thin-File Auto-Rejection Overridden via Mihan Policy Sandbox.
              نتيجة مِهَن ≥ ٧٥ — تم التحقق من المسار البديل. يُحال للمراجعة البشرية.
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          {/* Applicant */}
          <div style={{ background: "var(--surface)", borderRadius: 18, padding: "18px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>المتقدم</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-1)", marginBottom: 4 }}>
              {assessment.profile.name_ar}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
              {assessment.profile.profession_ar}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{
                background: tierConf.bg, color: tierConf.color,
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              }}>
                {assessment.score.tier === "GREEN" ? "أخضر" : assessment.score.tier === "YELLOW" ? "أصفر" : "تطوير"}
              </span>
              {exceptionTriggered && (
                <span style={{
                  background: "#FEF5E4", color: "#D4900A",
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                }}>
                  استثناء مُطبَّق
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div style={{
            background: "var(--surface)", borderRadius: 18, padding: "18px",
            textAlign: "center", boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>نتيجة مِهَن</div>
            <div style={{ fontSize: 54, fontWeight: 900, color: tierConf.color, lineHeight: 1 }} dir="ltr">
              {assessment.score.composite}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>/ ١٠٠</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* SIMAH */}
          <div style={{
            background: "var(--surface)", borderRadius: 18, padding: "16px",
            boxShadow: "var(--shadow-sm)",
            border: exceptionTriggered ? "2px solid #D4900A" : "none",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>SIMAH</div>
            <div style={{ fontWeight: 700, color: "#C0392B", marginBottom: 4 }}>
              {assessment.simah.file_type === "EMPTY" ? "ملف فارغ" : "ملف شحيح"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              {assessment.simah.note_ar}
            </div>
          </div>

          {/* Repayment capacity */}
          <div style={{ background: "var(--surface)", borderRadius: 18, padding: "16px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>قدرة السداد الشهرية</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: "var(--text-1)", marginBottom: 4 }} dir="ltr">
              {assessment.score.repayment_capacity.toLocaleString()} ريال
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              ٤٥٪ من أدنى دخل شهري × ٨٠٪
            </div>
          </div>
        </div>

        {/* Loan recommendation */}
        {loan && (
          <div style={{
            background: "linear-gradient(135deg, #02141E 0%, #033957 100%)",
            borderRadius: 18, overflow: "hidden", marginBottom: 20,
          }}>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ color: "#CD907E", fontSize: 12, fontWeight: 700 }}>توصية التمويل</div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4,1fr)",
              gap: 1, background: "rgba(255,255,255,0.06)",
            }}>
              {[
                { label: "مبلغ التمويل", value: `${loan.amount.toLocaleString()} ريال` },
                { label: "المدة", value: `${loan.duration_months} شهر` },
                { label: "نسبة الربح", value: `${loan.apr}%` },
                { label: "القسط الشهري", value: `${loan.monthly_installment.toLocaleString()} ريال` },
              ].map(f => (
                <div key={f.label} style={{
                  padding: "16px 14px", background: "rgba(255,255,255,0.04)", textAlign: "center",
                }}>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 6 }}>{f.label}</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }} dir="ltr">{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 14 }} />
          </div>
        )}

        {/* Pipeline status */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "16px 18px",
          marginBottom: 20, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>حالة خط التقييم</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PIPELINE_STEPS.map(step => (
              <div key={step.key} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>{step.ar}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#1A6B3A",
                  background: "#E8F5ED", padding: "3px 10px", borderRadius: 99,
                }}>✓ مكتمل</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wathiq */}
        <div style={{
          background: "var(--surface)", borderRadius: 18, padding: "16px 18px",
          marginBottom: 20, boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>توثيق العملاء — Wathiq</div>
          {assessment.wathiq_results.map((w, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < assessment.wathiq_results.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>{w.trade_name_ar}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }} dir="ltr">
                  CR: {w.cr} — {w.months_active} شهراً نشطاً
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: w.risk_flag ? "#D4900A" : "#1A6B3A",
                background: w.risk_flag ? "#FEF5E4" : "#E8F5ED",
                padding: "4px 12px", borderRadius: 99,
              }}>
                {w.risk_flag ? "⚠ مراجعة" : "✓ موثّق"}
              </span>
            </div>
          ))}
        </div>

        {/* Decision row */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={sendReview}
            disabled={reviewSent}
            style={{
              flex: 1, padding: "14px",
              background: reviewSent ? "#E8F5ED" : "var(--surface)",
              color: reviewSent ? "#1A6B3A" : "var(--text-2)",
              border: `1.5px solid ${reviewSent ? "#1A6B3A" : "var(--border)"}`,
              borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: reviewSent ? "default" : "pointer",
            }}
          >
            {reviewSent ? "✓ تم إرسال المراجعة" : "طلب مراجعة بشرية"}
          </button>
          <button
            onClick={() => alert("تم رفض الطلب")}
            style={{
              flex: 1, padding: "14px",
              background: "#C0392B", color: "#fff",
              border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            رفض
          </button>
          <button
            onClick={() => setApproved(true)}
            style={{
              flex: 1, padding: "14px",
              background: approved
                ? "linear-gradient(135deg, #1A6B3A, #145C30)"
                : "linear-gradient(135deg, #033957 0%, #02141E 100%)",
              color: "#fff", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer",
              transition: "background 0.3s",
            }}
          >
            {approved ? "✓ تمت الموافقة" : "اعتماد التمويل"}
          </button>
        </div>
      </div>
    </div>
  )
}
