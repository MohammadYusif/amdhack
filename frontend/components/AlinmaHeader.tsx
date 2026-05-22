export function AlinmaHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="alinma-header px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg tracking-wide">ALINMA BANK</div>
          <div className="text-xs" style={{ color: "#CD907E" }}>الإنماء</div>
        </div>
        {subtitle && (
          <div className="text-xs text-center" style={{ color: "#CD907E" }}>
            {subtitle}
          </div>
        )}
        <div className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: "#033957" }}>
          <span className="text-white font-bold text-sm">م</span>
        </div>
      </div>
    </header>
  )
}
