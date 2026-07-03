import type { MembershipStatus, Prisma, PrismaClient, ServiceType } from '@prisma/client';
import { grantMembershipMilesForPeriod } from '@/lib/membership-benefits';

export const OTW_TRUE_PLAN_NAME = 'OTW TRUE';
export const OTW_BASIC_PLAN_NAME = 'OTW BASIC';

const ACTIVE_MEMBERSHIP_STATUSES: MembershipStatus[] = ['ACTIVE', 'TRIALING'];

export const OTW_TRUE_BENEFIT_TYPES = ['FOOD_JOB_SITE', 'COMMUTE_RIDE', 'ROADSIDE_ASSIST'] as const;
export type OtwTrueBenefitType = (typeof OTW_TRUE_BENEFIT_TYPES)[number];

export type OtwTrueJobSiteBusinessSummary = {
  ownerUserId: string;
  businessLegalName: string;
  validatedAddress: string | null;
  primaryBusinessStreetAddress: string;
  primaryBusinessCity: string;
  primaryBusinessStateProvince: string;
  primaryBusinessPostalCode: string;
  primaryBusinessCountry: string;
};

const OTW_TRUE_YEARLY_LIMITS = {
  COMMUTE_RIDE: 2,
  ROADSIDE_ASSIST: 2,
} as const;

type PrismaLike = Pick<
  Prisma.TransactionClient,
  'membershipPlan' | 'membershipSubscription' | 'otwTrueEmployee' | 'otwTrueEmployeeBenefitYear' | 'serviceMilesLedger' | 'serviceMilesWallet'
> &
  Partial<
    Pick<
      PrismaClient,
      '$transaction'
    >
  >;

type ActiveOwnerMembership = {
  status: MembershipStatus;
  currentPeriodEnd: Date | null;
  plan: {
    name: string;
  } | null;
} | null;

type OtwTrueLinkWithOwner = {
  id: string;
  ownerUserId: string;
  employeeUserId: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
    membership: ActiveOwnerMembership;
    businessMembershipProfile: {
      businessLegalName: string;
      validatedAddress: string | null;
      primaryBusinessStreetAddress: string;
      primaryBusinessCity: string;
      primaryBusinessStateProvince: string;
      primaryBusinessPostalCode: string;
      primaryBusinessCountry: string;
    } | null;
  };
  yearlyBenefits: Array<{
    freeFoodDeliveriesUsed: number;
    commuteRidesUsed: number;
    roadsideAssistsUsed: number;
  }>;
};

export type OtwTrueEntitlementSummary = {
  employeeId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string;
  jobSiteBusiness: OtwTrueJobSiteBusinessSummary | null;
  benefitYear: number;
  usage: {
    freeFoodDeliveriesUsed: number;
    commuteRidesUsed: number;
    roadsideAssistsUsed: number;
  };
  remaining: {
    commuteRides: number;
    roadsideAssists: number;
  };
};

