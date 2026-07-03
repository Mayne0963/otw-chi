import { MarketingNav } from "@/components/layout/MarketingNav"
import { MarketingFooter } from "@/components/layout/MarketingFooter"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-otwBlack text-otwOffWhite relative overflow-hidden">
      {/* Subtle background treatment for marketing pages */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-radial-gradient from-otwGold/5 to-transparent opacity-50 pointer-events-none" />
      
      <MarketingNav />
      <main className="flex-1 relative z-10">
        <div className="otw-container otw-section">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
