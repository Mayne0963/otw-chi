import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { CreateRequestSchema } from '@/lib/validation/request';
import { revalidatePath } from 'next/cache';

export default async function NewRequestPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="New Request" subtitle="Create a draft and submit." />
      {!user ? (
        <OtwCard><p className="text-sm">Please sign in to create a request.</p></OtwCard>
      ) : (
        <OtwCard className="space-y-3">
          <form action={createRequestAction} className="space-y-3">
          <input name="pickup" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Pickup" />
          <input name="dropoff" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Dropoff" />
          <select name="serviceType" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2">
            <option>Food</option><option>Store</option><option>Fragile</option><option>Concierge</option>
          </select>
          <textarea name="notes" className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Notes" />
          <div className="flex gap-2">
            <OtwButton variant="outline">Save Draft</OtwButton>
            <OtwButton variant="gold">Submit</OtwButton>
          </div>
          </form>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}

export async function createRequestAction(formData: FormData) {
  'use server';
  try {
    const pickup = String(formData.get('pickup') ?? '');
    const dropoff = String(formData.get('dropoff') ?? '');
    const st = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
    const notes = String(formData.get('notes') ?? '');
    const parsed = CreateRequestSchema.parse({
      pickup,
      dropoff,
      serviceType: st === 'FOOD' || st === 'STORE' || st === 'FRAGILE' || st === 'CONCIERGE' ? st : 'FOOD',
      notes: notes || undefined
    });
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/app/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to create request');
    revalidatePath('/requests');
  } catch (e) {
    console.error('createRequestAction failed:', e);
  }
}
