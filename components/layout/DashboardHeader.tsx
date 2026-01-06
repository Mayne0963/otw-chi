import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function DashboardHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger could go here */}
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <Button asChild variant="secondary" className="hidden sm:inline-flex shadow-md">
          <Link href="/order">
            Place Order
          </Link>
        </Button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
