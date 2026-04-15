"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/auth/SignOutButton"
import { getClientCapabilities } from "@/lib/capabilities"
import OtwBrandLink from "@/components/branding/OtwBrandLink"
import { 
  type LucideIcon,
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
  Mail,
  AlertTriangle,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  HardDrive,
  RefreshCw,
  LogOut
} from "lucide-react"

interface DashboardSidebarProps {
  role: string
  onLinkClick?: () => void
}

type NavRoute = {
  label: string
  href: string
  icon: LucideIcon
}

type NavGroup = {
  id: string
  label: string
  routes: NavRoute[]
  defaultOpen?: boolean
}

const isRouteActive = (pathname: string, href: string) => {
  if (href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardSidebar({ role, onLinkClick }: DashboardSidebarProps) {
  const pathname = usePathname()
  const capabilities = getClientCapabilities({ role })
  const commonRoutes = useMemo<NavRoute[]>(() => {
    const routes: NavRoute[] = [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Requests", href: "/requests", icon: Package },
      { label: "Membership", href: "/membership/manage", icon: CreditCard },
      { label: "Support", href: "/support", icon: LifeBuoy },
      { label: "Settings", href: "/settings", icon: Settings },
    ]

    if (capabilities.canSeeNip) {
      routes.push({ label: "Wallet", href: "/wallet/nip", icon: Wallet })
    }

    return routes
  }, [capabilities.canSeeNip])

  const driverRoutes = useMemo<NavRoute[]>(
    () => [
      { label: "Driver Dashboard", href: "/driver/dashboard", icon: Truck },
      { label: "Earnings", href: "/driver/earnings", icon: DollarSign },
      { label: "Profile", href: "/driver/profile", icon: Settings },
      { label: "Founder Log", href: "/driver/founder-log", icon: Settings },
    ],
    []
  )

  const adminGroups = useMemo<NavGroup[]>(() => {
    if (role !== "ADMIN") return []

    const operationsRoutes: NavRoute[] = [
      { label: "City Requests", href: "/admin/city-requests", icon: MapPin },
      { label: "Contact Inbox", href: "/admin/contact", icon: Mail },
      { label: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
      { label: "Driver Apps", href: "/admin/drivers/applications", icon: Truck },
      { label: "Memberships", href: "/admin/memberships", icon: CreditCard },
      { label: "Payouts", href: "/admin/payouts", icon: DollarSign },
      { label: "Support Desk", href: "/admin/support", icon: LifeBuoy },
    ]

    if (capabilities.canSeeFranchise) {
      operationsRoutes.push({ label: "Franchise Apps", href: "/admin/franchise/applications", icon: Building2 })
    }
    if (capabilities.canSeeAdminZones) {
      operationsRoutes.push({ label: "Cities & Zones", href: "/admin/cities-zones", icon: MapPin })
    }

    const systemRoutes: NavRoute[] = [
      { label: "OTW-OS", href: "/admin/otw-os", icon: Settings },
      { label: "Admin Settings", href: "/admin/settings", icon: Settings },
      { label: "Storage", href: "/admin/system/storage", icon: HardDrive },
      { label: "Migrations", href: "/admin/migrate", icon: RefreshCw },
    ]

    if (capabilities.canSeeNip) {
      systemRoutes.push({ label: "Ledger", href: "/admin/nip-ledger", icon: Wallet })
    }

    return [
      {
        id: "admin-core",
        label: "Admin Core",
        defaultOpen: true,
        routes: [
          { label: "Admin Overview", href: "/admin", icon: ShieldAlert },
          { label: "Requests", href: "/admin/requests", icon: Package },
          { label: "Drivers", href: "/admin/drivers", icon: Truck },
          { label: "Customers", href: "/admin/customers", icon: LayoutDashboard },
        ],
      },
      {
        id: "admin-ops",
        label: "Operations",
        defaultOpen: true,
        routes: operationsRoutes,
      },
      {
        id: "admin-system",
        label: "System",
        defaultOpen: false,
        routes: systemRoutes,
      },
      {
        id: "admin-driver-tools",
        label: "Driver Tools",
        defaultOpen: false,
        routes: driverRoutes,
      },
    ]
  }, [
    capabilities.canSeeAdminZones,
    capabilities.canSeeFranchise,
    capabilities.canSeeNip,
    driverRoutes,
    role,
  ])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {}
    for (const group of adminGroups) {
      defaults[group.id] = group.defaultOpen !== false
    }
    return defaults
  })

  const renderRoute = (route: NavRoute, options?: { nested?: boolean }) => {
    const isActive = isRouteActive(pathname, route.href)
    return (
      <Link
        key={route.href}
        href={route.href}
        prefetch={false}
        onClick={onLinkClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          options?.nested && "ml-2 pl-4",
          isActive
            ? "bg-otwGold/10 text-otwGold"
            : "text-otwOffWhite/70 hover:bg-white/5 hover:text-otwOffWhite"
        )}
      >
        <route.icon className="h-4 w-4" />
        {route.label}
      </Link>
    )
  }

  return (
    <div className="relative z-40 flex h-full max-h-dvh w-64 touch-pan-y flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-otwBlack [-webkit-overflow-scrolling:touch]">
      <div className="flex h-32 shrink-0 items-center px-6">
        <OtwBrandLink
          imageClassName="h-24 w-24 rounded-xl"
          labelClassName="text-sm tracking-[0.28em] text-white"
          subtitle="On The Way"
        />
      </div>
      <nav className="space-y-1 px-3 py-4">
        {commonRoutes.map((route) => renderRoute(route))}

        {role === "DRIVER" && (
          <div className="space-y-1 pt-2">
            {driverRoutes.map((route) => renderRoute(route))}
          </div>
        )}

        {role === "ADMIN" && (
          <div className="space-y-2 pt-2">
            {adminGroups.map((group) => {
              const defaultOpen = group.defaultOpen !== false
              const hasActiveRoute = group.routes.some((route) => isRouteActive(pathname, route.href))
              const isOpen = hasActiveRoute || (openGroups[group.id] ?? defaultOpen)
              return (
                <div key={group.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((current) => ({
                        ...current,
                        [group.id]: !(current[group.id] ?? defaultOpen),
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-otwOffWhite/60 hover:bg-white/5 hover:text-otwOffWhite"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {group.label}
                    </span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isOpen && (
                    <div className="space-y-1">
                      {group.routes.map((route) => renderRoute(route, { nested: true }))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <SignOutButton
          variant="ghost"
          onClick={onLinkClick}
          className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium text-otwOffWhite/70 hover:bg-white/5 hover:text-otwOffWhite"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </SignOutButton>
      </nav>
      <div className="mt-auto shrink-0 border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-xs font-medium text-otwOffWhite">Need help?</p>
          <p className="text-xs text-white/50 mt-1">Contact support anytime.</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full border-white/10 text-xs h-8">
            <Link href="/support" prefetch={false}>Support</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
