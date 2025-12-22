import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"

function NavLinks() {
  return (
    <>
      <Link 
        href="/pricing" 
        className="text-sm font-medium text-otwOffWhite/80 hover:text-otwGold transition-colors"
      >
        Memberships
      </Link>
      <Link 
        href="/driver/apply" 
        className="text-sm font-medium text-otwOffWhite/80 hover:text-otwGold transition-colors"
      >
        Apply Today
      </Link>
      <Link 
        href="/franchise/apply" 
        className="text-sm font-medium text-otwOffWhite/80 hover:text-otwGold transition-colors"
      >
        Franchise
      </Link>
      <Link 
        href="/request" 
        className="text-sm font-medium text-otwOffWhite/80 hover:text-otwGold transition-colors"
      >
        Request a Service
      </Link>
    </>
  )
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-otwBlack/80 backdrop-blur supports-[backdrop-filter]:bg-otwBlack/60">
      <div className="otw-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-otwGold">
            <span>OTW</span>
            <span className="hidden sm:inline-block text-white text-sm font-normal opacity-80">On The Way</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-3">
          <SignedIn>
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex hover:text-otwGold hover:bg-otwGold/10">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:flex bg-otwGold text-otwBlack hover:bg-otwGold/90 shadow-otwGlow">
              <Link href="/order">Place Order</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className="hidden md:flex text-otwOffWhite hover:text-otwGold hover:bg-white/5">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden md:flex border-otwGold text-otwGold hover:bg-otwGold/10">
              <Link href="/order">Place Order</Link>
            </Button>
            <Button asChild size="sm" className="bg-otwGold text-otwBlack hover:bg-otwGold/90 shadow-otwGlow">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>

          {/* Mobile Menu */}
          <div className="md:hidden ml-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-otwOffWhite hover:bg-white/10">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l border-white/10 bg-otwBlack/95 backdrop-blur-xl text-otwOffWhite sm:w-[350px]">
                <SheetHeader className="text-left border-b border-white/10 pb-4 mb-4">
                  <SheetTitle className="text-otwGold">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6">
                  <nav className="flex flex-col gap-4">
                    <SheetClose asChild>
                      <Link href="/how-it-works" className="text-lg font-medium hover:text-otwGold transition-colors">
                        How It Works
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/pricing" className="text-lg font-medium hover:text-otwGold transition-colors">
                        Pricing
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/driver/apply" className="text-lg font-medium hover:text-otwGold transition-colors">
                        Drive
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/franchise/apply" className="text-lg font-medium hover:text-otwGold transition-colors">
                        Franchise
                      </Link>
                    </SheetClose>
                  </nav>
                  
                  <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                    <SheetClose asChild>
                      <Button asChild className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90">
                        <Link href="/order">Place Order</Link>
                      </Button>
                    </SheetClose>
                    
                    <SignedOut>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full border-white/20 hover:bg-white/5 hover:text-otwGold">
                          <Link href="/sign-in">Sign In</Link>
                        </Button>
                      </SheetClose>
                    </SignedOut>
                    
                    <SignedIn>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full border-white/20 hover:bg-white/5 hover:text-otwGold">
                          <Link href="/dashboard">Dashboard</Link>
                        </Button>
                      </SheetClose>
                    </SignedIn>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
