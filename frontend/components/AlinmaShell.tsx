"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LangToggle from "@/components/LangToggle";

/* ── Alinma Logo mark ─────────────────────────────────────────── */
export function AlinmaLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="alinma bank">
      <rect x="4"  y="4"  width="14" height="14" rx="3" fill="white" opacity="0.9"/>
      <rect x="22" y="4"  width="14" height="14" rx="3" fill="white" opacity="0.6"/>
      <rect x="4"  y="22" width="14" height="14" rx="3" fill="white" opacity="0.6"/>
      <rect x="22" y="22" width="14" height="14" rx="3" fill="white" opacity="0.9"/>
    </svg>
  );
}

/* ── Top header — home screen style ──────────────────────────── */
export function HomeHeader({ nameAr = "محمد الغامدي", isEn = false }: { nameAr?: string; isEn?: boolean }) {
  return (
    <div className="alinma-header">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <AlinmaLogo size={32} />
          <div>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>
              {isEn ? "Welcome" : "مرحباً بك"}
            </p>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{nameAr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle initialIsEn={isEn} />
          <button aria-label={isEn ? "Notifications" : "الإشعارات"} style={{ color: "rgba(255,255,255,0.8)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <button aria-label={isEn ? "Menu" : "القائمة"} style={{ color: "rgba(255,255,255,0.8)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Balance card */}
      <div style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: "14px 16px",
        backdropFilter: "blur(8px)",
      }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>
          {isEn ? "Total Balance" : "الرصيد الإجمالي"}
        </p>
        <div className="flex items-center justify-between">
          <p style={{ color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}
            className="ltr">
            ••••••
          </p>
          <span style={{
            background: "rgba(255,255,255,0.2)",
            color: "#fff",
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 99,
          }}>
            {isEn ? "Show" : "إظهار"}
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>
          {isEn ? "Current Account" : "الحساب الجاري"}
        </p>
      </div>
    </div>
  );
}

/* ── Flat back-arrow header (inner screens) ──────────────────── */
export function InnerHeader({
  title,
  backHref,
  subtitle,
  isEn = false,
}: {
  title: string;
  backHref: string;
  subtitle?: string;
  isEn?: boolean;
}) {
  // Right-pointing (>) for RTL Arabic back; left-pointing (<) for LTR English back
  const backPath = isEn ? "M15 18l-6-6 6-6" : "M15 18l6-6-6-6";

  return (
    <div className="alinma-header-flat">
      <Link href={backHref} aria-label={isEn ? "Back" : "رجوع"}
        style={{ color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d={backPath} stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>
      <div className="flex-1 text-center">
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{title}</p>
        {subtitle && (
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{subtitle}</p>
        )}
      </div>
      <LangToggle initialIsEn={isEn} />
    </div>
  );
}

/* ── Bottom navigation bar ───────────────────────────────────── */
const NAV_ITEMS = [
  {
    id: "home", label: "الرئيسية", labelEn: "Home", href: "/",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "cards", label: "بطاقاتي", labelEn: "My Cards", href: "#",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3"
          stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}/>
        <path d="M2 10h20" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}/>
      </svg>
    ),
  },
  {
    id: "transfer", label: "تحويل", labelEn: "Transfer", href: "#",
    icon: (_active: boolean) => (
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: -18, boxShadow: "0 4px 12px rgba(105,104,180,0.40)",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3"
            stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    ),
  },
  {
    id: "finance", label: "التمويل", labelEn: "Finance", href: "/mihan",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
          stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "more", label: "المزيد", labelEn: "More", href: "#",
    icon: (_active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
];

export function BottomNav({ activeId, isEn = false }: { activeId?: string; isEn?: boolean }) {
  return (
    <nav className="bottom-nav" aria-label={isEn ? "Main Navigation" : "القائمة الرئيسية"}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === (activeId ?? "home");
        return (
          <Link key={item.id} href={item.href}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}>
            {item.icon(isActive)}
            <span>{isEn ? item.labelEn : item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
