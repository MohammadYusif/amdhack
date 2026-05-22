export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000"

export const COLORS = {
  dark:   "#02141E",
  navy:   "#033957",
  copper: "#CD907E",
  green:  "#1B6B4A",
  amber:  "#D4900A",
  red:    "#C0392B",
} as const

export const TIER_CONFIG = {
  GREEN:    { label_ar: "أخضر",   label_en: "Green",    color: COLORS.green, bg: "#E8F5EE" },
  YELLOW:   { label_ar: "أصفر",   label_en: "Yellow",   color: COLORS.amber, bg: "#FDF3DC" },
  BUILDING: { label_ar: "تطوير",  label_en: "Building", color: COLORS.red,   bg: "#FDECEA" },
} as const
