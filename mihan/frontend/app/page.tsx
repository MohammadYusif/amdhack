"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { PhoneFrame, StatusBar } from "@/components/PhoneFrame"
import { simulateRejection } from "@/lib/api"
import { AlinmaLogo } from "@/components/AlinmaShell"

type Phase = "form" | "rejection" | "pivot"

const FORM_FIELDS = [
  { label: "الاسم الكامل", placeholder: "خالد المطيري", type: "text" },
  { label: "رقم الهوية الوطنية", placeholder: "1234567890", type: "text" },
  { label: "جهة العمل", placeholder: "عامل حر / مستقل", type: "text" },
  { label: "مبلغ التمويل المطلوب", placeholder: "٦٠٬٠٠٠ ريال", type: "text" },
]

export default function HomePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("form")
  const [rejection, setRejection] = useState<{ reason_ar: string; suggestion_ar: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [noSalaryTransfer, setNoSalaryTransfer] = useState(true)

  async function handleApply() {
    setLoading(true)
    try {
      const result = await simulateRejection()
      setRejection(result)
      setPhase("rejection")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PhoneFrame dark={phase === "form" || phase === "rejection" ? false : false}>
      <AnimatePresence mode="wait">
        {phase === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div style={{
              background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
              padding: "14px 20px 22px", flexShrink: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlinmaLogo size={28} />
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>بنك الإنماء</div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>ALINMA BANK</div>
                  </div>
                </div>
                <div style={{
                  background: "rgba(205,144,126,0.18)", border: "1px solid rgba(205,144,126,0.35)",
                  borderRadius: 10, padding: "5px 12px", color: "#CD907E", fontSize: 11, fontWeight: 700,
                }}>
                  تمويل شخصي
                </div>
              </div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                طلب التمويل الشخصي
              </div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                يرجى إدخال بياناتك للمتابعة
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {FORM_FIELDS.map((f) => (
                  <div key={f.label}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      readOnly
                      defaultValue={f.placeholder}
                      style={{
                        width: "100%", padding: "13px 14px",
                        background: "var(--surface)",
                        border: "1.5px solid var(--border)",
                        borderRadius: 12, fontSize: 14, color: "var(--text-1)",
                        fontFamily: "inherit", outline: "none",
                      }}
                    />
                  </div>
                ))}

                {/* Salary transfer toggle */}
                <div style={{
                  background: "var(--surface)", borderRadius: 14,
                  border: "1.5px solid var(--border)", padding: "14px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>
                    تحويل الراتب
                  </div>
                  {[
                    { val: false, label: "نعم — راتبي يُحوَّل إلى بنك الإنماء" },
                    { val: true,  label: "لا — أنا عامل حر / مستقل" },
                  ].map((opt) => (
                    <label key={String(opt.val)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 0", cursor: "pointer", fontSize: 13, color: "var(--text-1)",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${noSalaryTransfer === opt.val ? "var(--accent)" : "var(--border-dark)"}`,
                        background: noSalaryTransfer === opt.val ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                        onClick={() => setNoSalaryTransfer(opt.val)}>
                        {noSalaryTransfer === opt.val && (
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                        )}
                      </div>
                      {opt.label}
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleApply}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "16px", marginTop: 4,
                    background: loading ? "#8899AA" : "linear-gradient(135deg, #033957 0%, #02141E 100%)",
                    color: "#fff", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                      جارٍ المعالجة...
                    </>
                  ) : "تقديم الطلب"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "rejection" && rejection && (
          <motion.div
            key="rejection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {/* Dark header */}
            <div style={{
              background: "linear-gradient(160deg, #033957 0%, #02141E 100%)",
              padding: "14px 20px 20px", flexShrink: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlinmaLogo size={26} />
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>ALINMA BANK</div>
                </div>
                <div style={{
                  background: "rgba(192,57,43,0.25)", border: "1px solid rgba(192,57,43,0.5)",
                  borderRadius: 10, padding: "5px 12px", color: "#FF6B5B", fontSize: 11, fontWeight: 700,
                }}>
                  قرار الطلب
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 24px" }}>

              {/* Error banner — NO_SALARY_TRANSFER */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{
                  background: "linear-gradient(135deg, #C0392B 0%, #96281B 100%)",
                  borderRadius: 18, padding: "18px 18px", marginBottom: 16,
                  overflow: "hidden", position: "relative",
                }}>
                <div style={{
                  position: "absolute", top: -20, right: -20,
                  width: 100, height: 100,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "50%",
                }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.8" />
                      <path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div style={{
                      background: "rgba(255,255,255,0.2)", borderRadius: 6,
                      padding: "2px 8px", fontSize: 10, fontWeight: 700,
                      color: "#fff", display: "inline-block", marginBottom: 6,
                      letterSpacing: "0.5px", direction: "ltr",
                    }}>
                      NO_SALARY_TRANSFER
                    </div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      لم تتم الموافقة على طلبك
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.6 }}>
                      {rejection.reason_ar}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Pivot gate */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                style={{
                  background: "linear-gradient(135deg, #02141E 0%, #04243A 100%)",
                  borderRadius: 20, padding: "18px",
                  border: "1.5px solid rgba(205,144,126,0.4)",
                  boxShadow: "0 0 0 1px rgba(205,144,126,0.1), 0 8px 24px rgba(2,20,30,0.3)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{
                    background: "rgba(205,144,126,0.2)", borderRadius: 8,
                    padding: "4px 10px", color: "#CD907E", fontSize: 11, fontWeight: 700,
                  }}>
                    مسار بديل
                  </div>
                  <div style={{
                    background: "rgba(27,107,74,0.25)", borderRadius: 8,
                    padding: "4px 10px", color: "#5CB88A", fontSize: 11, fontWeight: 600,
                  }}>
                    متاح الآن
                  </div>
                </div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                  هل أنت عامل حر أو مزود خدمة مستقل؟
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
                  {rejection.suggestion_ar}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => router.push("/demo")}
                    style={{
                      width: "100%", padding: "15px",
                      background: "linear-gradient(135deg, #CD907E 0%, #C5926B 100%)",
                      color: "#fff", border: "none", borderRadius: 14,
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: "rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 900,
                    }}>م</div>
                    ابدأ مسار مِهَن للمستقلين
                  </button>
                  <button
                    onClick={() => setPhase("form")}
                    style={{
                      width: "100%", padding: "13px",
                      background: "transparent", color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
                      fontSize: 13, cursor: "pointer",
                    }}>
                    العودة لتعديل الطلب
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PhoneFrame>
  )
}
