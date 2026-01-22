import DriverMapClient from "@/components/driver/DriverMapClient";
import { Suspense } from "react";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";

export const dynamic = "force-dynamic";

export default function DriverMapPage() {
  return (
    <OtwPageShell>
      <Suspense fallback={<div className="text-center p-8 text-white/50">Loading navigation...</div>}>
        <DriverMapClient />
      </Suspense>
    </OtwPageShell>
  );
}
