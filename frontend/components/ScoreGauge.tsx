"use client";

interface ScoreGaugeProps {
  score: number;
  tier: "GREEN" | "YELLOW" | "BUILDING";
}

const TIER_COLOR = {
  GREEN:    "var(--tier-green-text)",  /* semantic green, not brand navy */
  YELLOW:   "#C8961A",
  BUILDING: "var(--text-3)",
};

const TIER_LABEL = {
  GREEN:    "المستوى الأخضر",
  YELLOW:   "المستوى الأصفر",
  BUILDING: "مستوى البناء",
};

export default function ScoreGauge({ score, tier }: ScoreGaugeProps) {
  const radius = 54;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const arcLength = circumference * 0.75;
  const filled = arcLength * (score / 100);
  const color = TIER_COLOR[tier];

  return (
    <div
      role="img"
      aria-label={`نتيجة مِهَن: ${score} من 100 — ${TIER_LABEL[tier]}`}
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 140, height: 140 }}
    >
      <svg width={140} height={140} viewBox="0 0 120 120">
        {/* Track */}
        <circle
          cx={60} cy={60} r={normalizedRadius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
        />
        {/* Fill */}
        <circle
          cx={60} cy={60} r={normalizedRadius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }} dir="ltr">
        <span style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>/100</span>
      </div>
    </div>
  );
}
