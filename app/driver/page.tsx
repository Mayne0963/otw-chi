import DriverMapClient from "./DriverMapClient";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/driver");
  }
  if (user.role !== "DRIVER" && user.role !== "ADMIN") {
    // Non-drivers are redirected to their dashboard; middleware could enforce this globally later.
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DriverMapClient />
    </div>
  );
}
