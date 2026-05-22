interface TierBadgeProps {
  tier: "GREEN" | "YELLOW" | "BUILDING";
  size?: "sm" | "md" | "lg";
  isEn?: boolean;
}

const TIER_CONFIG = {
  GREEN: {
    label: "المستوى الأخضر",
    labelEn: "Green Tier",
    bg: "var(--tier-green-bg)",
    color: "var(--tier-green-text)",
  },
  YELLOW: {
    label: "المستوى الأصفر",
    labelEn: "Yellow Tier",
    bg: "var(--tier-yellow-bg)",
    color: "var(--tier-yellow-text)",
  },
  BUILDING: {
    label: "مستوى البناء",
    labelEn: "Building Tier",
    bg: "var(--tier-red-bg)",
    color: "var(--tier-red-text)",
  },
};

const SIZE_PX = {
  sm: { fontSize: 10, padding: "2px 8px" },
  md: { fontSize: 12, padding: "4px 10px" },
  lg: { fontSize: 13, padding: "5px 14px" },
};

export default function TierBadge({ tier, size = "md", isEn = false }: TierBadgeProps) {
  const cfg = TIER_CONFIG[tier];
  const sz = SIZE_PX[size];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        borderRadius: 99, fontWeight: 700,
        background: cfg.bg, color: cfg.color,
        ...sz,
      }}
      aria-label={cfg.labelEn}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {isEn ? cfg.labelEn : cfg.label}
    </span>
  );
}
