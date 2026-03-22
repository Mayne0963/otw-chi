'use client';
import { UserButton } from "@neondatabase/auth/react";
import OtwButton from "@/components/ui/otw/OtwButton"
import { BackNavButton } from "@/components/layout/BackNavButton";
import OtwBrandLink from "@/components/branding/OtwBrandLink";

export function DashboardHeader() {
  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:h-20 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <OtwBrandLink
          className="md:hidden"
          imageClassName="h-10 w-10 rounded-lg"
          showWordmark={false}
        />
        <BackNavButton fallbackHref="/dashboard" className="h-8 px-2 sm:h-9 sm:px-3" />
        <OtwButton as="a" href="/" variant="ghost" size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
          Home
        </OtwButton>
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
