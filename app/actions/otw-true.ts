'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { getActiveSubscriptionUncached } from '@/lib/membership';
import {
  ensureEmployeeHasOtwBasicMembership,
  OTW_TRUE_PLAN_NAME,
} from '@/lib/otw-true';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildMembershipManagePath(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/membership/manage?${searchParams.toString()}`;
}

function isActiveOtwTrueSubscription(subscription: Awaited<ReturnType<typeof getActiveSubscriptionUncached>>) {
  if (!subscription?.plan) return false;
  return subscription.plan.name.trim().toUpperCase() === OTW_TRUE_PLAN_NAME;
}

export async function addOtwTrueEmployeeAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect(buildMembershipManagePath({ otwTrueError: 'You must be signed in.' }));
  }

  const employeeEmail = String(formData.get('employeeEmail') ?? '').trim().toLowerCase();
  const employeeNameRaw = String(formData.get('employeeName') ?? '').trim();
  const employeeName = employeeNameRaw.length > 0 ? employeeNameRaw : null;

  if (!EMAIL_PATTERN.test(employeeEmail)) {
    redirect(buildMembershipManagePath({ otwTrueError: 'Enter a valid employee email address.' }));
  }

  if (currentUser.email.trim().toLowerCase() === employeeEmail) {
    redirect(buildMembershipManagePath({ otwTrueError: 'You cannot add your own email as an employee.' }));
  }

  const prisma = getPrisma();
  const ownerSubscription = await getActiveSubscriptionUncached(currentUser.id);
  if (!ownerSubscription || !isActiveOtwTrueSubscription(ownerSubscription)) {
    redirect(
      buildMembershipManagePath({
        otwTrueError: 'OTW True membership is required to manage employees.',
      }),
    );
  }

  const matchedUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: employeeEmail,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  await prisma.otwTrueEmployee.upsert({
    where: {
      ownerUserId_employeeEmail: {
        ownerUserId: currentUser.id,
        employeeEmail,
      },
    },
    update: {
      employeeName,
      employeeUserId: matchedUser?.id ?? null,
      isActive: true,
      removedAt: null,
    },
    create: {
      ownerUserId: currentUser.id,
      employeeEmail,
      employeeName,
      employeeUserId: matchedUser?.id ?? null,
      isActive: true,
    },
  });

  if (matchedUser?.id) {
    await ensureEmployeeHasOtwBasicMembership(prisma, {
      employeeUserId: matchedUser.id,
      ownerCurrentPeriodEnd: ownerSubscription.currentPeriodEnd ?? null,
    });
  }

  revalidatePath('/membership/manage');
  revalidatePath('/membership');
  revalidatePath('/api/service-miles/wallet');

  redirect(
    buildMembershipManagePath({
      otwTrueSuccess: `Added ${employeeEmail} to OTW True employee access.`,
    }),
  );
}

export async function removeOtwTrueEmployeeAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect(buildMembershipManagePath({ otwTrueError: 'You must be signed in.' }));
  }

  const employeeId = String(formData.get('employeeId') ?? '').trim();
  if (!employeeId) {
    redirect(buildMembershipManagePath({ otwTrueError: 'Invalid employee selection.' }));
  }

  const prisma = getPrisma();
  const result = await prisma.otwTrueEmployee.updateMany({
    where: {
      id: employeeId,
      ownerUserId: currentUser.id,
      isActive: true,
    },
    data: {
      isActive: false,
      removedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    redirect(buildMembershipManagePath({ otwTrueError: 'Employee not found or already removed.' }));
  }

  revalidatePath('/membership/manage');
  revalidatePath('/api/service-miles/wallet');
  redirect(buildMembershipManagePath({ otwTrueSuccess: 'Employee removed from OTW True access.' }));
}
