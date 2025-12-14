import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';

export default async function NewRequestPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="New Request" subtitle="Create a draft and submit." />
      {!user ? (
        <OtwCard><p className="text-sm">Please sign in to create a request.</p></OtwCard>
      ) : (
        <OtwCard className="space-y-3">
          <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Pickup" />
          <input className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Dropoff" />
          <select className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2">
            <option>Food</option><option>Store</option><option>Fragile</option><option>Concierge</option>
          </select>
          <textarea className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Notes" />
          <div className="flex gap-2">
            <OtwButton variant="outline">Save Draft</OtwButton>
            <OtwButton variant="gold">Submit</OtwButton>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}

