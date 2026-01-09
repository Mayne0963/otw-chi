import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { getCurrentUser } from "@/lib/auth/roles"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getEnvDiagnostics } from "@/lib/envDiagnostics"

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const role = user?.role || 'CUSTOMER'
  const envDiagnostics = getEnvDiagnostics()
  const envIssues = [...envDiagnostics.missingServer, ...envDiagnostics.missingClient]

  if (!user) {
    redirect('/sign-in?redirect_url=/admin')
  }

  if (role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-otwBlack text-otwOffWhite">
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <div className="text-lg font-semibold">Admin access required</div>
          <div className="text-sm text-white/70">
            Your account does not have permission to view OTW admin tools.
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-otwOffWhite hover:border-white/50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-otwBlack text-otwOffWhite">
      <div className="hidden md:block">
        <DashboardSidebar role={role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {envIssues.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200/30 bg-amber-200/10 px-4 py-3 text-sm text-amber-50">
              Missing env vars: {envIssues.join(", ")}. Add them in Vercel to enable all admin tools.
            </div>
          )}
          <div className="otw-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
