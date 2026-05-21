"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlinmaHeader } from "@/components/AlinmaHeader"
import { getProfiles } from "@/lib/api"
import type { Profile } from "@/lib/types"

const TIER_HINT: Record<string, { tier: string; color: string; hint_ar: string }> = {
  mohammad: { tier: "GREEN",    color: "#1B6B4A", hint_ar: "مطور تطبيقات — ٣ عملاء — درجة خضراء" },
  noura:    { tier: "YELLOW",   color: "#D4900A", hint_ar: "مصممة جرافيك — عميلان — درجة صفراء" },
  fahad:    { tier: "BUILDING", color: "#C0392B", hint_ar: "مصور — عميل واحد — تحت التطوير" },
}

export default function DemoPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const router = useRouter()

  useEffect(() => { getProfiles().then(setProfiles) }, [])

  return (
    <div className="min-h-screen" style={{ background: "#F4F6F9" }}>
      <AlinmaHeader subtitle="تمويل المستقلين — مِهَن" />
      <div className="max-w-md mx-auto p-4 pt-6">

        <div className="mb-6">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">عرض توضيحي</div>
          <h1 className="text-xl font-bold" style={{ color: "#02141E" }}>اختر ملفاً للتجربة</h1>
          <p className="text-sm text-gray-500">ثلاثة سيناريوهات تغطي مختلف حالات العملاء</p>
        </div>

        <div className="space-y-3">
          {profiles.map(p => {
            const hint = TIER_HINT[p.id] || { color: "#999", hint_ar: "" }
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/demo/${p.id}`)}
                className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 text-right hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: hint.color }}>
                  {p.avatar_initials}
                </div>
                <div className="flex-1 text-right">
                  <div className="font-bold text-gray-900">{p.name_ar}</div>
                  <div className="text-xs text-gray-500">{hint.hint_ar}</div>
                </div>
                <div className="text-gray-400 text-lg">←</div>
              </button>
            )
          })}
        </div>

        {/* Mihan branding */}
        <div className="mt-8 text-center">
          <div className="text-xs text-gray-400">مدعوم بـ</div>
          <div className="font-bold text-base" style={{ color: "#02141E" }}>مِهَن × إنماء</div>
          <div className="text-xs text-gray-400">Open Banking — Lean Technologies — Wathiq</div>
        </div>
      </div>
    </div>
  )
}
