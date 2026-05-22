import Link from "next/link";
import { cookies } from "next/headers";
import { api, ProfileSummary } from "@/lib/api";
import { InnerHeader, BottomNav } from "@/components/AlinmaShell";

async function getProfiles(): Promise<ProfileSummary[]> {
  try { return await api.getProfiles(); }
  catch { return []; }
}

const TIER_PREVIEW: Record<string, { labelAr: string; labelEn: string; color: string; bg: string }> = {
  mohammad: { labelAr: "أخضر",  labelEn: "Green",    color: "var(--tier-green-text)",  bg: "var(--tier-green-bg)"  },
  noura:    { labelAr: "أصفر",  labelEn: "Yellow",   color: "var(--tier-yellow-text)", bg: "var(--tier-yellow-bg)" },
  fahad:    { labelAr: "تطوير", labelEn: "Building", color: "var(--tier-red-text)",    bg: "var(--tier-red-bg)"    },
};

export default async function MihanHubPage() {
  const profiles = await getProfiles();
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  return (
    <div className="app-frame">
      <InnerHeader
        title={isEn ? "Freelancer Finance" : "تمويل المستقلين"}
        subtitle={isEn ? "Mihan · Powered by Alinma" : "مِهَن · مدعوم من الإنماء"}
        backHref="/"
        isEn={isEn}
      />

      <div className="scroll-content" style={{ padding: "20px 16px 8px" }}>

        {/* Hero info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "var(--green-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                  stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
                {isEn ? "Mihan Financing Service" : "خدمة مِهَن للتمويل"}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                {isEn
                  ? <>AI credit scoring designed for Saudi freelancers. Instant decision, financing up to{" "}
                      <span className="ltr" dir="ltr">SAR 60,000</span>.</>
                  : <>نظام تسجيل ائتماني ذكي مصمم خصيصاً للمستقلين السعوديين. قرار فوري، تمويل يصل إلى{" "}
                      <span className="ltr" dir="ltr">SAR 60,000</span>.</>}
              </p>
            </div>
          </div>

          <div className="divider" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { value: "79%",        label: isEn ? "Top Score"    : "أعلى نتيجة"   },
              { value: "5",          label: isEn ? "Factors"      : "عوامل التحليل" },
              { value: isEn ? "Instant" : "فوري", label: isEn ? "Decision" : "القرار" },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>{value}</p>
                <p style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SAMA disclosure strip */}
        <div style={{
          background: "var(--gold-light)",
          border: "1px solid #DFC0B5",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 20,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#A0503A" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 12, color: "#8B3E28", lineHeight: 1.5 }}>
            {isEn
              ? "This service uses AI to analyze data. The final decision is made by Alinma Bank specialists in accordance with SAMA regulations."
              : "هذه الخدمة تستخدم الذكاء الاصطناعي في تحليل البيانات. القرار النهائي يتخذه مختصو بنك الإنماء وفق أنظمة ساما."}
          </p>
        </div>

        {/* Profile picker */}
        <p className="section-title">{isEn ? "Select Assessment Profile" : "اختر ملف التقييم"}</p>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14, marginTop: -8 }}>
          {isEn ? "Demo profiles for demonstration" : "بيانات تجريبية للعرض"}
        </p>

        {profiles.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p style={{ color: "var(--text-3)", fontSize: 14 }}>
              {isEn ? "Could not connect to server" : "تعذّر الاتصال بالخادم"}
            </p>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 4 }} className="ltr" dir="ltr">
              Start backend: uvicorn main:app --port 9000
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} isEn={isEn} />
            ))}
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>

      <BottomNav activeId="finance" isEn={isEn} />
    </div>
  );
}

function ProfileCard({ profile, isEn }: { profile: ProfileSummary; isEn: boolean }) {
  const tier = TIER_PREVIEW[profile.id];
  return (
    <Link href={`/apply/${profile.id}/disclosure`} style={{ textDecoration: "none" }}>
      <div className="card" style={{
        display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer", transition: "box-shadow 0.15s",
      }}>
        {/* Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "var(--green-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--green)", fontWeight: 700, fontSize: 13,
          flexShrink: 0, letterSpacing: 1,
        }}>
          {profile.avatar_initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>
              {isEn ? profile.name_en : profile.name_ar}
            </p>
            {tier && (
              <span style={{
                background: tier.bg, color: tier.color,
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 99,
              }}>
                {isEn ? tier.labelEn : tier.labelAr}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            {isEn ? profile.profession_en : profile.profession_ar}
          </p>
        </div>

        {/* Arrow */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-3)", flexShrink: 0 }}>
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    </Link>
  );
}
