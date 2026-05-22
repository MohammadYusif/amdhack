import Link from "next/link";
import { cookies } from "next/headers";
import { api, ScoreResponse, AuditEntry } from "@/lib/api";
import { AlinmaLogo } from "@/components/AlinmaShell";
import TierBadge from "@/components/TierBadge";
import LangToggle from "@/components/LangToggle";

async function getAllScores() {
  const profiles = await api.getProfiles();
  const scores = await Promise.all(
    profiles.map((p) => api.getScore(p.id).catch(() => null))
  );
  return scores.filter(Boolean) as ScoreResponse[];
}

export default async function BankerDashboard() {
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  let scores: ScoreResponse[] = [];
  let auditLog: AuditEntry[] = [];

  try {
    [scores, auditLog] = await Promise.all([getAllScores(), api.getAuditLog()]);
  } catch { /* show empty state */ }

  const STATUS_LABEL: Record<string, string> = {
    GREEN:    isEn ? "Recommended"  : "يُنصح بالموافقة",
    YELLOW:   isEn ? "Needs Review"  : "يحتاج مراجعة",
    BUILDING: isEn ? "Declined"      : "مرفوض",
  };

  const STATUS_STYLE: Record<string, { background: string; color: string }> = {
    GREEN:    { background: "var(--tier-green-bg)",  color: "var(--tier-green-text)"  },
    YELLOW:   { background: "var(--tier-yellow-bg)", color: "var(--tier-yellow-text)" },
    BUILDING: { background: "var(--tier-red-bg)",    color: "var(--tier-red-text)"    },
  };

  const COL_HEADERS = isEn
    ? ["Name", "Profession", "Score", "Tier", "Loan Amount", "Status", "Actions"]
    : ["الاسم", "المهنة", "النتيجة", "المستوى", "مبلغ التمويل", "الحالة", "الإجراءات"];

  const AUDIT_HEADERS = isEn
    ? ["#", "Timestamp", "Applicant", "Score", "Tier", "Event", "Details"]
    : ["#", "التوقيت", "المتقدم", "النتيجة", "المستوى", "الحدث", "التفاصيل"];

  return (
    <div className="banker-page">

      {/* Alinma-style header */}
      <header className="banker-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AlinmaLogo size={30} />
          <div>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
              {isEn ? "Dashboard" : "لوحة تحكم"}
            </p>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
              {isEn ? "Alinma Bank Officer" : "موظف بنك الإنماء"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            background: "rgba(205,144,126,0.20)", color: "#CD907E",
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 99,
          }}>
            {isEn ? "Mihan — Credit Panel" : "مِهَن — لوحة الائتمان"}
          </span>
          <LangToggle initialIsEn={isEn} />
          <Link href="/" style={{
            color: "rgba(255,255,255,0.7)", fontSize: 12, textDecoration: "none",
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            {isEn ? "Customer App" : "عرض تطبيق العميل"}
          </Link>
        </div>
      </header>

      <div className="banker-content">

        {/* Pipeline */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
              {isEn ? "Application Pipeline" : "خط سير الطلبات"}
            </h2>
            <span style={{
              background: "var(--green-light)", color: "var(--green)",
              fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
            }}>
              {scores.length} {isEn ? "applications" : "طلب"}
            </span>
          </div>

          <div style={{
            background: "var(--surface)", borderRadius: 20,
            boxShadow: "var(--shadow-md)", overflow: "hidden",
          }}>

            {/* ── Mobile card view (shown on small screens, hides the table) ── */}
            <div className="banker-mobile-cards">
              {scores.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: 20 }}>
                  {isEn ? "No applications — visit the customer app first" : "لا توجد طلبات — قم بزيارة تطبيق العميل أولاً"}
                </p>
              ) : scores.map(({ profile, score }) => (
                <div key={profile.id} style={{
                  background: "var(--surface-2)", borderRadius: 16,
                  padding: "14px 16px",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)", marginBottom: 2 }}>
                        {isEn ? profile.name_en : profile.name_ar}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                        {isEn ? profile.profession_en : profile.profession_ar}
                      </p>
                    </div>
                    <TierBadge tier={score.tier} size="sm" isEn={isEn} />
                  </div>

                  <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>
                        {isEn ? "Score" : "النتيجة"}
                      </p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }} dir="ltr">
                        {score.composite}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>
                        {isEn ? "Loan Amount" : "مبلغ التمويل"}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }} dir="ltr">
                        {score.loan ? `SAR ${score.loan.amount.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>
                        {isEn ? "Status" : "الحالة"}
                      </p>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        padding: "3px 8px", borderRadius: 99,
                        ...STATUS_STYLE[score.tier],
                      }}>
                        {STATUS_LABEL[score.tier]}
                      </span>
                    </div>
                  </div>

                  <Link href={`/banker/${profile.id}`} style={{
                    display: "block", textAlign: "center",
                    color: "#fff", fontWeight: 600, fontSize: 14,
                    textDecoration: "none",
                    padding: "11px 16px", borderRadius: 10,
                    background: "var(--accent)",
                  }}>
                    {isEn ? "View Details" : "عرض التفاصيل"}
                  </Link>
                </div>
              ))}
            </div>

            {/* ── Desktop table (hidden on small screens) ── */}
            <div className="banker-table-desktop">
              <div className="banker-table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      {COL_HEADERS.map((h) => (
                        <th key={h} style={{
                          padding: "12px 16px", textAlign: "start",
                          fontSize: 11, fontWeight: 700, color: "var(--text-3)",
                          letterSpacing: "0.03em",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scores.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                          {isEn ? "No applications — visit the customer app first" : "لا توجد طلبات — قم بزيارة تطبيق العميل أولاً"}
                        </td>
                      </tr>
                    ) : scores.map(({ profile, score }, i) => (
                      <tr key={profile.id} className="banker-table-row" style={{
                        borderBottom: i < scores.length - 1 ? "1px solid var(--border)" : "none",
                      }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--text-1)" }}>
                          {isEn ? profile.name_en : profile.name_ar}
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-2)" }}>
                          {isEn ? profile.profession_en : profile.profession_ar}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--green)" }}
                          dir="ltr" className="ltr">
                          {score.composite}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <TierBadge tier={score.tier} size="sm" isEn={isEn} />
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-1)", fontWeight: 600 }}
                          dir="ltr" className="ltr">
                          {score.loan ? `SAR ${score.loan.amount.toLocaleString()}` : "—"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            padding: "4px 10px", borderRadius: 99,
                            ...STATUS_STYLE[score.tier],
                          }}>
                            {STATUS_LABEL[score.tier]}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <Link href={`/banker/${profile.id}`} style={{
                            color: "var(--accent)", fontWeight: 600, fontSize: 12,
                            textDecoration: "none",
                            padding: "8px 14px", borderRadius: 8,
                            border: "1px solid var(--accent-light)",
                            background: "var(--accent-light)",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}>
                            {isEn ? "View Details" : "عرض التفاصيل"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Audit log */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
              {isEn ? "Audit Log" : "سجل المراجعة"}
            </h2>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {isEn ? "Read only — for inspectors" : "قراءة فقط — للمفتشين"}
            </span>
          </div>

          <div style={{
            background: "var(--surface)", borderRadius: 20,
            boxShadow: "var(--shadow-sm)", overflow: "hidden",
          }}>
            <div className="banker-table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {AUDIT_HEADERS.map((h) => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "start",
                        fontSize: 11, fontWeight: 700, color: "var(--text-3)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                        {isEn ? "No records yet — assess a profile to start logging" : "لا توجد سجلات بعد — قم بتقييم ملف لبدء التسجيل"}
                      </td>
                    </tr>
                  ) : auditLog.slice(0, 20).map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--text-3)" }} dir="ltr" className="ltr">
                        {entry.id}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--text-3)", whiteSpace: "nowrap" }}
                        dir="ltr" className="ltr">
                        {entry.timestamp}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-1)" }}>
                        {entry.profile_name}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--green)" }}
                        dir="ltr" className="ltr">
                        {entry.composite_score}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <TierBadge tier={entry.tier as "GREEN" | "YELLOW" | "BUILDING"} size="sm" isEn={isEn} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: entry.event === "HUMAN_REVIEW_REQUESTED" ? "#EEE8F8" : "var(--green-light)",
                          color: entry.event === "HUMAN_REVIEW_REQUESTED" ? "#6B3FA0" : "var(--green)",
                        }} dir="ltr" className="ltr">
                          {entry.event}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--text-3)", maxWidth: 240 }}
                        dir="ltr" className="ltr">
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {entry.details}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
