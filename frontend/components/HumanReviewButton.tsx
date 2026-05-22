"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function HumanReviewButton({ profileId, isEn = false }: { profileId: string; isEn?: boolean }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  const handleClick = async () => {
    try {
      await api.requestHumanReview(profileId, "Requested from applicant decline screen");
      setState("sent");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div
        role="status"
        style={{
          width: "100%", padding: "16px 20px",
          borderRadius: 14, textAlign: "center",
          background: "var(--tier-green-bg)",
          border: "1.5px solid #A8D8B8",
          color: "var(--tier-green-text)", fontWeight: 600, fontSize: 14,
        }}
      >
        {isEn
          ? "Human review request sent — an Alinma Bank specialist will contact you."
          : "تم إرسال طلب المراجعة البشرية — سيتواصل معك متخصص من بنك الإنماء"}
      </div>
    );
  }

  const errorText = isEn ? "Error — please try again" : "حدث خطأ — حاول مرة أخرى";
  const idleText  = isEn ? "Request Human Review"     : "طلب مراجعة بشرية";

  return (
    <button
      onClick={handleClick}
      className="btn-primary"
      aria-label={isEn
        ? "Request human review of the financing decision from an Alinma Bank specialist"
        : "طلب مراجعة بشرية لقرار التمويل من متخصص في بنك الإنماء"}
      style={{ gap: 10 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z"
          stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {state === "error" ? errorText : idleText}
    </button>
  );
}
