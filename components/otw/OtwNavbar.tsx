import React from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

const OtwNavbar: React.FC = () => {
  return (
    <header className="bg-otwRed shadow-otwSoft rounded-b-2xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2 hover:opacity-90 transition">
          <span className="text-otwGold text-2xl font-bold font-mono tracking-tighter">OTW</span>
          <span className="text-otwGold/80 text-xs hidden sm:inline-block font-medium">On The Way</span>
        </Link>
        
        <nav className="flex items-center gap-6 text-sm font-medium text-otwOffWhite">
          <div className="hidden md:flex gap-6">
            <Link href="/how-it-works" className="hover:text-otwGold transition">How It Works</Link>
            <Link href="/pricing" className="hover:text-otwGold transition">Pricing</Link>
            <Link href="/driver/apply" className="hover:text-otwGold transition">Drive</Link>
          </div>

          <SignedIn>
            <Link href="/dashboard" className="hover:text-otwGold transition">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          
          <SignedOut>
             <div className="flex gap-3">
              <SignInButton mode="modal">
                <button className="hover:text-otwGold transition">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-otwGold text-otwBlack px-4 py-2 rounded-xl font-bold hover:bg-white transition shadow-lg shadow-otwGold/20">
                  Get Started
                </button>
              </SignUpButton>
             </div>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
};

export default OtwNavbar;
