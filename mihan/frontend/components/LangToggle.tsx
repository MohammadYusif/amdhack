"use client";
import { useState } from "react";

export default function LangToggle({ initialIsEn }: { initialIsEn: boolean }) {
  const [pending, setPending] = useState(false);

  function toggle() {
    const next = !initialIsEn;
    document.cookie = `lang=${next ? "en" : "ar"}; path=/; max-age=2592000`;
    setPending(true);
    location.reload();
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={initialIsEn ? "Switch to Arabic" : "Switch to English"}
      style={{
        background: "rgba(255,255,255,0.15)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: pending ? "wait" : "pointer",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {initialIsEn ? "عربي" : "EN"}
    </button>
  );
}
