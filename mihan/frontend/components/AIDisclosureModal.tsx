"use client";
import { useRouter } from "next/navigation";

interface Props {
  profileId: string;
  isEn?: boolean;
}

export default function AIDisclosureModal({ profileId, isEn = false }: Props) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-disclosure-title"
        aria-describedby="ai-disclosure-body"
        className="disclosure-sheet"
        style={{
          background: "var(--surface)",
          borderRadius: "24px 24px 0 0",
          padding: "28px 20px 36px",
          width: "100%",
          maxWidth: 430,
        }}
      >
        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--green-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 9v5m0-8.5h.01"
                stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Handle */}
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          width: 36, height: 4, borderRadius: 99,
          background: "var(--border-dark)", opacity: 0.5,
        }} />

        <h2 id="ai-disclosure-title" style={{
          fontSize: 18, fontWeight: 700, color: "var(--text-1)",
          textAlign: "center", marginBottom: 12,
        }}>
          {isEn ? "Important Notice — AI Usage" : "إشعار مهم — استخدام الذكاء الاصطناعي"}
        </h2>

        <p id="ai-disclosure-body" style={{
          fontSize: 14, color: "var(--text-2)", lineHeight: 1.7,
          textAlign: "center", marginBottom: 20,
        }}>
          {isEn
            ? <>This assessment uses artificial intelligence to analyze your financial data and provide a credit recommendation.{" "}
                <strong style={{ color: "var(--text-1)" }}>The final decision is made by Alinma Bank specialists</strong>,
                and you can request human review at any time.</>
            : <>يستخدم هذا التقييم الذكاء الاصطناعي لتحليل بياناتك المالية وتقديم توصية ائتمانية.{" "}
                <strong style={{ color: "var(--text-1)" }}>القرار النهائي يتخذه مختصو بنك الإنماء</strong>،
                وبإمكانك طلب مراجعة بشرية في أي وقت.</>
          }
        </p>

        {/* SAMA note */}
        <div style={{
          background: "var(--gold-light)",
          border: "1px solid #DFC0B5",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex", gap: 10, alignItems: "flex-start",
          marginBottom: 24,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#A0503A" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 12, color: "#8B3E28", lineHeight: 1.5 }}>
            {isEn
              ? "This notice is required by the Saudi Central Bank (SAMA) for AI-powered applications."
              : "هذا الإشعار مطلوب بموجب أنظمة البنك المركزي السعودي (ساما) لتطبيقات الذكاء الاصطناعي"}
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => router.push(`/apply/${profileId}/score`)}
          autoFocus
        >
          {isEn ? "I Understand, Proceed" : "فهمت، أريد المتابعة"}
        </button>
      </div>
    </div>
  );
}
