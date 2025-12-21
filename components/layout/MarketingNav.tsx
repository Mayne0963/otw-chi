import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-otwBlack/80 backdrop-blur supports-[backdrop-filter]:bg-otwBlack/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-otwGold">
            <span>OTW</span>
            <span className="hidden sm:inline-block text-white text-sm font-normal opacity-80">On The Way</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-otwOffWhite/80">
          <Link href="/how-it-works" className="hover:text-otwGold transition-colors">How It Works</Link>
          <Link href="/pricing" className="hover:text-otwGold transition-colors">Pricing</Link>
          <Link href="/driver/apply" className="hover:text-otwGold transition-colors">Drive</Link>
          <Link href="/franchise/apply" className="hover:text-otwGold transition-colors">Franchise</Link>
        </nav>

        <div className="flex items-center gap-4">
          <SignedIn>
            <Button asChild variant="outline" size="sm" className="hidden sm:flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-otwGold text-otwBlack hover:bg-otwGold/90">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>
        </div>
      </div>
    </header>
  )
}
