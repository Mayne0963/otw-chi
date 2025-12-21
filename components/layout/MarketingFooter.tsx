import Link from "next/link"

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-otwBlack py-12 text-otwOffWhite/60">
      <div className="container grid grid-cols-1 gap-8 md:grid-cols-4">
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-otwGold">OTW</h4>
          <p className="text-sm">Luxury delivery concierge for the block, the business, and the busy.</p>
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-otwOffWhite">Service</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/how-it-works" className="hover:text-otwGold">How It Works</Link></li>
            <li><Link href="/pricing" className="hover:text-otwGold">Pricing</Link></li>
            <li><Link href="/cities" className="hover:text-otwGold">Cities</Link></li>
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-otwOffWhite">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-otwGold">About</Link></li>
            <li><Link href="/driver/apply" className="hover:text-otwGold">Drive with Us</Link></li>
            <li><Link href="/franchise/apply" className="hover:text-otwGold">Franchise</Link></li>
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-otwOffWhite">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/terms" className="hover:text-otwGold">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-otwGold">Privacy</Link></li>
            <li><Link href="/contact" className="hover:text-otwGold">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="container mt-12 border-t border-white/10 pt-8 text-center text-xs">
        © {new Date().getFullYear()} On The Way. All rights reserved.
      </div>
    </footer>
  )
}
