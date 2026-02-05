import Link from "next/link"
import OtwButton from "@/components/ui/otw/OtwButton"
import { UserButton } from "@neondatabase/auth/react"
import { SignedIn, SignedOut } from "@/components/auth/auth-helpers"
import { Menu } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
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
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <span>OTW</span>
            <span className="hidden sm:inline-block text-foreground/70 text-sm font-normal">On The Way</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
             <ModeToggle />
          </div>

          <SignedIn>
            <OtwButton as="a" href="/dashboard" variant="ghost" size="sm" className="hidden sm:flex">
              Dashboard
            </OtwButton>
            <OtwButton as="a" href="/order" size="sm" className="hidden sm:flex">
              Order Now
            </OtwButton>
            <UserButton />
          </SignedIn>
          
          <SignedOut>
            <OtwButton as="a" href="/sign-in" variant="ghost" size="sm" className="hidden md:flex">
              Sign In
            </OtwButton>
            <OtwButton as="a" href="/order" variant="outline" size="sm" className="hidden md:flex">
              Order Now
            </OtwButton>
            <OtwButton as="a" href="/sign-up" size="sm">
              Get Started
            </OtwButton>
          </SignedOut>

          {/* Mobile Menu */}
          <div className="md:hidden ml-2">
            <Sheet>
              <SheetTrigger asChild>
                <OtwButton variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </OtwButton>
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
                      <OtwButton as="a" href="/order" className="w-full">
                        Order Now
                      </OtwButton>
                    </SheetClose>
                    
                    <SignedOut>
                      <SheetClose asChild>
                        <OtwButton as="a" href="/sign-in" variant="outline" className="w-full">
                          Sign In
                        </OtwButton>
                      </SheetClose>
                    </SignedOut>
                    
                    <SignedIn>
                      <SheetClose asChild>
                        <OtwButton as="a" href="/dashboard" variant="outline" className="w-full">
                          Dashboard
                        </OtwButton>
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
