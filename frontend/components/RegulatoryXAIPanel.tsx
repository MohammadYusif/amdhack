import type { RegulatoryExplainability } from "@/lib/types";

const panel = {
  background: "var(--surface)",
  borderRadius: 20,
  boxShadow: "var(--shadow-sm)",
  padding: 20,
};

const chip = (bg: string, color: string) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color,
});

export default function RegulatoryXAIPanel({
  xai,
  isEn,
}: {
  xai: RegulatoryExplainability;
  isEn: boolean;
}) {
  const dbr = xai.dbr_justification;
  const aa = xai.adverse_action;
  const caut = xai.cautionary;
  const fc = xai.fairness_check;

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={chip("var(--green-light)", "var(--green)")}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          XAI
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
          {isEn ? "Auditor-Ready Justification" : "تبرير جاهز للتدقيق"}
        </p>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        {isEn
          ? "Exact factor attribution · fair-lending adverse-action · bias-checked inputs"
          : "إسناد دقيق للعوامل · إشعار إجراء سلبي عادل · مدخلات خاضعة لفحص التحيّز"}
      </p>

      {/* Principal factors — exact contribution to the composite */}
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
        {isEn ? "Principal factors (exact contribution)" : "العوامل الرئيسية (المساهمة الدقيقة)"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {xai.principal_factors.map((f) => (
          <div key={f.factor}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: "var(--text-2)" }}>{isEn ? f.label_en : f.label_ar}</span>
              <span style={{ color: "var(--text-3)" }} dir="ltr" className="ltr">
                {f.score}/100 · {f.weight_pct}% → {f.contribution_pct}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(100, f.contribution_pct)}%`, height: "100%",
                background: "var(--accent)", borderRadius: 999,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* DBR affordability arithmetic */}
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
        {isEn ? "DBR affordability (SAMA Art. 14(b))" : "القدرة على السداد (ساما م.14(ب))"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          [isEn ? "Income basis" : "أساس الدخل", `SAR ${dbr.income_basis_sar.toLocaleString()}`],
          [isEn ? "DBR cap" : "سقف النسبة", `${dbr.dbr_cap_pct}%`],
          [isEn ? "Max installment" : "أقصى قسط", `SAR ${dbr.max_affordable_installment_sar.toLocaleString()}`],
          [isEn ? "Offered installment" : "القسط المعروض", `SAR ${dbr.offered_installment_sar.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }} dir="ltr" className="ltr">{value}</p>
          </div>
        ))}
      </div>
      {dbr.dbr_compressed && (
        <div style={{ ...chip("var(--tier-yellow-bg)", "var(--tier-yellow-text)"), marginBottom: 12 }}>
          {isEn
            ? "⚠ Offer compressed to the 45% DBR ceiling"
            : "⚠ تم تخفيض العرض إلى سقف نسبة الدين 45%"}
        </div>
      )}

      {/* Adverse-action notice (only when adverse) */}
      {aa && (
        <div style={{
          background: "var(--tier-red-bg)", borderRadius: 12, padding: "12px 14px", marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--tier-red-text)", marginBottom: 6 }}>
            {isEn ? "Adverse-action notice — principal reasons" : "إشعار الإجراء السلبي — الأسباب الرئيسية"}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {aa.principal_reasons.map((r) => (
              <li key={r.code} style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                {isEn ? r.reason_en : r.reason_ar}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cautionary transparency (margin of transparency) */}
      {caut && (
        <div style={{
          background: "var(--tier-yellow-bg)", borderRadius: 12, padding: "12px 14px", marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--tier-yellow-text)", marginBottom: 6 }}>
            {isEn ? "Cautionary — approaching the boundary" : "تنبيه — قريب من الحدّ"}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {caut.marginal_approval && (
              <li style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                {isEn ? caut.marginal_approval.reason_en : caut.marginal_approval.reason_ar}
              </li>
            )}
            {caut.watch_factors.map((w) => (
              <li key={w.code} style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
                {isEn ? w.reason_en : w.reason_ar}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fairness attestation */}
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
        {isEn ? "Fairness attestation" : "إقرار العدالة"}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={chip("var(--green-light)", "var(--green)")}>
          {isEn
            ? `${fc.protected_attributes_used_in_score.length} protected attributes used`
            : `${fc.protected_attributes_used_in_score.length} خاصية محمية مستخدمة`}
        </span>
        <span style={chip("var(--green-light)", "var(--green)")}>
          {isEn ? `AI payload PII: ${fc.ai_payload_pii_exposure}` : `بيانات الذكاء: ${fc.ai_payload_pii_exposure}`}
        </span>
        {fc.human_in_the_loop && (
          <span style={chip("var(--green-light)", "var(--green)")}>
            {isEn ? "Human-in-the-loop" : "مراجعة بشرية إلزامية"}
          </span>
        )}
      </div>
      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 10, lineHeight: 1.6 }}>
        {isEn ? fc.model_note_en : fc.model_note_ar}
      </p>
    </div>
  );
}
