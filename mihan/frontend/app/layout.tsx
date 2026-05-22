import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "مِهَن | Alinma Bank",
  description: "تمويل المستقلين — Freelancer Financing",
  icons: { icon: "/mihan-icon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  )
}
