"use client";

import { useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Menu, ChevronLeft } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: React.ReactNode;
  nav: React.ReactNode;
  title?: string;
}

export function AppShell({ children, nav, title = "Dashboard" }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-otw-bg flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-otw-panel border-r border-otw-border transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-20",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-otw-border">
          <div className={cn("overflow-hidden transition-all", sidebarOpen ? "w-auto" : "w-0 opacity-0")}>
            <Logo size="md" />
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex p-1.5 rounded-lg text-otw-textMuted hover:bg-otw-panelHover hover:text-otw-text"
          >
            <ChevronLeft className={cn("w-5 h-5 transition-transform", !sidebarOpen && "rotate-180")} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {nav}
        </div>

        <div className="p-4 border-t border-otw-border">
          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
            <UserButton afterSignOutUrl="/" showName={sidebarOpen} appearance={{
              elements: {
                userButtonBox: "flex-row-reverse",
                userButtonOuterIdentifier: "text-otw-text font-medium"
              }
            }}/>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col min-h-screen transition-all duration-300", sidebarOpen ? "md:ml-64" : "md:ml-20")}>
        {/* Top Header (Mobile Only / Breadcrumbs) */}
        <header className="sticky top-0 z-30 bg-otw-bg/80 backdrop-blur-md border-b border-otw-border h-16 px-4 flex items-center justify-between md:hidden">
          <Logo size="sm" />
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-otw-text hover:bg-otw-panel rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Overlay for mobile sidebar */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
