'use client';
import { UserButton } from "@neondatabase/auth/react";
import OtwButton from "@/components/ui/otw/OtwButton"

export function DashboardHeader() {
  return (
    <header className="relative z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:h-16 sm:px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Dashboard</h2>
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
