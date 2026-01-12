import { getUserRequests } from "@/app/actions/request";
import { getCurrentUser } from "@/lib/auth/roles";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import OtwButton from "@/components/ui/otw/OtwButton";
import OtwEmptyState from "@/components/ui/otw/OtwEmptyState";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrackLandingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader
          title="Track My Driver"
          subtitle="Sign in to view your active and past deliveries."
        />
        <OtwCard className="max-w-xl mt-6">
          <div className="p-4 border-b border-white/10 mb-4">
            <h3 className="text-lg font-medium text-white">Sign in required</h3>
          </div>
          <div className="p-4 space-y-3 text-sm text-white/70">
            <p>We’ll take you back here after you sign in.</p>
            <OtwButton as="a" href="/sign-in?redirect_url=/track" className="w-full">
              Sign in
            </OtwButton>
            <OtwButton as="a" href="/sign-up?redirect_url=/track" variant="outline" className="w-full">
              Create account
            </OtwButton>
          </div>
        </OtwCard>
      </OtwPageShell>
    );
  }

  const requests = await getUserRequests();

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Track My Driver"
        subtitle="Live status, ETA, and route preview for your deliveries."
      />

      {requests.length === 0 ? (
        <OtwEmptyState
          title="No deliveries yet"
          subtitle="Place a delivery request to start tracking."
          actionLabel="Place an order"
          actionHref="/order"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {requests.map((request) => (
            <OtwCard key={request.id}>
              <div className="p-4 border-b border-white/10 mb-4 flex items-center justify-between">
                <span className="font-semibold text-white">{request.serviceType}</span>
                <span className="bg-white/10 text-white px-2 py-0.5 rounded text-xs font-medium uppercase border border-white/10">
                  {request.status}
                </span>
              </div>
              <div className="p-4 space-y-3 text-sm text-white/70">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Pickup</div>
                  <div className="text-white">{request.pickup}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Dropoff</div>
                  <div className="text-white">{request.dropoff}</div>
                </div>
                <div className="text-xs text-white/50">
                  {formatDate(request.createdAt)}
                </div>
                <OtwButton as="a" href={`/track/${request.id}`} className="w-full">
                  View tracking
                </OtwButton>
              </div>
            </OtwCard>
          ))}
        </div>
      )}
    </OtwPageShell>
  );
}
