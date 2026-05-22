import Link from "next/link";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { InnerHeader, BottomNav } from "@/components/AlinmaShell";

const ROADMAP_STEPS = [
  {
    num: 1,
    titleAr: "أضف عميلاً ثانياً متكرراً",
    titleEn: "Add a Second Recurring Client",
    descAr: "العمل مع عميلين على الأقل يُقلّل من تركّز المخاطر ويرفع درجة تنوع العملاء بشكل كبير",
    descEn: "Working with at least two clients reduces risk concentration and significantly improves your client diversity score",
    impact: "+12",
  },
  {
    num: 2,
    titleAr: "حافظ على تدفق دخل ثابت لـ 3 أشهر",
    titleEn: "Maintain Consistent Income for 3 Months",
    descAr: "الحفاظ على دخل منتظم لمدة 3 أشهر متواصلة يُحسّن درجة استقرار الدخل",
    descEn: "Maintaining a consistent income flow for 3 consecutive months improves your income stability score",
    impact: "+9",
  },
  {
    num: 3,
    titleAr: "ادخر 5٪ من دخلك الشهري تلقائياً",
    titleEn: "Auto-Save 5% of Your Monthly Income",
    descAr: "إعداد تحويل تلقائي بنسبة 5٪ عند استلام كل دفعة يُحسّن درجة سلوك الادخار",
    descEn: "Setting up an automatic transfer of 5% on each payment received improves your savings behavior score",
    impact: "+6",
  },
];

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  let scoreData;
  try {
    scoreData = await api.getScore(profileId);
  } catch {
    return (
      <div className="app-frame">
        <InnerHeader
          title={isEn ? "Improvement Roadmap" : "خطة تحسين التقييم"}
          backHref={`/apply/${profileId}/decline`}
          isEn={isEn}
        />
        <div className="scroll-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Link href="/" style={{ color: "var(--green)", fontSize: 13 }}>
            {isEn ? "Back to Home" : "العودة للرئيسية"}
          </Link>
        </div>
      </div>
    );
  }

  const currentScore = scoreData.score.composite;
  const projectedScore = Math.min(currentScore + 27, 58);
  const progressCurrent = (currentScore / 100) * 100;
  const progressProjected = (projectedScore / 100) * 100;

  return (
    <div className="app-frame">
      <InnerHeader
        title={isEn ? "Improvement Roadmap" : "خطة تحسين التقييم"}
        subtitle={isEn ? "Mihan · Alinma" : "مِهَن · الإنماء"}
        backHref={`/apply/${profileId}/decline`}
        isEn={isEn}
      />

      <div className="scroll-content" style={{ padding: "20px 16px 8px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
            {isEn ? "Steps to Improve Your Score" : "خطوات لتحسين تقييمك"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            {isEn
              ? "Follow these steps to reach Yellow Tier within 3-6 months"
              : "اتبع هذه الخطوات لبلوغ المستوى الأصفر خلال 3-6 أشهر"}
          </p>
        </div>

        {/* Progress comparison card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", textAlign: "center", marginBottom: 16 }}>
            {isEn ? "Expected Score Progress" : "تقدّم النتيجة المتوقع"}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                {isEn ? "Current Score" : "نتيجتك الحالية"}
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-3)" }} dir="ltr" className="ltr">
                {currentScore}
              </p>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ position: "relative", height: 8, background: "var(--surface-2)", borderRadius: 99 }}>
                <div style={{
                  position: "absolute", inset: "0 auto 0 0",
                  width: `${progressProjected}%`,
                  background: "var(--tier-yellow-bg)", borderRadius: 99,
                }} />
                <div style={{
                  position: "absolute", inset: "0 auto 0 0",
                  width: `${progressCurrent}%`,
                  background: "var(--tier-red-text)", borderRadius: 99,
                }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 6 }}>
                {isEn ? "Yellow Tier at 55" : "المستوى الأصفر عند 55"}
              </p>
            </div>

            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                {isEn ? "Projected Score" : "النتيجة المتوقعة"}
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, color: "var(--tier-yellow-text)" }} dir="ltr" className="ltr">
                ~{projectedScore}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
            {isEn ? "Estimated timeline: " : "المدة التقديرية: "}
            <span style={{ fontWeight: 600, color: "var(--text-2)" }}>3-6 {isEn ? "months" : "أشهر"}</span>
          </p>
        </div>

        {/* Step cards */}
        <p className="section-title">{isEn ? "Improvement Steps" : "خطوات التحسين"}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {ROADMAP_STEPS.map((step) => (
            <div key={step.num} className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--green-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 15 }} dir="ltr">{step.num}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, color: "var(--text-1)", fontSize: 14 }}>
                    {isEn ? step.titleEn : step.titleAr}
                  </p>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: "var(--green)", background: "var(--green-light)",
                    padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
                  }} dir="ltr" className="ltr">
                    {step.impact} {isEn ? "pts" : "نقطة"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                  {isEn ? step.descEn : step.descAr}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Re-apply note */}
        <div style={{
          background: "var(--green-light)",
          border: "1px solid var(--green-mid)",
          borderRadius: 16, padding: "14px 16px",
          textAlign: "center", marginBottom: 16,
        }}>
          <p style={{ fontSize: 14, color: "var(--green)", fontWeight: 600, marginBottom: 4 }}>
            {isEn ? "After Applying These Steps" : "بعد تطبيق هذه الخطوات"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            {isEn
              ? "You can submit a new financing application and your score will be automatically recalculated from your updated data"
              : "يمكنك تقديم طلب تمويل جديد وسيُحسب تقييمك تلقائياً من بياناتك المحدّثة"}
          </p>
        </div>

        <Link href="/" className="btn-ghost"
          style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          {isEn ? "Back to Home" : "العودة إلى الرئيسية"}
        </Link>

        <div style={{ height: 16 }} />
      </div>

      <BottomNav activeId="finance" isEn={isEn} />
    </div>
  );
}
