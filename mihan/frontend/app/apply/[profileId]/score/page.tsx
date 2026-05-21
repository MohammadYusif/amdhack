import Link from "next/link";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { InnerHeader, BottomNav } from "@/components/AlinmaShell";
import ScoreGauge from "@/components/ScoreGauge";
import TierBadge from "@/components/TierBadge";
import FactorBar from "@/components/FactorBar";
import LoanCard from "@/components/LoanCard";

const FACTOR_LABELS = [
  { key: "expense_discipline", ar: "انضباط المصروفات", en: "Expense Discipline" },
  { key: "income_stability",   ar: "استقرار الدخل",    en: "Income Stability"   },
  { key: "client_diversity",   ar: "تنوع العملاء",     en: "Client Diversity"   },
  { key: "savings_behavior",   ar: "سلوك الادخار",     en: "Savings Behavior"   },
] as const;

export default async function ScorePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  let data;
  try {
    data = await api.getScore(profileId);
  } catch {
    return (
      <div className="app-frame">
        <InnerHeader
          title={isEn ? "Assessment Score" : "نتيجة التقييم"}
          backHref="/mihan"
          isEn={isEn}
        />
        <div className="scroll-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--tier-red-text)", marginBottom: 8 }}>
              {isEn ? "Failed to load score" : "تعذّر تحميل النتيجة"}
            </p>
            <Link href="/mihan" style={{ color: "var(--green)", fontSize: 13 }}>
              {isEn ? "Back" : "العودة"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { profile, score } = data;
  const isDeclined = score.tier === "BUILDING";

  return (
    <div className="app-frame">
      <InnerHeader
        title={isEn ? "Assessment Score" : "نتيجة التقييم"}
        subtitle={isEn ? profile.name_en : profile.name_ar}
        backHref="/mihan"
        isEn={isEn}
      />

      <div className="scroll-content" style={{ padding: "20px 16px 8px" }}>

        {/* Score card */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
            <ScoreGauge score={score.composite} tier={score.tier} />
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <TierBadge tier={score.tier} size="lg" isEn={isEn} />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>
              {isEn ? profile.profession_en : profile.profession_ar}
            </p>
          </div>

          <div className="divider" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                {isEn ? "Lowest Monthly Income" : "أدنى دخل شهري"}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">
                SAR {score.worst_month_income.toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                {isEn ? "Repayment Capacity" : "الطاقة الاستيعابية"}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">
                SAR {score.repayment_capacity.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="section-title" style={{ marginBottom: 16 }}>
            {isEn ? "Assessment Factor Details" : "تفاصيل عوامل التقييم"}
          </p>
          {FACTOR_LABELS.map(({ key, ar, en }) => (
            <FactorBar
              key={key}
              labelAr={ar}
              labelEn={en}
              score={score.factors[key]}
              isEn={isEn}
            />
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
            <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
              {isEn
                ? "Weights: Expenses 35% · Income 30% · Clients 20% · Savings 15%"
                : "الأوزان: المصروفات 35٪ · الدخل 30٪ · العملاء 20٪ · الادخار 15٪"}
            </p>
          </div>
        </div>

        {/* Loan recommendation or decline */}
        {score.loan && !isDeclined ? (
          <div style={{ marginBottom: 12 }}>
            <LoanCard loan={score.loan} isEn={isEn} />
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 12, textAlign: "center" }}>
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
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
              {isEn ? "You can improve your score and apply again" : "يمكنك تحسين تقييمك والتقديم مجدداً"}
            </p>
            <Link href={`/apply/${profileId}/decline`} className="btn-primary" style={{
              display: "block", textDecoration: "none",
              padding: "13px 20px", borderRadius: 12,
              background: "var(--accent)", color: "#fff",
              fontWeight: 600, fontSize: 14, textAlign: "center",
            }}>
              {isEn ? "View Decision Reasons & Improvement Plan" : "عرض أسباب القرار وخطة التحسين"}
            </Link>
          </div>
        )}

        {/* SAMA note */}
        <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", paddingBottom: 8 }}>
          {isEn
            ? "This assessment works in parallel with the SIMAH credit check — it does not replace it"
            : "يعمل هذا التقييم بالتوازي مع فحص سمة الائتماني — لا يحل محله"}
        </p>

        <div style={{ height: 16 }} />
      </div>

      <BottomNav activeId="finance" isEn={isEn} />
    </div>
  );
}
