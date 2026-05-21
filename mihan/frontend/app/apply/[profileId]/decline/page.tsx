import Link from "next/link";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { InnerHeader, BottomNav } from "@/components/AlinmaShell";
import HumanReviewButton from "@/components/HumanReviewButton";

export default async function DeclinePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  let scoreData, explanation;
  try {
    [scoreData, explanation] = await Promise.all([
      api.getScore(profileId),
      api.getExplanation(profileId, "ar"),
    ]);
  } catch {
    return (
      <div className="app-frame">
        <InnerHeader
          title={isEn ? "Decision Reasons" : "أسباب القرار"}
          backHref={`/apply/${profileId}/score`}
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

  const { score, profile } = scoreData;

  const factors = [
    {
      key: "client_diversity",
      ar: "تنوع العملاء", en: "Client Diversity",
      score: score.factors.client_diversity,
      detailAr: `اعتمادك على عميل واحد يمثل ${scoreData.profile.largest_client_pct}٪ من دخلك يزيد من درجة المخاطرة`,
      detailEn: `Dependence on one client representing ${scoreData.profile.largest_client_pct}% of your income increases risk`,
    },
    {
      key: "savings_behavior",
      ar: "سلوك الادخار", en: "Savings Behavior",
      score: score.factors.savings_behavior,
      detailAr: `معدل ادخارك الحالي أقل من ${scoreData.profile.monthly_savings_pct + 3}٪ من دخلك الشهري`,
      detailEn: `Your current savings rate is below ${scoreData.profile.monthly_savings_pct + 3}% of your monthly income`,
    },
    {
      key: "income_stability",
      ar: "استقرار الدخل", en: "Income Stability",
      score: score.factors.income_stability,
      detailAr: `تاريخ الدخل يمتد لـ ${scoreData.profile.months_of_history} أشهر فقط`,
      detailEn: `Income history spans only ${scoreData.profile.months_of_history} months`,
    },
    {
      key: "expense_discipline",
      ar: "انضباط المصروفات", en: "Expense Discipline",
      score: score.factors.expense_discipline,
      detailAr: "نسبة المصروفات إلى الدخل تتجاوز المستوى المثالي",
      detailEn: "Expense-to-income ratio exceeds the ideal level",
    },
  ]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return (
    <div className="app-frame">
      <InnerHeader
        title={isEn ? "Decision Reasons" : "أسباب القرار"}
        subtitle={isEn ? profile.name_en : profile.name_ar}
        backHref={`/apply/${profileId}/score`}
        isEn={isEn}
      />

      <div className="scroll-content" style={{ padding: "20px 16px 8px" }}>

        {/* Human review button — MUST be at the top per SAMA requirements */}
        <div style={{ marginBottom: 12 }}>
          <HumanReviewButton profileId={profileId} isEn={isEn} />
        </div>

        {/* Decision summary */}
        <div className="card" style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--tier-red-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="var(--tier-red-text)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>
            {isEn ? "Financing eligibility not complete at this time" : "لم تكتمل أهلية التمويل في الوقت الحالي"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            {isEn ? "Your current score: " : "نتيجتك الحالية: "}
            <span style={{ fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">
              {score.composite}/100
            </span>
            {" "}— {isEn ? "Building Level" : "مستوى البناء"}
          </p>
        </div>

        {/* Weak factor cards */}
        <p className="section-title">{isEn ? "Contributing Factors" : "العوامل المؤثرة في القرار"}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {factors.map((f) => (
            <div key={f.key} style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: "14px 16px",
              borderRight: "4px solid var(--tier-red-text)",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: "var(--text-1)", fontSize: 14 }}>
                  {isEn ? f.en : f.ar}
                </span>
                <span style={{ color: "var(--tier-red-text)", fontWeight: 700, fontSize: 13 }} dir="ltr" className="ltr">
                  {f.score}/100
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                {isEn ? f.detailEn : f.detailAr}
              </p>
            </div>
          ))}
        </div>

        {/* AI explanation */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="ai-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="currentColor" />
              </svg>
              {isEn ? "AI" : "ذكاء اصطناعي"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {isEn ? "AI-generated explanation" : "تفسير مُنشأ بالذكاء الاصطناعي"}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}
            aria-label="AI-generated explanation of the credit decision">
            {explanation.text}
          </p>
        </div>

        {/* Roadmap CTA */}
        <Link href={`/apply/${profileId}/roadmap`} className="btn-secondary"
          style={{ display: "block", textDecoration: "none", textAlign: "center", padding: "14px 20px", marginBottom: 12 }}>
          {isEn ? "View Score Improvement Roadmap" : "عرض خطة تحسين تقييمك"}
        </Link>

        <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", paddingBottom: 8 }}>
          {isEn
            ? "The final decision is made by Alinma Bank specialists. You can request human review at any time."
            : "القرار النهائي يتخذه مختصو بنك الإنماء. بإمكانك طلب مراجعة بشرية في أي وقت."}
        </p>

        <div style={{ height: 16 }} />
      </div>

      <BottomNav activeId="finance" isEn={isEn} />
    </div>
  );
}
