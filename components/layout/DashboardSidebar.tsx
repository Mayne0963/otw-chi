"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Package, 
  Wallet, 
  CreditCard, 
  LifeBuoy, 
  Settings,
  Truck,
  ShieldAlert,
  MapPin,
  DollarSign,
  Building2,
  Mail
} from "lucide-react"

interface DashboardSidebarProps {
  role: string
  onLinkClick?: () => void
}

export function DashboardSidebar({ role, onLinkClick }: DashboardSidebarProps) {
  const pathname = usePathname()

  const commonRoutes = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Requests", href: "/requests", icon: Package },
    { label: "Wallet", href: "/wallet/nip", icon: Wallet },
    { label: "Membership", href: "/membership/manage", icon: CreditCard },
    { label: "Service Miles", href: "/service-miles", icon: CreditCard },
    { label: "Design Lab", href: "/design-lab", icon: LayoutDashboard },
    { label: "Support", href: "/support", icon: LifeBuoy },
    { label: "Settings", href: "/settings", icon: Settings },
  ]

  const driverRoutes = [
    { label: "Driver Dashboard", href: "/driver/dashboard", icon: Truck },
    { label: "Driver Map", href: "/driver", icon: MapPin }, // Driver-only map entry
    { label: "Jobs", href: "/driver/jobs", icon: MapPin },
    { label: "Earnings", href: "/driver/earnings", icon: DollarSign },
    { label: "Profile", href: "/driver/profile", icon: Settings },
    { label: "Founder Log", href: "/driver/founder-log", icon: Settings },
  ]

  const adminRoutes = [
    { label: "Admin Overview", href: "/admin", icon: ShieldAlert },
    { label: "OTW-OS", href: "/admin/otw-os", icon: Settings },
    { label: "Requests", href: "/admin/requests", icon: Package },
    { label: "Drivers", href: "/admin/drivers", icon: Truck },
    { label: "Customers", href: "/admin/customers", icon: LayoutDashboard },
    { label: "Ledger", href: "/admin/nip-ledger", icon: Wallet },
    { label: "Franchise Apps", href: "/admin/franchise/applications", icon: Building2 },
    { label: "Contact Inbox", href: "/admin/contact", icon: Mail },
    { label: "Seed Database", href: "/admin/seed", icon: Settings },
  ]

  let routes = commonRoutes
  if (role === 'DRIVER') {
    routes = [...commonRoutes, ...driverRoutes]
  } else if (role === 'ADMIN') {
    // Admin gets access to ALL features: customer, driver, and admin
    routes = [...commonRoutes, ...driverRoutes, ...adminRoutes]
  }

  return (
    <div className="relative z-40 flex h-full w-64 flex-col border-r border-white/10 bg-otwBlack">
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-otwGold">
          OTW <span className="text-xs text-white/50 font-normal">App</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {routes.map((route) => {
          const isActive = pathname === route.href
          return (
            <Link
              key={route.href}
              href={route.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-otwGold/10 text-otwGold"
                  : "text-otwOffWhite/70 hover:bg-white/5 hover:text-otwOffWhite"
              )}
            >
              <route.icon className="h-4 w-4" />
              {route.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-xs font-medium text-otwOffWhite">Need help?</p>
          <p className="text-xs text-white/50 mt-1">Contact support anytime.</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full border-white/10 text-xs h-8">
            <Link href="/support">Support</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
