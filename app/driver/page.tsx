import DriverMapClient from "./DriverMapClient";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/driver");
  }
  if (user.role !== "DRIVER" && user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-md space-y-3 rounded-xl border border-border/70 bg-card/70 px-6 py-5 text-center">
          <div className="text-lg font-semibold">Driver access required</div>
          <div className="text-sm text-muted-foreground">
            Switch to a driver account to use live navigation and routing tools.
          </div>
          <div className="flex justify-center gap-2 text-sm">
            <Link href="/dashboard" className="rounded-md border border-border/70 px-3 py-2 hover:border-secondary/60">
              Go to dashboard
            </Link>
            <Link href="/support" className="rounded-md border border-border/70 px-3 py-2 hover:border-secondary/60">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DriverMapClient />
    </div>
  );
}
