import type { LoanRecommendation } from "@/lib/api";

interface LoanCardProps {
  loan: LoanRecommendation;
  isEn?: boolean;
}

export default function LoanCard({ loan, isEn = false }: LoanCardProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #033957 0%, #02141E 100%)",
      borderRadius: 20, padding: "18px 20px", position: "relative", overflow: "hidden",
    }}>
      {/* Decorative circles */}
      <div style={{
        position: "absolute", left: -20, top: -20,
        width: 100, height: 100, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
      }} />
      <div style={{
        position: "absolute", left: 10, bottom: -30,
        width: 70, height: 70, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />

      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 14 }}>
        {isEn ? "Financing Recommendation" : "التوصية بالتمويل"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <LoanStat
          label={isEn ? "Loan Amount" : "مبلغ التمويل"}
          value={`SAR ${loan.amount.toLocaleString()}`}
          large
        />
        <LoanStat
          label={isEn ? "Duration" : "مدة السداد"}
          value={isEn ? `${loan.duration_months} months` : `${loan.duration_months} شهراً`}
        />
        <LoanStat
          label={isEn ? "Annual Profit Rate" : "نسبة الربح السنوية"}
          value={`${loan.apr}%`}
        />
        <LoanStat
          label={isEn ? "Monthly Installment" : "القسط الشهري"}
          value={`SAR ${loan.monthly_installment.toLocaleString()}`}
        />
      </div>
    </div>
  );
}

function LoanStat({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.12)",
      backdropFilter: "blur(8px)",
      borderRadius: 12, padding: "10px 12px",
    }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{
        color: "#fff", fontWeight: 700,
        fontSize: large ? 17 : 14,
      }} dir="ltr" className="ltr">
        {value}
      </p>
    </div>
  );
}
