import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { CreateRequestSchema } from '@/lib/validation/request';
import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db';

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
        <OtwCard className="space-y-3">
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
    const cityId = String(formData.get('cityId') ?? '');
    const zoneId = String(formData.get('zoneId') ?? '');
    const parsed = CreateRequestSchema.parse({
      pickup,
      dropoff,
      serviceType: st === 'FOOD' || st === 'STORE' || st === 'FRAGILE' || st === 'CONCIERGE' ? st : 'FOOD',
      notes: notes || undefined,
      cityId: cityId || undefined,
      zoneId: zoneId || undefined,
    });
    const { userId } = await import('@clerk/nextjs/server').then(m => m.auth());
    if (!userId) throw new Error('Unauthorized');
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({ where: { clerkId: userId } });
    if (!user) throw new Error('User not found');
    const miles = Math.max(0, Math.round(((pickup + dropoff + (parsed.notes || '')).length / 32) * 10));
    const cost = Math.round(miles * 150);
    const created = await prisma.request.create({
      data: {
        customerId: user.id,
        pickup: parsed.pickup,
        dropoff: parsed.dropoff,
        serviceType: parsed.serviceType as any,
        notes: parsed.notes,
        status: 'SUBMITTED',
        cityId: parsed.cityId,
        zoneId: parsed.zoneId,
        milesEstimate: miles,
        costEstimate: cost,
      },
    });
    await prisma.requestEvent.create({
      data: { requestId: created.id, type: 'STATUS_SUBMITTED', message: 'Submitted' },
    });
    revalidatePath('/requests');
  } catch (e) {
    console.error('createRequestAction failed:', e);
  }
}
