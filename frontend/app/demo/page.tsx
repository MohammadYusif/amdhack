"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { PhoneFrame } from "@/components/PhoneFrame"
import { AlinmaLogo } from "@/components/AlinmaShell"
import { getProfiles } from "@/lib/api"
import type { Profile } from "@/lib/types"

const TIER_META: Record<string, {
  tier: string; color: string; bg: string; borderColor: string;
  hint_ar: string; profession_icon: string;
}> = {
  mohammad: {
    tier: "GREEN", color: "#1A6B3A", bg: "#E8F5ED", borderColor: "rgba(26,107,58,0.3)",
    hint_ar: "مطور تطبيقات · ٣ عملاء موثّقين",
    profession_icon: "💻",
  },
  noura: {
    tier: "YELLOW", color: "#8A5F00", bg: "#FEF5E4", borderColor: "rgba(138,95,0,0.3)",
    hint_ar: "مصممة جرافيك · عميلان",
    profession_icon: "🎨",
  },
  fahad: {
    tier: "BUILDING", color: "#8B1A1A", bg: "#FDE8E8", borderColor: "rgba(139,26,26,0.3)",
    hint_ar: "مصور · عميل واحد",
    profession_icon: "📸",
  },
}

const TIER_LABELS: Record<string, string> = {
  GREEN: "أخضر — مؤهّل",
  YELLOW: "أصفر — مشروط",
  BUILDING: "قيد التأهيل",
}

export default function DemoPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    getProfiles()
      .then(setProfiles)
      .finally(() => setLoading(false))
  }, [])

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
              <button onClick={() => router.push("/")} style={{
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
              background: "rgba(205,144,126,0.2)", border: "1px solid rgba(205,144,126,0.35)",
              borderRadius: 10, padding: "5px 12px", color: "#CD907E", fontSize: 11, fontWeight: 700,
            }}>
              عرض توضيحي
            </div>
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            اختر سيناريو العرض
          </div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
            ٣ حالات توضيحية تغطي مختلف نتائج التقييم
          </div>
        </div>

        {/* Profile list */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 24px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 88, borderRadius: 18,
                  background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)",
                  backgroundSize: "800px 100%",
                  animation: "shimmer 1.4s ease-in-out infinite",
                }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {profiles.map((p, idx) => {
                const meta = TIER_META[p.id] ?? { color: "#999", bg: "#F5F5F5", borderColor: "transparent", hint_ar: "", profession_icon: "👤", tier: "GREEN" }
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    onClick={() => router.push(`/demo/${p.id}`)}
                    style={{
                      width: "100%", background: "var(--surface)",
                      borderRadius: 18, border: `1.5px solid ${meta.borderColor}`,
                      padding: "16px", cursor: "pointer", textAlign: "right",
                      display: "flex", alignItems: "center", gap: 14,
                      boxShadow: "var(--shadow-sm)",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ boxShadow: "var(--shadow-md)" }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                      background: meta.bg,
                      border: `1.5px solid ${meta.borderColor}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>
                      {meta.profession_icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, justifyContent: "flex-end" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>
                          {p.name_ar}
                        </span>
                        <span style={{
                          background: meta.bg, color: meta.color,
                          fontSize: 10, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 99,
                        }}>
                          {TIER_LABELS[meta.tier]}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{meta.hint_ar}</div>
                    </div>

                    {/* Arrow */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-3)", flexShrink: 0 }}>
                      <path d="M9 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.button>
                )
              })}
            </div>
          )}

          {/* Footer branding */}
          <div style={{ marginTop: 28, textAlign: "center", paddingBottom: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>مدعوم بـ</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {["Open Banking · SAMA ٢٠٢٦", "Lean Technologies", "Wathiq"].map(s => (
                <span key={s} style={{
                  fontSize: 11, color: "var(--text-3)",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 99, padding: "3px 10px",
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
