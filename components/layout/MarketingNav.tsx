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
        className="text-sm font-medium text-muted-foreground hover:text-secondary transition-colors duration-300"
      >
        Memberships
      </Link>
      <Link 
        href="/driver/apply" 
        className="text-sm font-medium text-muted-foreground hover:text-secondary transition-colors duration-300"
      >
        Apply Today
      </Link>
      <Link 
        href="/franchise/apply" 
        className="text-sm font-medium text-muted-foreground hover:text-secondary transition-colors duration-300"
      >
        Franchise
      </Link>
      <Link 
        href="/request" 
        className="text-sm font-medium text-muted-foreground hover:text-secondary transition-colors duration-300"
      >
        Request a Service
      </Link>
    </>
  )
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="otw-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-secondary">
            <span>OTW</span>
            <span className="hidden sm:inline-block text-foreground/70 text-sm font-normal">On The Way</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-3">
          <SignedIn>
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:flex">
              <Link href="/order">Order Now</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className="hidden md:flex">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden md:flex">
              <Link href="/order">Order Now</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </SignedOut>

          {/* Mobile Menu */}
          <div className="md:hidden ml-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l border-border/70 bg-card/95 backdrop-blur-xl text-foreground sm:w-[350px]">
                <SheetHeader className="text-left border-b border-border/70 pb-4 mb-4">
                  <SheetTitle className="text-secondary">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6">
                  <nav className="flex flex-col gap-4">
                    <SheetClose asChild>
                      <Link href="/how-it-works" className="text-lg font-medium hover:text-secondary transition-colors duration-300">
                        How It Works
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/pricing" className="text-lg font-medium hover:text-secondary transition-colors duration-300">
                        Pricing
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/driver/apply" className="text-lg font-medium hover:text-secondary transition-colors duration-300">
                        Drive
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/franchise/apply" className="text-lg font-medium hover:text-secondary transition-colors duration-300">
                        Franchise
                      </Link>
                    </SheetClose>
                  </nav>
                  
                  <div className="flex flex-col gap-3 pt-4 border-t border-border/70">
                    <SheetClose asChild>
                      <Button asChild className="w-full">
                        <Link href="/order">Order Now</Link>
                      </Button>
                    </SheetClose>
                    
                    <SignedOut>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full">
                          <Link href="/sign-in">Sign In</Link>
                        </Button>
                      </SheetClose>
                    </SignedOut>
                    
                    <SignedIn>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full">
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
