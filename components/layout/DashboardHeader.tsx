'use client';
import { UserButton } from "@neondatabase/neon-js/auth/react";
import OtwButton from "@/components/ui/otw/OtwButton"

export function DashboardHeader() {
  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <OtwButton as="a" href="/order" variant="gold" className="hidden sm:inline-flex shadow-md">
          Place Order
        </OtwButton>
        <UserButton />
      </div>
    </header>
  )
}
