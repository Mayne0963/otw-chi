import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import CacheDashboard from "@/components/hybrid/CacheDashboard";

export const dynamic = "force-dynamic";

export default function CachePage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Hybrid Storage"
        subtitle="Local cache + background refresh for reference data."
      />
      <div className="mt-6">
        <CacheDashboard />
      </div>
    </OtwPageShell>
  );
}

