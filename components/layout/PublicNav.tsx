'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function PublicNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn, user } = useUser();
  const pathname = usePathname();

  const navItems = [
    { label: 'How it Works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Services', href: '/services' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-otw-bg/80 backdrop-blur-md border-b border-otw-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Logo />
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-otw-primary",
                  pathname === item.href ? "text-otw-primary" : "text-otw-text"
                )}
              >
                {item.label}
              </Link>
            ))}
            
            <div className="flex items-center gap-4 ml-4">
              {isSignedIn ? (
                <div className="flex items-center gap-4">
                  <Button variant="secondary" asChild size="sm">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <UserButton afterSignOutUrl="/" />
                </div>
              ) : (
                <>
                  <Link href="/sign-in" className="text-sm font-medium text-otw-text hover:text-otw-primary">
                    Sign In
                  </Link>
                  <Button variant="default" size="sm" asChild>
                    <Link href="/sign-up">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-otw-text hover:text-otw-primary p-2"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-otw-panel border-b border-otw-border">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-otw-text hover:text-otw-primary hover:bg-otw-bg"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-otw-border mt-4 flex flex-col gap-3">
              {isSignedIn ? (
                <Button variant="secondary" asChild className="w-full justify-center">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild className="w-full justify-start">
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button variant="default" asChild className="w-full justify-center">
                    <Link href="/sign-up">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
