import { cookies } from "next/headers";
import AIDisclosureModal from "@/components/AIDisclosureModal";
import { InnerHeader } from "@/components/AlinmaShell";

export default async function DisclosurePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  const isEn = cookieStore.get("lang")?.value === "en";

  return (
    <div className="app-frame" style={{ position: "relative" }}>
      <InnerHeader
        title={isEn ? "Credit Assessment" : "تقييم الجدارة الائتمانية"}
        subtitle={isEn ? "Mihan · Alinma" : "مِهَن · الإنماء"}
        backHref="/mihan"
        isEn={isEn}
      />
      <div className="scroll-content" style={{ padding: "24px 16px" }}>
        <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
          {isEn ? "Please read the notice below before proceeding" : "يرجى قراءة الإشعار أدناه قبل المتابعة"}
        </p>
      </div>
      <AIDisclosureModal profileId={profileId} isEn={isEn} />
    </div>
  );
}
