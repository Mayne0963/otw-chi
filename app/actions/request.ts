'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { estimatePrice } from '@/lib/pricing';
import { revalidatePath } from 'next/cache';

export async function createRequestAction(formData: FormData) {
  'use server';
  try {
    const pickup = String(formData.get('pickup') ?? '');
    const dropoff = String(formData.get('dropoff') ?? '');
    const st = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
    const notes = String(formData.get('notes') ?? '');
    const cityId = String(formData.get('cityId') ?? '');
    const zoneId = String(formData.get('zoneId') ?? '');
    
    // Validate service type
    const serviceType = ['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'].includes(st) ? st : 'FOOD';

    const { userId } = await import('@clerk/nextjs/server').then(m => m.auth());
    if (!userId) throw new Error('Unauthorized');
    
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({ where: { clerkId: userId } });
    if (!user) throw new Error('User not found');

    // Calculate miles (placeholder heuristic)
    const miles = Math.max(0, Math.round(((pickup + dropoff + (notes || '')).length / 32) * 10));

    // Get membership benefits
    const sub = await getActiveSubscription(user.id);
    const planCode = getPlanCodeFromSubscription(sub);
    const membershipBenefits = getMembershipBenefits(planCode);

    // Calculate cost with membership discount
    const basePrice = estimatePrice({ miles, serviceType: serviceType as any, tier: 'BASIC' });
    const finalPrice = basePrice * (1 - membershipBenefits.discount);

    const created = await prisma.request.create({
      data: {
        customer: { connect: { id: user.id } },
        pickup,
        dropoff,
        serviceType: serviceType as any,
        notes: notes || undefined,
        status: 'SUBMITTED',
        cityId: cityId || undefined,
        zoneId: zoneId || undefined,
        milesEstimate: miles,
        costEstimate: finalPrice,
      } as any,
    });
    
    await prisma.requestEvent.create({
      data: { requestId: created.id, type: 'STATUS_SUBMITTED', message: 'Submitted' },
    });
    
    revalidatePath('/requests');
  } catch (e) {
    console.error('createRequestAction failed:', e);
  }
}