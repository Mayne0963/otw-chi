"use client";

import OtwCard from "@/components/ui/otw/OtwCard";
import HybridCacheControls from "@/components/hybrid/HybridCacheControls";
import HybridCacheIndicator from "@/components/hybrid/HybridCacheIndicator";
import { useHybridResource } from "@/lib/hybrid-storage/useHybridResource";

type MembershipPlanPublic = {
  id: string;
  name: string;
  description: string | null;
  monthlyServiceMiles: number;
  rolloverCapMiles: number;
  priorityLevel: number;
  markupFree: boolean;
  cashAllowed: boolean;
  peerToPeerAllowed: boolean;
  allowedServiceTypes: unknown;
  updatedAt: string;
};

type CitiesZonesPayload = {
  cities: Array<{ id: string; name: string; zones: Array<{ id: string; name: string; cityId: string }> }>;
};

export default function ReferenceDataPanel() {
  const plans = useHybridResource<MembershipPlanPublic[]>(
    "membershipPlansPublic",
    "/api/reference/membership-plans"
  );
  const cities = useHybridResource<CitiesZonesPayload>("citiesZones", "/api/reference/cities-zones");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OtwCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Membership Plans</div>
            <div className="text-xs text-muted-foreground">Cached reference data (refreshable)</div>
          </div>
          <HybridCacheIndicator
            statusLabel={plans.statusLabel}
            source={plans.source}
            fetchedAtMs={plans.fetchedAtMs}
          />
        </div>
        <div className="mt-3">
          <HybridCacheControls loading={plans.loading} onRefresh={plans.refresh} onClear={plans.clear} />
        </div>
        {plans.error ? <div className="mt-3 text-sm text-red-500">{plans.error}</div> : null}
        {plans.data ? (
          <div className="mt-3 space-y-2">
            {plans.data.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="font-medium">{p.name}</div>
                <div className="text-muted-foreground">{p.monthlyServiceMiles} mi</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">No cached plans yet.</div>
        )}
      </OtwCard>

      <OtwCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Cities & Zones</div>
            <div className="text-xs text-muted-foreground">Cached reference data (refreshable)</div>
          </div>
          <HybridCacheIndicator
            statusLabel={cities.statusLabel}
            source={cities.source}
            fetchedAtMs={cities.fetchedAtMs}
          />
        </div>
        <div className="mt-3">
          <HybridCacheControls loading={cities.loading} onRefresh={cities.refresh} onClear={cities.clear} />
        </div>
        {cities.error ? <div className="mt-3 text-sm text-red-500">{cities.error}</div> : null}
        {cities.data ? (
          <div className="mt-3 text-sm text-muted-foreground">
            {cities.data.cities.length} cities,{" "}
            {cities.data.cities.reduce((sum, c) => sum + c.zones.length, 0)} zones
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">No cached cities yet.</div>
        )}
      </OtwCard>
    </div>
  );
}

