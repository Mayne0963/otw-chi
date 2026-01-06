import Link from "next/link"

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-background py-12 text-muted-foreground">
      <div className="otw-container grid gap-8 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <h4 className="text-lg font-semibold text-secondary font-display">OTW</h4>
          <p className="text-sm text-muted-foreground">
            Luxury delivery concierge for the block, the business, and the busy.
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">Service</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/how-it-works" className="hover:text-secondary transition-colors duration-300">How It Works</Link></li>
            <li><Link href="/pricing" className="hover:text-secondary transition-colors duration-300">Pricing</Link></li>
            <li><Link href="/cities" className="hover:text-secondary transition-colors duration-300">Cities</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-secondary transition-colors duration-300">About</Link></li>
            <li><Link href="/driver/apply" className="hover:text-secondary transition-colors duration-300">Drive with Us</Link></li>
            <li><Link href="/franchise/apply" className="hover:text-secondary transition-colors duration-300">Franchise</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/terms" className="hover:text-secondary transition-colors duration-300">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-secondary transition-colors duration-300">Privacy</Link></li>
            <li><Link href="/contact" className="hover:text-secondary transition-colors duration-300">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="otw-container mt-10 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} On The Way. All rights reserved.
      </div>
    </footer>
  )
}
