import React from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const OtwNavbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="otw-container flex items-center justify-between py-4">
        <Link href="/" className="flex items-baseline gap-2 transition-opacity duration-300 hover:opacity-90">
          <span className="text-secondary text-2xl font-semibold tracking-tight">OTW</span>
          <span className="text-muted-foreground text-xs hidden sm:inline-block">On The Way</span>
        </Link>
        
        <nav className="flex items-center gap-4 text-sm font-medium text-foreground">
          <div className="hidden md:flex items-center gap-6">
            <Link href="/how-it-works" className="transition-colors duration-300 hover:text-secondary">How It Works</Link>
            <Link href="/pricing" className="transition-colors duration-300 hover:text-secondary">Pricing</Link>
            <Link href="/driver/apply" className="transition-colors duration-300 hover:text-secondary">Drive</Link>
            <Button asChild size="sm">
              <Link href="/order">Order Now</Link>
            </Button>
          </div>

          <SignedIn>
            <Link href="/dashboard" className="transition-colors duration-300 hover:text-secondary">Dashboard</Link>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/order">Order Now</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          
          <SignedOut>
             <div className="flex items-center gap-3">
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/order">Order Now</Link>
              </Button>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">Sign In</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Get Started</Button>
              </SignUpButton>
             </div>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
};

export default OtwNavbar;
