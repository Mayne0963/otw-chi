import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwEstimateWidget from '@/components/otw/OtwEstimateWidget';
import { createRequestAction } from '@/app/actions/request';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="New Request" subtitle="Sign in to start." />
        <OtwCard className="mt-3 text-center p-6">
          <p className="mb-4 text-sm opacity-80">You must be signed in to create a request.</p>
          <OtwButton as="a" href="/sign-in" variant="gold">Sign In</OtwButton>
        </OtwCard>
      </OtwPageShell>
    );
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="New Request" subtitle="Where to?" />
      
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        {/* Simple Form */}
        <OtwCard>
          <div className="text-sm font-medium mb-3">Request Details</div>
          <form action={createRequestAction} className="space-y-3">
            <input name="pickup" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Pickup Address" required />
            <input name="dropoff" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Dropoff Address" required />
            
            <select name="serviceType" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2">
              <option value="FOOD">Food Pickup</option>
              <option value="STORE">Store / Grocery</option>
              <option value="FRAGILE">Fragile Item</option>
              <option value="CONCIERGE">Custom Concierge</option>
            </select>

            <textarea name="notes" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 h-20" placeholder="Notes for driver (optional)" />

            {/* Hidden fields for city/zone logic (future) */}
            <input type="hidden" name="cityId" value="" />
            <input type="hidden" name="zoneId" value="" />

            <OtwButton variant="gold" className="w-full">Submit Request</OtwButton>
          </form>
        </OtwCard>

        {/* Estimate Widget */}
        <div className="space-y-4">
          <OtwEstimateWidget />
          
          <OtwCard>
            <div className="text-sm font-medium mb-2">Need Help?</div>
            <p className="text-xs opacity-70 mb-3">
              Not sure which service to pick? Use Concierge for custom errands.
            </p>
            <OtwButton as="a" href="/contact" variant="outline" size="sm">Contact Support</OtwButton>
          </OtwCard>
        </div>
      </div>
    </OtwPageShell>
  );
}