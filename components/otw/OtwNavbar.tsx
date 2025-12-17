import React from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import OtwButton from '@/components/ui/otw/OtwButton';

const OtwNavbar: React.FC = () => {
  return (
    <header className="bg-otwRed shadow-otwSoft rounded-b-2xl">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-otwGold text-2xl font-semibold">OTW</span>
          <span className="text-otwGold/90 text-sm">On The Way</span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Home</Link>
          <SignedIn>
            <Link href="/dashboard" className="hover:underline">Dashboard</Link>
            <Link href="/driver/jobs" className="hover:underline">Driver Jobs</Link>
            <Link href="/membership/manage" className="hover:underline">Membership</Link>
            <Link href="/wallet/nip" className="hover:underline">NIP Wallet</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
             <div className="flex gap-2">
              <SignInButton mode="modal">
                <button className="text-white hover:underline">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-otwGold text-otwBlack px-3 py-1 rounded-lg font-semibold hover:brightness-110">Sign Up</button>
              </SignUpButton>
             </div>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
};

export default OtwNavbar;
