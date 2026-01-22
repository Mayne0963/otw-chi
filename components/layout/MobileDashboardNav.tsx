"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  Package, 
  Wallet, 
  Truck, 
  Menu as MenuIcon 
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { useState } from "react"

interface MobileDashboardNavProps {
  role: string
}

export function MobileDashboardNav({ role }: MobileDashboardNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const commonTabs = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Requests", href: "/requests", icon: Package },
    { label: "Wallet", href: "/wallet/nip", icon: Wallet },
  ]

  let tabs = [...commonTabs]

  // Add Driver tab if role is DRIVER or ADMIN
  if (role === 'DRIVER' || role === 'ADMIN') {
    tabs.push({ label: "Driver", href: "/driver/dashboard", icon: Truck })
  }

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-otwBlack pb-[env(safe-area-inset-bottom)] md:hidden">
      <nav className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:text-otwOffWhite",
                isActive ? "text-otwGold" : "text-otwOffWhite/60"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:text-otwOffWhite text-otwOffWhite/60"
              )}
            >
              <MenuIcon className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r border-white/10 bg-otwBlack w-[280px]">
            <DashboardSidebar role={role} onLinkClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  )
}
