import type { ForwardOutlook } from "@/lib/types";

const panel = {
  background: "var(--surface)",
  borderRadius: 20,
  boxShadow: "var(--shadow-sm)",
  padding: 20,
};

const BAND_COLORS: Record<string, { bg: string; fg: string }> = {
  LOW:      { bg: "var(--tier-green-bg)",  fg: "var(--tier-green-text)" },
  MODERATE: { bg: "var(--tier-yellow-bg)", fg: "var(--tier-yellow-text)" },
  ELEVATED: { bg: "var(--tier-yellow-bg)", fg: "#B25E00" },
  HIGH:     { bg: "var(--tier-red-bg)",    fg: "var(--tier-red-text)" },
};

const BAND_LABEL: Record<string, { ar: string; en: string }> = {
  LOW:      { ar: "منخفض", en: "Low" },
  MODERATE: { ar: "متوسط", en: "Moderate" },
  ELEVATED: { ar: "مرتفع", en: "Elevated" },
  HIGH:     { ar: "عالٍ", en: "High" },
};

const TREND: Record<string, { ar: string; en: string; arrow: string; color: string }> = {
  IMPROVING:     { ar: "متحسّن", en: "Improving", arrow: "↗", color: "var(--tier-green-text)" },
  STABLE:        { ar: "مستقر", en: "Stable", arrow: "→", color: "var(--text-2)" },
  DETERIORATING: { ar: "متراجع", en: "Deteriorating", arrow: "↘", color: "var(--tier-red-text)" },
};

export default function ForwardOutlookPanel({
  outlook,
  isEn,
}: {
  outlook: ForwardOutlook;
  isEn: boolean;
}) {
  const band = BAND_COLORS[outlook.risk_band] ?? BAND_COLORS.MODERATE;
  const bandLabel = BAND_LABEL[outlook.risk_band] ?? BAND_LABEL.MODERATE;
  const trend = TREND[outlook.trend_direction] ?? TREND.STABLE;
  const topSignals = outlook.signals.slice(0, 4);
  const maxContribution = Math.max(...outlook.signals.map((s) => Math.abs(s.contribution)), 0.001);

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
          borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: "var(--accent-light, var(--surface-2))", color: "var(--accent)",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isEn ? "Predictive" : "تنبؤي"}
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
          {isEn ? "Forward-Looking Default Probability" : "احتمالية التعثّر المستقبلية"}
        </p>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        {isEn
          ? `${outlook.horizon_months}-month horizon · hybrid: cash-flow + SIMAH + Wathq`
          : `أفق ${outlook.horizon_months} أشهر · هجين: التدفق النقدي + سمة + واثق`}
      </p>

      {/* Headline PD + band + trend */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{
          background: band.bg, color: band.fg, borderRadius: 16,
          padding: "12px 18px", textAlign: "center", minWidth: 110,
        }}>
          <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }} dir="ltr" className="ltr">
            {outlook.default_probability_6m_pct}%
          </p>
          <p style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
            {isEn ? bandLabel.en : bandLabel.ar}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
            {isEn ? "Income trend" : "اتجاه الدخل"}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: trend.color }}>
            <span aria-hidden="true">{trend.arrow}</span> {isEn ? trend.en : trend.ar}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }} dir="ltr" className="ltr">
            {outlook.trend_pct_per_month > 0 ? "+" : ""}{outlook.trend_pct_per_month}%/mo
          </p>
        </div>
      </div>

      {/* Signal decomposition */}
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
        {isEn ? "Top risk signals (contribution)" : "أبرز إشارات المخاطر (المساهمة)"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {topSignals.map((s) => (
          <div key={s.signal}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: "var(--text-2)" }}>{isEn ? s.label_en : s.label_ar}</span>
              <span style={{ color: "var(--text-3)" }} dir="ltr" className="ltr">
                {s.risk_value.toFixed(2)} × {s.coefficient} = {s.contribution.toFixed(2)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(100, (Math.abs(s.contribution) / maxContribution) * 100)}%`,
                height: "100%", background: band.fg, borderRadius: 999, opacity: 0.8,
              }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.6 }}>
        {isEn ? outlook.method.note_en : outlook.method.note_ar}
      </p>
    </div>
  );
}
