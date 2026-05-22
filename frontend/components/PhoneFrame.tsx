"use client"
import { useState, useEffect } from "react"

function SignalBars({ color }: { color: string }) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill={color}>
      <rect x="0" y="8" width="3" height="4" rx="0.7" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.7" />
      <rect x="9" y="2" width="3" height="10" rx="0.7" />
      <rect x="13.5" y="0" width="3" height="12" rx="0.7" />
    </svg>
  )
}

function WifiIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
      <circle cx="8" cy="10.2" r="1.3" fill={color} />
      <path d="M4.8 6.9C5.8 5.9 6.8 5.4 8 5.4s2.2.5 3.2 1.5"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M1.8 4C3.8 2 5.8 1.1 8 1.1s4.2.9 6.2 2.9"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function BatteryIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
      <rect x="0.6" y="0.6" width="21.8" height="10.8" rx="2.8"
        stroke={color} strokeOpacity="0.85" strokeWidth="1.2" />
      <rect x="2" y="2" width="16.5" height="8" rx="1.8" fill={color} />
      <path d="M23.5 4v4a2 2 0 000-4z" fill={color} fillOpacity="0.45" />
    </svg>
  )
}

export function StatusBar({ dark }: { dark?: boolean }) {
  const [time, setTime] = useState("09:41")

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "Asia/Riyadh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      )
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const fg = dark ? "rgba(255,255,255,0.92)" : "#141414"

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 22px 4px",
      direction: "ltr",
      flexShrink: 0,
      position: "relative",
      zIndex: 10,
    }}>
      <span style={{ color: fg, fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px" }}>
        {time}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: fg, fontSize: 11, fontWeight: 700, letterSpacing: "0.3px" }}>5G</span>
        <SignalBars color={fg} />
        <WifiIcon color={fg} />
        <BatteryIcon color={fg} />
      </div>
    </div>
  )
}

export function PhoneFrame({
  children,
  dark,
}: {
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <div className="phone-outer">
      <div className="phone-body">
        {/* Dynamic Island */}
        <div className="phone-island-bar">
          <div className="phone-island" />
        </div>
        <StatusBar dark={dark} />
        <div className="phone-screen">
          {children}
        </div>
        <div className="phone-home-bar">
          <div className="phone-home-pill" />
        </div>
      </div>
    </div>
  )
}
