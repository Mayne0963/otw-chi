import { getPrisma } from '@/lib/db';

type EnsureUserInput = {
  clerkUserId: string;
  email?: string;
};

export async function ensureUser({ clerkUserId, email }: EnsureUserInput) {
  const prisma = getPrisma();

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUserId },
    create: {
      clerkId: clerkUserId,
      email: email ?? (() => {
        throw new Error('email is required to create a new user');
      })(),
      role: 'CUSTOMER',
    },
    update: email ? { email } : {},
  });

  const membership = await prisma.membershipSubscription.findUnique({
    where: { userId: user.id },
  });

  if (!membership) {
    const plan =
      (await prisma.membershipPlan.findUnique({ where: { name: 'OTW BASIC' } })) ??
      (await prisma.membershipPlan.create({
        data: {
          name: 'OTW BASIC',
          description: 'Best for food, groceries, and quick errands.',
          monthlyServiceMiles: 60,
          rolloverCapMiles: 0,
          advanceDiscountMax: 0,
          priorityLevel: 0,
          markupFree: false,
          cashAllowed: false,
          peerToPeerAllowed: false,
          allowedServiceTypes: ['FOOD', 'STORE'],
        },
      }));

    await prisma.membershipSubscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
      },
    });
  }
  return user;
}
