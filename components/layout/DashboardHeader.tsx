import { UserButton } from "@clerk/nextjs"

export function DashboardHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/10 bg-otwBlack px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger could go here */}
        <h2 className="text-lg font-semibold text-otwOffWhite">Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <a
          href="/order"
          className="bg-otwGold text-otwBlack px-4 py-2 rounded-xl font-bold hover:bg-otwGold/90 transition shadow-otwGlow hidden sm:inline-block"
        >
          Place Order
        </a>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
