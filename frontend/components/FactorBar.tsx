interface FactorBarProps {
  labelAr: string;
  labelEn: string;
  score: number;
  highlight?: "low" | "normal";
  isEn?: boolean;
}

function getBarColor(score: number, highlight?: string): string {
  if (highlight === "low" || score < 40) return "var(--tier-red-text)";
  if (score < 60) return "#C8961A";
  return "var(--green)";
}

export default function FactorBar({ labelAr, labelEn, score, highlight, isEn = false }: FactorBarProps) {
  const color = getBarColor(score, highlight);
  const label = isEn ? labelEn : labelAr;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }} dir="ltr">
          {score}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>/100</span>
        </span>
      </div>
      <div
        className="factor-bar-track"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${labelEn}: ${score} out of 100`}
      >
        <div
          className="factor-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
