'use client';
import { UserButton } from "@neondatabase/auth/react";
import OtwButton from "@/components/ui/otw/OtwButton"
import Link from "next/link";
import { BackNavButton } from "@/components/layout/BackNavButton";
import OtwNavbarLogo from "@/components/branding/OtwNavbarLogo";

export function DashboardHeader() {
  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:h-20 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <BackNavButton fallbackHref="/dashboard" className="h-8 px-2 sm:h-9 sm:px-3" />
        <Link href="/" className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5">
          <OtwNavbarLogo imageClassName="h-14 w-14 sm:h-16 sm:w-16" />
          <span className="hidden text-xs font-medium text-foreground/70 sm:inline">Home</span>
        </Link>
        <h2 className="hidden text-base font-semibold text-foreground sm:inline sm:text-lg">Dashboard</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <OtwButton
          as="a"
          href="/order"
          variant="gold"
          size="sm"
          className="h-8 px-3 text-xs shadow-md sm:h-auto sm:px-4 sm:text-sm"
        >
          <span className="sm:hidden">Order</span>
          <span className="hidden sm:inline">Place Order</span>
        </OtwButton>
        <UserButton size="icon" />
      </div>
    </header>
  )
}
