import Link from "next/link";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { AlinmaLogo } from "@/components/AlinmaShell";
import ScoreGauge from "@/components/ScoreGauge";
import TierBadge from "@/components/TierBadge";
import FactorBar from "@/components/FactorBar";
import LangToggle from "@/components/LangToggle";

const FACTOR_LABELS = [
  { key: "expense_discipline", ar: "انضباط المصروفات", en: "Expense Discipline" },
  { key: "income_stability",   ar: "استقرار الدخل",    en: "Income Stability"   },
  { key: "client_diversity",   ar: "تنوع العملاء",     en: "Client Diversity"   },
  { key: "savings_behavior",   ar: "سلوك الادخار",     en: "Savings Behavior"   },
] as const;

export default async function ApplicantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  let scoreData, explanation;
  try {
    [scoreData, explanation] = await Promise.all([
      api.getScore(id),
      api.getExplanation(id, "ar"),
    ]);
  } catch {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Link href="/banker" style={{ color: "var(--green)", textDecoration: "underline" }}>
          {isEn ? "Back" : "العودة"}
        </Link>
      </div>
    );
  }

  const { profile, score } = scoreData;

  const panel = {
    background: "var(--surface)", borderRadius: 20,
    boxShadow: "var(--shadow-sm)", padding: 20,
  };

  return (
    <div className="banker-page">

      {/* Header */}
      <header className="banker-header" style={{ gap: 16, justifyContent: "flex-start" }}>
        <AlinmaLogo size={28} />
        <Link href="/banker" style={{
          color: "rgba(255,255,255,0.7)", fontSize: 12, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {isEn ? "Applications List" : "قائمة الطلبات"}
        </Link>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />

        <div style={{ flex: 1 }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
            {isEn ? profile.name_en : profile.name_ar}
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
            {isEn ? profile.profession_en : profile.profession_ar}
          </p>
        </div>

        <TierBadge tier={score.tier} size="md" isEn={isEn} />
        <LangToggle initialIsEn={isEn} />
      </header>

      <div className="banker-content banker-detail-grid">

        {/* Left column — scores */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score panel */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
              {isEn ? "Mihan Score" : "نتيجة مِهَن"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <ScoreGauge score={score.composite} tier={score.tier} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  [isEn ? "Lowest Month"    : "أدنى شهر",          `SAR ${score.worst_month_income.toLocaleString()}`],
                  [isEn ? "Repayment Cap."  : "الطاقة الاستيعابية", `SAR ${score.repayment_capacity.toLocaleString()}`],
                  [isEn ? "History Period"  : "مدة السجل",           `${profile.months_of_history} ${isEn ? "mo." : "أشهر"}`],
                  [isEn ? "Client Count"    : "عدد العملاء",         `${profile.client_count}`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{label}: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}
                      dir="ltr" className="ltr">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Factor breakdown */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
              {isEn ? "Factor Details" : "تفاصيل العوامل"}
            </p>
            {FACTOR_LABELS.map(({ key, ar, en }) => (
              <FactorBar key={key} labelAr={ar} labelEn={en} score={score.factors[key]} isEn={isEn} />
            ))}
          </div>

          {/* SIMAH mock */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
              {isEn ? "SIMAH Credit Bureau" : "سمة الائتماني"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "var(--tier-green-text)", flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tier-green-text)" }}>
                {isEn ? "No negative records" : "لا توجد سجلات سلبية"}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }} dir="ltr" className="ltr">
              SIMAH: Thin file — no derogatory marks · Checked concurrently
            </p>
          </div>
        </div>

        {/* Right column — decisions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* AI explanation */}
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
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
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>{explanation.text}</p>
          </div>

          {/* Loan recommendation */}
          {score.loan && (
            <div style={panel}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
                {isEn ? "Financing Recommendation" : "توصية التمويل"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  [isEn ? "Loan Amount"       : "مبلغ التمويل",    `SAR ${score.loan.amount.toLocaleString()}`],
                  [isEn ? "Duration"           : "مدة السداد",      `${score.loan.duration_months} ${isEn ? "mo." : "شهراً"}`],
                  [isEn ? "Profit Rate"        : "نسبة الربح",      `${score.loan.apr}%`],
                  [isEn ? "Monthly Installment": "القسط الشهري",    `SAR ${score.loan.monthly_installment.toLocaleString()}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review notes + actions */}
          <div style={panel}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>
              {isEn ? "Review Notes" : "ملاحظات المراجعة"}
            </p>
            <textarea
              style={{
                width: "100%", border: "1.5px solid var(--border)", borderRadius: 12,
                padding: "12px 14px", fontSize: 13, color: "var(--text-1)",
                background: "var(--surface-2)", fontFamily: "inherit",
                resize: "none", outline: "none", direction: isEn ? "ltr" : "rtl",
              }}
              rows={3}
              placeholder={isEn ? "Add your notes here..." : "أضف ملاحظاتك هنا..."}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none",
                background: "var(--accent)", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{isEn ? "Approve" : "موافقة"}</button>
              <button style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none",
                background: "var(--tier-red-bg)", color: "var(--tier-red-text)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{isEn ? "Decline" : "رفض"}</button>
              <button style={{
                flex: 1, padding: "10px", borderRadius: 10,
                border: "1.5px solid var(--border-dark)",
                background: "transparent", color: "var(--text-2)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{isEn ? "Escalate" : "تصعيد"}</button>
            </div>
          </div>

          {/* PDF download */}
          <a
            href={api.proofOfIncomeUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 14, textDecoration: "none",
              background: "var(--green-light)", color: "var(--green)",
              border: "1.5px solid var(--green-mid)", fontWeight: 600, fontSize: 13,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21H19.44a2 2 0 001.94-1.515L22 17"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isEn ? "Download Digital Proof of Income (PDF)" : "تحميل إفادة الدخل الرقمية (PDF)"}
          </a>
        </div>
      </div>
    </div>
  );
}
