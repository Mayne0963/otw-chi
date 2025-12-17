import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwEstimateWidget from '@/components/otw/OtwEstimateWidget';
import { createRequestAction } from '@/app/actions/request';

export default async function NewRequestPage() {
  const user = await getCurrentUser();
  const prisma = getPrisma();
  const cities = await prisma.city.findMany({ orderBy: { name: 'asc' } });
  const zones = await prisma.zone.findMany({ orderBy: { name: 'asc' } });
  return (
    <OtwPageShell>
      <OtwSectionHeader title="New Request" subtitle="Create a draft and submit." />
      {!user ? (
        <OtwCard><p className="text-sm">Please sign in to create a request.</p></OtwCard>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <OtwCard className="md:col-span-2 space-y-3">
            <form action={createRequestAction} className="space-y-3">
              <input name="pickup" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Pickup" />
              <input name="dropoff" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Dropoff" />
              <select name="serviceType" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" defaultValue="FOOD">
                <option value="FOOD">Food</option><option value="STORE">Store</option><option value="FRAGILE">Fragile</option><option value="CONCIERGE">Concierge</option>
              </select>
              <select name="cityId" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" defaultValue="">
                <option value="">Select City</option>
                {cities.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select name="zoneId" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" defaultValue="">
                <option value="">Select Zone</option>
                {zones.map(z => (<option key={z.id} value={z.id}>{z.name}</option>))}
              </select>
              <textarea name="notes" className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Notes" />
              <div className="flex gap-2">
                <OtwButton variant="outline">Save Draft</OtwButton>
                <OtwButton variant="gold">Submit</OtwButton>
              </div>
            </form>
          </OtwCard>
          <div>
            <OtwEstimateWidget />
          </div>
        </div>
      )}
    </OtwPageShell>
  );
}