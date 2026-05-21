"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlinmaHeader } from "@/components/AlinmaHeader"
import { simulateRejection } from "@/lib/api"

export default function HomePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<"loan-form" | "rejection" | "mihan-entry">("loan-form")
  const [rejection, setRejection] = useState<{ reason_ar: string; suggestion_ar: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleApply() {
    setLoading(true)
    const result = await simulateRejection()
    setRejection(result)
    setPhase("rejection")
    setLoading(false)
  }

  if (phase === "rejection" && rejection) {
    return (
      <div className="min-h-screen" style={{ background: "#F4F6F9" }}>
        <AlinmaHeader subtitle="تمويل شخصي" />
        <div className="max-w-md mx-auto p-4 pt-8">

          {/* Rejection card */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-lg mb-4">
            <div className="p-4 text-center" style={{ background: "#C0392B" }}>
              <div className="text-white text-4xl mb-2">✗</div>
              <div className="text-white font-bold text-lg">لم تتم الموافقة على طلبك</div>
            </div>
            <div className="p-6 text-center">
              <div className="text-gray-700 mb-2 text-sm font-medium">سبب الرفض</div>
              <div className="text-gray-900 font-semibold mb-6">{rejection.reason_ar}</div>

              {/* The pivot moment */}
              <div className="rounded-xl p-4 border-2 border-dashed"
                style={{ borderColor: "#1B6B4A", background: "#E8F5EE" }}>
                <div className="text-sm mb-3" style={{ color: "#1B6B4A" }}>
                  {rejection.suggestion_ar}
                </div>
                <button
                  onClick={() => setPhase("mihan-entry")}
                  className="w-full py-3 rounded-xl text-white font-bold text-base"
                  style={{ background: "#02141E" }}>
                  ابدأ مع مِهَن ←
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    )
  }

  if (phase === "mihan-entry") {
    router.push("/demo")
    return null
  }

  // Default: fake Alinma loan form
  return (
    <div className="min-h-screen" style={{ background: "#F4F6F9" }}>
      <AlinmaHeader subtitle="تمويل شخصي" />
      <div className="max-w-md mx-auto p-4 pt-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: "#02141E" }}>طلب تمويل شخصي</h1>
        <p className="text-sm text-gray-500 mb-6">يرجى إدخال بياناتك للحصول على التمويل</p>

        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
            <input className="w-full border rounded-lg p-3 text-sm" placeholder="خالد المطيري" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">جهة العمل</label>
            <input className="w-full border rounded-lg p-3 text-sm" placeholder="عامل حر / مستقل" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تحويل الراتب</label>
            <select className="w-full border rounded-lg p-3 text-sm bg-white">
              <option>لا — أنا عامل حر</option>
              <option>نعم — يتم تحويل راتبي لإنماء</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ التمويل المطلوب</label>
            <input className="w-full border rounded-lg p-3 text-sm" placeholder="٦٠,٠٠٠ ريال" readOnly />
          </div>

          <button
            onClick={handleApply}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-base"
            style={{ background: loading ? "#999" : "#02141E" }}>
            {loading ? "جارٍ المعالجة..." : "تقديم الطلب"}
          </button>
        </div>
      </div>
    </div>
  )
}
