import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { getCurrentUser } from "@/lib/auth/roles"

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const role = user?.role || 'CUSTOMER'

  return (
    <div className="flex h-screen bg-otwBlack text-otwOffWhite">
      <div className="hidden md:block">
        <DashboardSidebar role={role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="otw-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
