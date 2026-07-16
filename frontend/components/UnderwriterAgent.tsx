"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { UnderwriterRecommendation, AgentAnswer } from "@/lib/types";

const panel = {
  background: "var(--surface)",
  borderRadius: 20,
  boxShadow: "var(--shadow-sm)",
  padding: 20,
};

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  APPROVE_ROUTE_TO_OFFICER: { bg: "var(--tier-green-bg)", fg: "var(--tier-green-text)" },
  APPROVE_WITH_CONDITIONS:  { bg: "var(--tier-yellow-bg)", fg: "var(--tier-yellow-text)" },
  DECLINE_ISSUE_ROADMAP:    { bg: "var(--tier-red-bg)", fg: "var(--tier-red-text)" },
};

const SUGGESTIONS_EN = [
  "What's the affordability / DBR position?",
  "Biggest risk over the next 6 months?",
  "Is this decision bias-checked and fair?",
  "What conditions would you attach?",
];
const SUGGESTIONS_AR = [
  "ما وضع القدرة على السداد / نسبة الدين؟",
  "أكبر خطر خلال الأشهر الستة القادمة؟",
  "هل القرار خاضع لفحص التحيّز وعادل؟",
  "ما الشروط التي تقترحها؟",
];

type Turn = { q: string; a: AgentAnswer | null };

export default function UnderwriterAgent({
  profileId,
  recommendation,
  isEn,
}: {
  profileId: string;
  recommendation: UnderwriterRecommendation;
  isEn: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const rec = recommendation;
  const actionStyle = ACTION_STYLE[rec.action] ?? ACTION_STYLE.APPROVE_WITH_CONDITIONS;
  const suggestions = isEn ? SUGGESTIONS_EN : SUGGESTIONS_AR;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setTurns((t) => [...t, { q, a: null }]);
    try {
      const a = await api.askAgent(profileId, q);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a } : turn)));
    } catch {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { ...turn, a: { answer_en: isEn ? "Agent unavailable." : "الوكيل غير متاح.", grounding: [], source: "template" } }
            : turn
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
          borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: "var(--surface-2)", color: "var(--accent)",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2a2 2 0 012 2v1h3a2 2 0 012 2v3a2 2 0 010 4v3a2 2 0 01-2 2h-3v1a2 2 0 01-4 0v-1H7a2 2 0 01-2-2v-3a2 2 0 010-4V7a2 2 0 012-2h3V4a2 2 0 012-2z"
              stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9" cy="11" r="1" fill="currentColor" />
            <circle cx="15" cy="11" r="1" fill="currentColor" />
          </svg>
          {isEn ? "Agent" : "وكيل"}
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
          {isEn ? "Underwriter Recommendation" : "توصية مسؤول الاكتتاب"}
        </p>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
        {isEn
          ? "Auto-drafted on assessment · grounded in zero-PII aggregates"
          : "مسودة تلقائية عند التقييم · مبنية على مجاميع بلا بيانات شخصية"}
      </p>

      {/* Recommendation */}
      <div style={{ background: actionStyle.bg, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: actionStyle.fg }}>
            {isEn ? rec.headline_en : rec.headline_ar}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 700, color: actionStyle.fg,
            border: `1px solid ${actionStyle.fg}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap",
          }}>
            {isEn ? `Confidence: ${rec.confidence}` : `الثقة: ${rec.confidence === "HIGH" ? "عالية" : "متوسطة"}`}
          </span>
        </div>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {(isEn ? rec.rationale_en : rec.rationale_ar).map((b, i) => (
            <li key={i} style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{b}</li>
          ))}
        </ul>
        {rec.conditions.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: actionStyle.fg, marginBottom: 4 }}>
              {isEn ? "Suggested conditions" : "الشروط المقترحة"}
            </p>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {rec.conditions.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{isEn ? c.en : c.ar}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Chat transcript */}
      {turns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {turns.map((t, i) => (
            <div key={i}>
              <p style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-1)",
                background: "var(--surface-2)", borderRadius: 10, padding: "8px 10px",
              }}>
                {t.q}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, padding: "6px 10px" }}>
                {t.a ? t.a.answer_en : (isEn ? "…" : "…")}
                {t.a && (
                  <span style={{ fontSize: 9, color: "var(--text-3)", marginInlineStart: 6 }}>
                    [{t.a.source}]
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={busy}
            style={{
              fontSize: 11, color: "var(--accent)", background: "var(--surface-2)",
              border: "none", borderRadius: 999, padding: "5px 10px",
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isEn ? "Ask the agent…" : "اسأل الوكيل…"}
          dir={isEn ? "ltr" : "rtl"}
          style={{
            flex: 1, border: "1.5px solid var(--border)", borderRadius: 10,
            padding: "9px 12px", fontSize: 13, color: "var(--text-1)",
            background: "var(--surface-2)", outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: "9px 14px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: busy || !input.trim() ? "default" : "pointer",
            opacity: busy || !input.trim() ? 0.6 : 1,
          }}
        >
          {isEn ? "Ask" : "إرسال"}
        </button>
      </form>
      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8, lineHeight: 1.5 }}>
        {isEn ? rec.disclaimer_en : rec.disclaimer_ar}
      </p>
    </div>
  );
}