function buildOtwTrueJobSiteBusinessAddressParts(
  business: OtwTrueJobSiteBusinessSummary | null | undefined,
): string[] {
  if (!business) return [];

  const cityStatePostal = [
    business.primaryBusinessCity,
    business.primaryBusinessStateProvince,
    business.primaryBusinessPostalCode,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');

  return [
    business.primaryBusinessStreetAddress,
    cityStatePostal,
    business.primaryBusinessCountry && business.primaryBusinessCountry !== 'US'
      ? business.primaryBusinessCountry
      : null,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

export function buildOtwTrueJobSiteBusinessAddress(
  business: OtwTrueJobSiteBusinessSummary | null | undefined,
): string {
  if (!business) return '';

  const validatedAddress = business.validatedAddress?.trim();
  if (validatedAddress) {
    return validatedAddress;
  }

  return buildOtwTrueJobSiteBusinessAddressParts(business).join(', ');
}

export function buildOtwTrueJobSiteBusinessValidationAddress(
  business: OtwTrueJobSiteBusinessSummary | null | undefined,
): string {
  const addressParts = buildOtwTrueJobSiteBusinessAddressParts(business);
  return addressParts.length > 0 ? addressParts.join(', ') : buildOtwTrueJobSiteBusinessAddress(business);
}

export type ConsumedOtwTrueBenefit = {
  benefitType: OtwTrueBenefitType;
  employeeId: string;
  ownerUserId: string;
  benefitYear: number;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = String(email ?? '').trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function isMembershipActiveNow(status: MembershipStatus, currentPeriodEnd: Date | null, now: Date): boolean {
  return ACTIVE_MEMBERSHIP_STATUSES.includes(status) && (!currentPeriodEnd || currentPeriodEnd > now);
}

function isActiveOtwTrueOwnerMembership(membership: ActiveOwnerMembership, now: Date): boolean {
  if (!membership?.plan) return false;
  if (membership.plan.name.trim().toUpperCase() !== OTW_TRUE_PLAN_NAME) return false;
  return isMembershipActiveNow(membership.status, membership.currentPeriodEnd, now);
}

function mapEntitlement(link: OtwTrueLinkWithOwner, year: number): OtwTrueEntitlementSummary {
  const usage = link.yearlyBenefits[0] ?? {
    freeFoodDeliveriesUsed: 0,
    commuteRidesUsed: 0,
    roadsideAssistsUsed: 0,
  };

  return {
    employeeId: link.id,
    ownerUserId: link.ownerUserId,
    ownerName: link.owner.name,
    ownerEmail: link.owner.email,
    jobSiteBusiness: link.owner.businessMembershipProfile
      ? {
          ownerUserId: link.ownerUserId,
          businessLegalName: link.owner.businessMembershipProfile.businessLegalName,
          validatedAddress: link.owner.businessMembershipProfile.validatedAddress,
          primaryBusinessStreetAddress:
            link.owner.businessMembershipProfile.primaryBusinessStreetAddress,
          primaryBusinessCity: link.owner.businessMembershipProfile.primaryBusinessCity,
          primaryBusinessStateProvince:
            link.owner.businessMembershipProfile.primaryBusinessStateProvince,
          primaryBusinessPostalCode: link.owner.businessMembershipProfile.primaryBusinessPostalCode,
          primaryBusinessCountry: link.owner.businessMembershipProfile.primaryBusinessCountry,
        }
      : null,
    benefitYear: year,
    usage: {
      freeFoodDeliveriesUsed: usage.freeFoodDeliveriesUsed,
      commuteRidesUsed: usage.commuteRidesUsed,
      roadsideAssistsUsed: usage.roadsideAssistsUsed,
    },
    remaining: {
      commuteRides: Math.max(0, OTW_TRUE_YEARLY_LIMITS.COMMUTE_RIDE - usage.commuteRidesUsed),
      roadsideAssists: Math.max(0, OTW_TRUE_YEARLY_LIMITS.ROADSIDE_ASSIST - usage.roadsideAssistsUsed),
    },
  };
}

async function findActiveOtwTrueLink(
  client: PrismaLike,
  input: { userId: string; email: string | null; year: number; now: Date },
): Promise<OtwTrueLinkWithOwner | null> {
  const email = normalizeEmail(input.email);
  const orWhere: Prisma.OtwTrueEmployeeWhereInput[] = [{ employeeUserId: input.userId }];
  if (email) {
    orWhere.push({ employeeEmail: { equals: email, mode: 'insensitive' } });
  }

  const links = (await client.otwTrueEmployee.findMany({
    where: {
      isActive: true,
      OR: orWhere,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          membership: {
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
          businessMembershipProfile: {
            select: {
              businessLegalName: true,
              validatedAddress: true,
              primaryBusinessStreetAddress: true,
              primaryBusinessCity: true,
              primaryBusinessStateProvince: true,
              primaryBusinessPostalCode: true,
              primaryBusinessCountry: true,
            },
          },
        },
      },
      yearlyBenefits: {
        where: { benefitYear: input.year },
        select: {
          freeFoodDeliveriesUsed: true,
          commuteRidesUsed: true,
          roadsideAssistsUsed: true,
        },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })) as OtwTrueLinkWithOwner[];

  for (const link of links) {
    if (!isActiveOtwTrueOwnerMembership(link.owner.membership, input.now)) {
      continue;
    }
    return link;
  }

  return null;
}

export function isOtwTrueBenefitType(value: unknown): value is OtwTrueBenefitType {
  return typeof value === 'string' && (OTW_TRUE_BENEFIT_TYPES as readonly string[]).includes(value);
}

function pickExtendedEndDate(existing: Date | null, owner: Date | null): Date | null {
  if (existing && owner) {
    return existing > owner ? existing : owner;
  }
  return existing ?? owner ?? null;
}

export async function ensureEmployeeHasOtwBasicMembership(
  client: PrismaLike,
  input: {
    employeeUserId: string;
    ownerCurrentPeriodEnd: Date | null;
  },
): Promise<void> {
  const basicPlan = await client.membershipPlan.findFirst({
    where: { name: { equals: OTW_BASIC_PLAN_NAME, mode: 'insensitive' } },
    select: { id: true, name: true, monthlyServiceMiles: true },
  });
  if (!basicPlan) {
    return;
  }

  const existing = await client.membershipSubscription.findUnique({
    where: { userId: input.employeeUserId },
    select: {
      id: true,
      planId: true,
      status: true,
      currentPeriodEnd: true,
      renewsAt: true,
    },
  });

  if (
    existing &&
    ACTIVE_MEMBERSHIP_STATUSES.includes(existing.status) &&
    existing.planId &&
    existing.planId !== basicPlan.id
  ) {
    return;
  }

  const nextPeriodEnd = pickExtendedEndDate(existing?.currentPeriodEnd ?? null, input.ownerCurrentPeriodEnd);

  const membership = await client.membershipSubscription.upsert({
    where: { userId: input.employeeUserId },
    update: {
      planId: basicPlan.id,
      status: 'ACTIVE',
      currentPeriodEnd: nextPeriodEnd,
      renewsAt: nextPeriodEnd,
    },
    create: {
      userId: input.employeeUserId,
      planId: basicPlan.id,
      status: 'ACTIVE',
      currentPeriodEnd: nextPeriodEnd,
      renewsAt: nextPeriodEnd,
    },
  });

  await grantMembershipMilesForPeriod(client, {
    userId: membership.userId,
    plan: {
      id: basicPlan.id,
      name: basicPlan.name,
      monthlyServiceMiles: basicPlan.monthlyServiceMiles,
    },
    currentPeriodEnd: nextPeriodEnd,
    source: 'otw_true_employee',
  });
}

export async function syncOtwTrueEmployeeAccessForUser(
  client: PrismaLike,
  input: { userId: string; email: string | null; now?: Date },
): Promise<OtwTrueEntitlementSummary | null> {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const email = normalizeEmail(input.email);

  if (email) {
    await client.otwTrueEmployee.updateMany({
      where: {
        employeeUserId: null,
        employeeEmail: { equals: email, mode: 'insensitive' },
      },
      data: { employeeUserId: input.userId },
    });
  }

  const link = await findActiveOtwTrueLink(client, {
    userId: input.userId,
    email,
    year,
    now,
  });
  if (!link) return null;

  if (!link.employeeUserId) {
    await client.otwTrueEmployee.update({
      where: { id: link.id },
      data: { employeeUserId: input.userId },
    });
  }

  await ensureEmployeeHasOtwBasicMembership(client, {
    employeeUserId: input.userId,
    ownerCurrentPeriodEnd: link.owner.membership?.currentPeriodEnd ?? null,
  });

  return mapEntitlement(link, year);
}

function assertBenefitMatchesServiceType(benefitType: OtwTrueBenefitType, serviceType: ServiceType) {
  if (benefitType === 'FOOD_JOB_SITE' && serviceType !== 'FOOD') {
    throw new Error('OTW True food benefit can only be used with FOOD requests');
  }

  if (benefitType === 'COMMUTE_RIDE' && serviceType !== 'RIDE') {
    throw new Error('OTW True commute ride benefit can only be used with RIDE requests');
  }

  if (benefitType === 'ROADSIDE_ASSIST' && serviceType !== 'RIDE' && serviceType !== 'CONCIERGE') {
    throw new Error('OTW True roadside assist can only be used with RIDE or CONCIERGE requests');
  }
}

export async function consumeOtwTrueBenefit(
  client: PrismaLike,
  input: { userId: string; email: string | null; serviceType: ServiceType; benefitType: OtwTrueBenefitType; now?: Date },
): Promise<ConsumedOtwTrueBenefit> {
  const now = input.now ?? new Date();
  const year = now.getFullYear();

  const link = await findActiveOtwTrueLink(client, {
    userId: input.userId,
    email: input.email,
    year,
    now,
  });

  if (!link) {
    throw new Error('You are not linked to an active OTW True business membership');
  }

  assertBenefitMatchesServiceType(input.benefitType, input.serviceType);

  await client.otwTrueEmployeeBenefitYear.upsert({
    where: {
      employeeId_benefitYear: {
        employeeId: link.id,
        benefitYear: year,
      },
    },
    update: {},
    create: {
      employeeId: link.id,
      benefitYear: year,
    },
  });

  if (input.benefitType === 'COMMUTE_RIDE') {
    const updated = await client.otwTrueEmployeeBenefitYear.updateMany({
      where: {
        employeeId: link.id,
        benefitYear: year,
        commuteRidesUsed: { lt: OTW_TRUE_YEARLY_LIMITS.COMMUTE_RIDE },
      },
      data: {
        commuteRidesUsed: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new Error('OTW True commute-ride limit reached for this year');
    }
  } else if (input.benefitType === 'ROADSIDE_ASSIST') {
    const updated = await client.otwTrueEmployeeBenefitYear.updateMany({
      where: {
        employeeId: link.id,
        benefitYear: year,
        roadsideAssistsUsed: { lt: OTW_TRUE_YEARLY_LIMITS.ROADSIDE_ASSIST },
      },
      data: {
        roadsideAssistsUsed: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new Error('OTW True roadside-assist limit reached for this year');
    }
  } else {
    await client.otwTrueEmployeeBenefitYear.update({
      where: {
        employeeId_benefitYear: {
          employeeId: link.id,
          benefitYear: year,
        },
      },
      data: {
        freeFoodDeliveriesUsed: { increment: 1 },
      },
    });
  }

  return {
    benefitType: input.benefitType,
    employeeId: link.id,
    ownerUserId: link.ownerUserId,
    benefitYear: year,
  };
}
