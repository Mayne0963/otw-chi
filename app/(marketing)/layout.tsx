import { MarketingNav } from "@/components/layout/MarketingNav"
import { MarketingFooter } from "@/components/layout/MarketingFooter"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-otwBlack text-otwOffWhite">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
