import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import QueryPopupAlert from '@/components/ui/query-popup-alert';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { grantMembershipMilesForPeriod } from '@/lib/membership-benefits';
import { getStripe } from '@/lib/stripe';
import {
  buildBusinessAddressSummary,
  formatBusinessIndustryLabel,
} from '@/lib/business-membership-profile';
import { isBusinessMembershipPlanName } from '@/lib/membership';
import {
  formatBusinessMembershipInvoiceAmount,
  getBusinessMembershipInvoicePlanConfig,
} from '@/lib/business-membership-invoice';

function formatDistanceSafe(value: unknown) {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return 'N/A';

  return formatDistanceToNow(date, { addSuffix: true });
}

// Loading component for better UX
function AdminMembershipsLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

function buildMembershipAdminPath(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/admin/memberships?${search.toString()}`;
}

function getActionRedirectError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

function getBusinessProfileMetrics(memberships: MembershipRow[]) {
  const businessMemberships = memberships.filter((membership) =>
    isBusinessMembershipPlanName(membership.plan?.name ?? null),
  );
  const profilesOnFile = businessMemberships.filter((membership) => Boolean(membership.businessProfile)).length;
  const profilesMissing = Math.max(businessMemberships.length - profilesOnFile, 0);
  const completionRate =
    businessMemberships.length > 0 ? Math.round((profilesOnFile / businessMemberships.length) * 100) : null;

  return {
    businessMembershipCount: businessMemberships.length,
    businessProfilesOnFile: profilesOnFile,
    businessProfilesMissing: profilesMissing,
    businessProfileCompletionRate: completionRate,
  };
}

export async function assignMembershipAction(formData: FormData) {
  'use server';

  await requireRole(['ADMIN']);

  const userId = String(formData.get('userId') ?? '').trim();
  const planId = String(formData.get('planId') ?? '').trim();
  const rawDurationDays = String(formData.get('durationDays') ?? '').trim();
  const durationDays = Number.parseInt(rawDurationDays, 10);

  if (!userId || !planId || !Number.isFinite(durationDays)) {
    redirect(buildMembershipAdminPath({ assignError: 'User, plan, and duration are required.' }));
  }

  if (durationDays < 1 || durationDays > 730) {
    redirect(buildMembershipAdminPath({ assignError: 'Duration must be between 1 and 730 days.' }));
  }

  const prisma = getPrisma();
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    }),
    prisma.membershipPlan.findUnique({
      where: { id: planId },
      select: { id: true, name: true, stripePriceId: true, monthlyServiceMiles: true },
    }),
  ]);

  if (!user) {
    redirect(buildMembershipAdminPath({ assignError: 'Selected user was not found.' }));
  }

  if (!plan) {
    redirect(buildMembershipAdminPath({ assignError: 'Selected plan was not found.' }));
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  try {
    const subscription = await prisma.membershipSubscription.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        stripePriceId: plan.stripePriceId ?? undefined,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd,
        renewsAt: currentPeriodEnd,
        stripePriceId: plan.stripePriceId ?? null,
      },
    });

    await grantMembershipMilesForPeriod(prisma, {
      userId: subscription.userId,
      plan: {
        id: plan.id,
        name: plan.name,
        monthlyServiceMiles: plan.monthlyServiceMiles ?? 0,
      },
      currentPeriodEnd,
      source: 'admin_assign_membership',
    });
  } catch (error) {
    console.error('[assignMembershipAction] Failed to assign membership:', error);
    redirect(buildMembershipAdminPath({ assignError: 'Failed to assign membership. Please try again.' }));
  }

  revalidatePath('/admin/memberships');
  revalidatePath(`/admin/customers/${user.id}`);
  revalidatePath('/membership/manage');

  redirect(
    buildMembershipAdminPath({
      assignSuccess: `Assigned ${plan.name} to ${user.email} for ${durationDays} days.`,
    })
  );
}

async function getBusinessInvoiceRequestForAction(requestId: string) {
  const prisma = getPrisma();

  return prisma.businessMembershipInvoiceRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function reviewBusinessInvoiceRequestAction(formData: FormData) {
  'use server';

  await requireRole(['ADMIN']);

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Invoice request id is required.' }));
  }

  const prisma = getPrisma();
  const request = await getBusinessInvoiceRequestForAction(requestId);

  if (!request) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Business invoice request not found.' }));
  }

  if (request.status === 'CLOSED') {
    redirect(buildMembershipAdminPath({ invoiceError: 'Closed requests cannot be accepted.' }));
  }

  if (request.status === 'CONVERTED') {
    redirect(buildMembershipAdminPath({ invoiceError: 'This request has already been converted into an invoice workflow.' }));
  }

  await prisma.businessMembershipInvoiceRequest.update({
    where: { id: request.id },
    data: { status: 'REVIEWED' },
  });

  revalidatePath('/admin/memberships');

  redirect(
    buildMembershipAdminPath({
      invoiceSuccess: `Accepted ${request.businessLegalName} for ${request.planName}.`,
    }),
  );
}

export async function declineBusinessInvoiceRequestAction(formData: FormData) {
  'use server';

  await requireRole(['ADMIN']);

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Invoice request id is required.' }));
  }

  const prisma = getPrisma();
  const request = await getBusinessInvoiceRequestForAction(requestId);

  if (!request) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Business invoice request not found.' }));
  }

  if (request.status === 'CONVERTED') {
    redirect(
      buildMembershipAdminPath({
        invoiceError: 'This request already has an invoice workflow. Close it manually after billing is resolved.',
      }),
    );
  }

  if (request.status === 'CLOSED') {
    redirect(buildMembershipAdminPath({ invoiceSuccess: `${request.businessLegalName} is already marked declined.` }));
  }

  await prisma.businessMembershipInvoiceRequest.update({
    where: { id: request.id },
    data: { status: 'CLOSED' },
  });

  revalidatePath('/admin/memberships');

  redirect(
    buildMembershipAdminPath({
      invoiceSuccess: `Declined ${request.businessLegalName}.`,
    }),
  );
}

export async function startManualBusinessInvoiceRequestAction(formData: FormData) {
  'use server';

  await requireRole(['ADMIN']);

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Invoice request id is required.' }));
  }

  const prisma = getPrisma();
  const request = await getBusinessInvoiceRequestForAction(requestId);

  if (!request) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Business invoice request not found.' }));
  }

  if (request.status === 'CLOSED') {
    redirect(buildMembershipAdminPath({ invoiceError: 'Declined requests cannot start an invoice workflow.' }));
  }

  if (request.invoiceStartedAt || request.stripeInvoiceId || request.invoiceWorkflowType) {
    redirect(buildMembershipAdminPath({ invoiceError: 'An invoice workflow has already been started for this request.' }));
  }

  await prisma.businessMembershipInvoiceRequest.update({
    where: { id: request.id },
    data: {
      status: 'CONVERTED',
      invoiceWorkflowType: 'MANUAL',
      invoiceStartedAt: new Date(),
    },
  });

  revalidatePath('/admin/memberships');

  redirect(
    buildMembershipAdminPath({
      invoiceSuccess: `Marked ${request.businessLegalName} for manual invoicing.`,
    }),
  );
}

export async function startStripeBusinessInvoiceRequestAction(formData: FormData) {
  'use server';

  await requireRole(['ADMIN']);

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Invoice request id is required.' }));
  }

  const prisma = getPrisma();
  const request = await getBusinessInvoiceRequestForAction(requestId);

  if (!request) {
    redirect(buildMembershipAdminPath({ invoiceError: 'Business invoice request not found.' }));
  }

  if (request.status === 'CLOSED') {
    redirect(buildMembershipAdminPath({ invoiceError: 'Declined requests cannot start an invoice workflow.' }));
  }

  if (request.invoiceStartedAt || request.stripeInvoiceId || request.invoiceWorkflowType) {
    redirect(buildMembershipAdminPath({ invoiceError: 'An invoice workflow has already been started for this request.' }));
  }

  const planConfig = getBusinessMembershipInvoicePlanConfig(request.planName);
  if (!planConfig.supportsStripeInvoice || !planConfig.amountCents) {
    redirect(
      buildMembershipAdminPath({
        invoiceError: `${request.planName} requires manual invoice handling because pricing is custom.`,
      }),
    );
  }

  const stripe = getStripe();
  let successMessage = `Started Stripe invoice for ${request.businessLegalName} (${formatBusinessMembershipInvoiceAmount(planConfig.amountCents)}).`;

  try {
    const existingCustomers = await stripe.customers.list({
      email: request.primaryContactEmail,
      limit: 1,
    });

    const customer =
      existingCustomers.data[0] ??
      (await stripe.customers.create({
        email: request.primaryContactEmail,
        name: request.primaryContactFullName,
        phone: request.primaryContactPhone,
        address: {
          line1: request.primaryBusinessStreetAddress,
          city: request.primaryBusinessCity,
          state: request.primaryBusinessStateProvince,
          postal_code: request.primaryBusinessPostalCode,
          country:
            request.primaryBusinessCountry.trim().toUpperCase() === 'UNITED STATES'
              ? 'US'
              : undefined,
        },
        metadata: {
          purpose: 'business_membership_invoice_request',
          requestId: request.id,
          planName: request.planName,
          businessLegalName: request.businessLegalName,
        },
      }));

    const draftInvoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      description: `${request.planName} membership invoice request for ${request.businessLegalName}`,
      metadata: {
        purpose: 'business_membership_invoice_request',
        requestId: request.id,
        userId: request.userId ?? '',
        planName: request.planName,
        businessLegalName: request.businessLegalName,
      },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: draftInvoice.id,
      amount: planConfig.amountCents,
      currency: 'usd',
      description: `${request.planName} membership for ${request.businessLegalName}`,
      metadata: {
        purpose: 'business_membership_invoice_request',
        requestId: request.id,
        planName: request.planName,
      },
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);

    await prisma.businessMembershipInvoiceRequest.update({
      where: { id: request.id },
      data: {
        status: 'CONVERTED',
        invoiceWorkflowType: 'STRIPE',
        stripeInvoiceId: finalizedInvoice.id,
        invoiceStartedAt: new Date(),
      },
    });

    try {
      await stripe.invoices.sendInvoice(finalizedInvoice.id);
    } catch (sendError) {
      console.error('[startStripeBusinessInvoiceRequestAction] Failed to send finalized Stripe invoice:', sendError);
      successMessage = `Created Stripe invoice ${finalizedInvoice.id} for ${request.businessLegalName}, but email delivery needs manual follow-up in Stripe.`;
    }
  } catch (error) {
    console.error('[startStripeBusinessInvoiceRequestAction] Failed to create Stripe invoice:', error);
    redirect(
      buildMembershipAdminPath({
        invoiceError: getActionRedirectError(error, 'Failed to create Stripe invoice. Please try again.'),
      }),
    );
  }

  revalidatePath('/admin/memberships');

  redirect(
    buildMembershipAdminPath({
      invoiceSuccess: successMessage,
    }),
  );
}

async function getMembershipsData() {
  const prisma = getPrisma();
  
  try {
    const [memberships, stats, assignableUsers, plans, invoiceRequests] = await Promise.all([
      prisma.membershipSubscription.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, name: true, description: true } },
          businessProfile: {
            select: {
              businessLegalName: true,
              employeeCount: true,
              primaryBusinessStreetAddress: true,
              primaryBusinessCity: true,
              primaryBusinessStateProvince: true,
              primaryBusinessPostalCode: true,
              primaryBusinessCountry: true,
              industryType: true,
              primaryContactFullName: true,
              primaryContactEmail: true,
              primaryContactPhone: true,
              businessWebsiteUrl: true,
              taxIdVatNumber: true,
              validatedAddress: true,
              addressValidatedAt: true,
              updatedAt: true,
            },
          },
        },
        take: 50,
        orderBy: { currentPeriodEnd: 'desc' },
      }),
      prisma.membershipSubscription.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.user.findMany({
        where: { role: { not: 'ADMIN' } },
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
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      prisma.membershipPlan.findMany({
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
      prisma.businessMembershipInvoiceRequest.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const totalActive = stats.find(s => s.status === 'ACTIVE')?._count || 0;
    const totalCancelled = stats.find(s => s.status === 'CANCELED')?._count || 0;
    const totalPastDue = stats.find(s => s.status === 'PAST_DUE')?._count || 0;

    return { memberships, totalActive, totalCancelled, totalPastDue, assignableUsers, plans, invoiceRequests };
  } catch (error) {
    console.error('[AdminMemberships] Failed to fetch memberships:', error);
    throw error;
  }
}

type MembershipsData = Awaited<ReturnType<typeof getMembershipsData>>;
type MembershipRow = MembershipsData['memberships'][number];
type AssignableUserRow = MembershipsData['assignableUsers'][number];
type MembershipPlanRow = MembershipsData['plans'][number];
type BusinessInvoiceRequestRow = MembershipsData['invoiceRequests'][number];

async function MembershipsList() {
  let memberships: MembershipRow[] = [];
  let assignableUsers: AssignableUserRow[] = [];
  let plans: MembershipPlanRow[] = [];
  let invoiceRequests: BusinessInvoiceRequestRow[] = [];
  let totalActive = 0;
  let totalCancelled = 0;
  let totalPastDue = 0;
  let error: unknown = null;

  try {
    const data = await getMembershipsData();
    memberships = data.memberships;
    assignableUsers = data.assignableUsers;
    plans = data.plans;
    invoiceRequests = data.invoiceRequests;
    totalActive = data.totalActive;
    totalCancelled = data.totalCancelled;
    totalPastDue = data.totalPastDue;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <MembershipsErrorState error={error} />;
  }

  if (memberships.length === 0) {
    return (
      <EmptyMembershipsState
        totalActive={totalActive}
        totalCancelled={totalCancelled}
        totalPastDue={totalPastDue}
        totalSubscriptions={memberships.length}
        assignableUsers={assignableUsers}
        plans={plans}
        invoiceRequests={invoiceRequests}
      />
    );
  }

  return (
    <MembershipsContent
      memberships={memberships}
      totalActive={totalActive}
      totalCancelled={totalCancelled}
      totalPastDue={totalPastDue}
      assignableUsers={assignableUsers}
      plans={plans}
      invoiceRequests={invoiceRequests}
    />
  );
}

function AssignMembershipCard({
  assignableUsers,
  plans,
}: {
  assignableUsers: AssignableUserRow[];
  plans: MembershipPlanRow[];
}) {
  return (
    <OtwCard className="mt-3 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Assign Membership</h3>
        <p className="mt-1 text-xs text-white/60">
          Select a user, plan, and how many days the membership should stay active.
        </p>
      </div>

      {assignableUsers.length === 0 || plans.length === 0 ? (
        <div className="text-sm text-white/60">
          {assignableUsers.length === 0
            ? 'No eligible users found to assign a membership.'
            : 'No membership plans found. Create plans first.'}
        </div>
      ) : (
        <form action={assignMembershipAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="assign-user" className="text-xs uppercase tracking-wider text-white/60">
              User
            </label>
            <select
              id="assign-user"
              name="userId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="" disabled>
                Select user
              </option>
              {assignableUsers.map((user) => {
                const membershipLabel = user.membership?.plan?.name
                  ? `${user.membership.plan.name} (${user.membership.status})`
                  : 'No membership';
                return (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} - {user.email} - {membershipLabel}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="assign-plan" className="text-xs uppercase tracking-wider text-white/60">
              Plan
            </label>
            <select
              id="assign-plan"
              name="planId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="" disabled>
                Select plan
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="assign-duration" className="text-xs uppercase tracking-wider text-white/60">
              Active Days
            </label>
            <input
              id="assign-duration"
              name="durationDays"
              type="number"
              min={1}
              max={730}
              step={1}
              required
              defaultValue={30}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex items-end">
            <OtwButton type="submit" variant="outline" className="h-[42px] w-full text-xs">
              Assign Membership
            </OtwButton>
          </div>
        </form>
      )}
    </OtwCard>
  );
}

function MembershipSummaryGrid({
  totalActive,
  totalCancelled,
  totalPastDue,
  totalSubscriptions,
  businessMembershipCount,
  businessProfilesOnFile,
  businessProfilesMissing,
  businessProfileCompletionRate,
}: {
  totalActive: number;
  totalCancelled: number;
  totalPastDue: number;
  totalSubscriptions: number;
  businessMembershipCount: number;
  businessProfilesOnFile: number;
  businessProfilesMissing: number;
  businessProfileCompletionRate: number | null;
}) {
  return (
    <OtwCard className="mt-3 p-6">
      <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-green-400">{totalActive}</div>
          <div className="text-xs text-white/60">Active Members</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-red-400">{totalCancelled}</div>
          <div className="text-xs text-white/60">Cancelled</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-yellow-400">{totalPastDue}</div>
          <div className="text-xs text-white/60">Past Due</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-white">{totalSubscriptions}</div>
          <div className="text-xs text-white/60">Total Subscriptions</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-otwGold">{businessMembershipCount}</div>
          <div className="text-xs text-white/60">Business Plans</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-emerald-300">{businessProfilesOnFile}</div>
          <div className="text-xs text-white/60">Profiles On File</div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <div className="text-2xl font-bold text-white">
            {businessProfileCompletionRate === null ? 'N/A' : `${businessProfileCompletionRate}%`}
          </div>
          <div className="text-xs text-white/60">
            Coverage
            {businessProfilesMissing > 0 ? ` • ${businessProfilesMissing} missing` : ''}
          </div>
        </div>
      </div>
    </OtwCard>
  );
}

function BusinessProfileCell({ membership }: { membership: MembershipRow }) {
  const isBusinessMembership = isBusinessMembershipPlanName(membership.plan?.name ?? null);
  const profile = membership.businessProfile;

  if (!isBusinessMembership) {
    return <div className="min-w-[240px] text-xs text-white/35">Not required for this membership plan.</div>;
  }

  if (!profile) {
    return (
      <div className="min-w-[260px] rounded-xl border border-red-500/20 bg-red-500/10 p-3">
        <div className="inline-flex rounded-full border border-red-500/30 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-red-200">
          Required
        </div>
        <div className="mt-2 text-sm font-medium text-white">Business profile missing</div>
        <div className="mt-1 text-xs leading-5 text-red-100/80">
          This business membership is active, but no organizational profile has been submitted yet.
        </div>
      </div>
    );
  }

  const addressSummary = buildBusinessAddressSummary(profile);
  const normalizedWebsite = profile.businessWebsiteUrl?.replace(/^https?:\/\//i, '') ?? null;

  return (
    <div className="min-w-[300px] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200">
          On file
        </span>
        {profile.addressValidatedAt ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
            Address verified
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-sm font-medium text-white">{profile.businessLegalName}</div>
        <div className="mt-1 text-xs text-white/60">
          {formatBusinessIndustryLabel(profile.industryType)} • {profile.employeeCount.toLocaleString()} employees
        </div>
      </div>

      <div className="text-xs leading-5 text-white/60">{addressSummary}</div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Primary Contact</div>
        <div className="mt-2 text-xs text-white/85">{profile.primaryContactFullName}</div>
        <div className="text-xs text-white/60">{profile.primaryContactEmail}</div>
        <div className="text-xs text-white/60">{profile.primaryContactPhone}</div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] leading-5 text-white/45">
        {normalizedWebsite ? <span>Website: {normalizedWebsite}</span> : null}
        {profile.taxIdVatNumber ? <span>Tax ID / VAT: {profile.taxIdVatNumber}</span> : null}
        {!normalizedWebsite && !profile.taxIdVatNumber ? <span>No optional billing details provided.</span> : null}
      </div>

      <div className="text-[11px] text-white/35">Updated {formatDistanceSafe(profile.updatedAt)}</div>
    </div>
  );
}

function InvoiceRequestStatusPill({ status }: { status: BusinessInvoiceRequestRow['status'] }) {
  const tone =
    status === 'PENDING'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : status === 'REVIEWED'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
      : status === 'CONVERTED'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : 'border-red-500/30 bg-red-500/10 text-red-200';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${tone}`}>
      {status}
    </span>
  );
}

function InvoiceWorkflowSummary({ request }: { request: BusinessInvoiceRequestRow }) {
  const planConfig = getBusinessMembershipInvoicePlanConfig(request.planName);

  if (request.invoiceWorkflowType === 'STRIPE') {
    return (
      <div className="min-w-[220px] space-y-1 text-xs text-white/60">
        <div className="font-medium text-emerald-200">Stripe invoice started</div>
        <div>{planConfig.billingLabel}</div>
        {request.stripeInvoiceId ? (
          <div className="font-mono text-[11px] text-white/45">{request.stripeInvoiceId}</div>
        ) : null}
        <div>Started {formatDistanceSafe(request.invoiceStartedAt)}</div>
      </div>
    );
  }

  if (request.invoiceWorkflowType === 'MANUAL') {
    return (
      <div className="min-w-[220px] space-y-1 text-xs text-white/60">
        <div className="font-medium text-otwGold">Manual invoice workflow</div>
        <div>{planConfig.billingLabel}</div>
        <div>Started {formatDistanceSafe(request.invoiceStartedAt)}</div>
        <div className="text-white/45">Invoice delivery and payment collection are being handled offline.</div>
      </div>
    );
  }

  return (
    <div className="min-w-[220px] space-y-1 text-xs text-white/60">
      <div className="font-medium text-white">Not started</div>
      <div>{planConfig.billingLabel}</div>
      <div className="text-white/45">
        {planConfig.supportsStripeInvoice
          ? 'Stripe-sendable invoice available, or start a manual invoice workflow.'
          : 'Custom pricing. Start the manual invoice workflow after review.'}
      </div>
    </div>
  );
}

function InvoiceRequestActionsCell({ request }: { request: BusinessInvoiceRequestRow }) {
  const planConfig = getBusinessMembershipInvoicePlanConfig(request.planName);
  const canAccept = request.status === 'PENDING';
  const canDecline = request.status === 'PENDING' || request.status === 'REVIEWED';
  const canStartWorkflow =
    request.status !== 'CLOSED' && !request.invoiceStartedAt && !request.stripeInvoiceId && !request.invoiceWorkflowType;

  return (
    <div className="min-w-[260px] space-y-3">
      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <form action={reviewBusinessInvoiceRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <OtwButton type="submit" variant="outline" size="sm" className="h-auto">
              Accept
            </OtwButton>
          </form>
        ) : null}

        {canStartWorkflow && planConfig.supportsStripeInvoice ? (
          <form action={startStripeBusinessInvoiceRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <OtwButton type="submit" variant="gold" size="sm" className="h-auto">
              Start Stripe Invoice
            </OtwButton>
          </form>
        ) : null}

        {canStartWorkflow ? (
          <form action={startManualBusinessInvoiceRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <OtwButton type="submit" variant="ghost" size="sm" className="h-auto bg-white/10 hover:bg-white/15">
              Start Manual Invoice
            </OtwButton>
          </form>
        ) : null}

        {canDecline ? (
          <form action={declineBusinessInvoiceRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <OtwButton type="submit" variant="red" size="sm" className="h-auto">
              Decline
            </OtwButton>
          </form>
        ) : null}
      </div>

      {request.status === 'REVIEWED' && canStartWorkflow ? (
        <div className="text-[11px] leading-5 text-emerald-200/80">
          Accepted and ready for billing. After payment clears, use the Assign Membership card above to activate service.
        </div>
      ) : null}

      {request.status === 'PENDING' && canStartWorkflow ? (
        <div className="text-[11px] leading-5 text-white/45">
          Review before billing when possible. Starting an invoice also converts the request into an active billing workflow.
        </div>
      ) : null}

      {!canStartWorkflow && request.status === 'CONVERTED' ? (
        <div className="text-[11px] leading-5 text-white/45">
          Billing workflow already started. Activate the membership only after payment is confirmed.
        </div>
      ) : null}
    </div>
  );
}

function InvoiceRequestsCard({ invoiceRequests }: { invoiceRequests: BusinessInvoiceRequestRow[] }) {
  const pendingCount = invoiceRequests.filter((request) => request.status === 'PENDING').length;

  return (
    <OtwCard className="mt-3 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Business Invoice Requests</h3>
          <p className="mt-1 text-xs text-white/60">
            Submitted directly from the business-plan selection popup before membership activation.
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Accept or decline requests here, then start either a Stripe-sent invoice or a manual billing workflow.
          </p>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2 text-right">
          <div className="text-sm font-semibold text-white">{invoiceRequests.length}</div>
          <div className="text-[11px] text-white/55">
            {pendingCount} pending
          </div>
        </div>
      </div>

      {invoiceRequests.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No business invoice requests have been submitted yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 opacity-60">
              <tr>
                <th className="px-4 py-3 text-left">Requested</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Business</th>
                <th className="px-4 py-3 text-left">Primary Contact</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRequests.map((request) => {
                const normalizedWebsite = request.businessWebsiteUrl?.replace(/^https?:\/\//i, '') ?? null;
                const addressSummary = buildBusinessAddressSummary(request);

                return (
                  <tr key={request.id} className="border-b border-white/5 align-top hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-xs text-white/60">
                      {formatDistanceSafe(request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{request.planName}</div>
                      {request.user ? (
                        <div className="mt-1 text-xs text-white/45">
                          Submitted by {request.user.name || request.user.email}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-white/35">Guest submission</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{request.businessLegalName}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {formatBusinessIndustryLabel(request.industryType)} • {request.employeeCount.toLocaleString()} employees
                      </div>
                      <div className="mt-1 text-[11px] text-white/45">
                        {normalizedWebsite ? `Website: ${normalizedWebsite}` : 'Website not provided'}
                        {request.taxIdVatNumber ? ` • Tax ID/VAT: ${request.taxIdVatNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{request.primaryContactFullName}</div>
                      <div className="mt-1 text-xs text-white/60">{request.primaryContactEmail}</div>
                      <div className="text-xs text-white/60">{request.primaryContactPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[280px] text-xs leading-5 text-white/60">{addressSummary}</div>
                      {request.validatedAddress ? (
                        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                          Address verified
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceRequestStatusPill status={request.status} />
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceWorkflowSummary request={request} />
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceRequestActionsCell request={request} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </OtwCard>
  );
}

function EmptyMembershipsState({
  totalActive,
  totalCancelled,
  totalPastDue,
  totalSubscriptions,
  assignableUsers,
  plans,
  invoiceRequests,
}: {
  totalActive: number;
  totalCancelled: number;
  totalPastDue: number;
  totalSubscriptions: number;
  assignableUsers: AssignableUserRow[];
  plans: MembershipPlanRow[];
  invoiceRequests: BusinessInvoiceRequestRow[];
}) {
  return (
    <>
      <AssignMembershipCard assignableUsers={assignableUsers} plans={plans} />
      <InvoiceRequestsCard invoiceRequests={invoiceRequests} />

      <MembershipSummaryGrid
        totalActive={totalActive}
        totalCancelled={totalCancelled}
        totalPastDue={totalPastDue}
        totalSubscriptions={totalSubscriptions}
        businessMembershipCount={0}
        businessProfilesOnFile={0}
        businessProfilesMissing={0}
        businessProfileCompletionRate={null}
      />
      
      <OtwCard className="mt-3 p-8 text-center">
        <OtwEmptyState 
          title="No membership subscriptions found" 
          subtitle="Membership subscriptions will appear here when users subscribe to plans." 
        />
      </OtwCard>
    </>
  );
}

function MembershipsContent({
  memberships,
  totalActive,
  totalCancelled,
  totalPastDue,
  assignableUsers,
  plans,
  invoiceRequests,
}: {
  memberships: MembershipRow[];
  totalActive: number;
  totalCancelled: number;
  totalPastDue: number;
  assignableUsers: AssignableUserRow[];
  plans: MembershipPlanRow[];
  invoiceRequests: BusinessInvoiceRequestRow[];
}) {
  const businessMetrics = getBusinessProfileMetrics(memberships);

  return (
    <>
      <AssignMembershipCard assignableUsers={assignableUsers} plans={plans} />
      <InvoiceRequestsCard invoiceRequests={invoiceRequests} />

      <MembershipSummaryGrid
        totalActive={totalActive}
        totalCancelled={totalCancelled}
        totalPastDue={totalPastDue}
        totalSubscriptions={memberships.length}
        businessMembershipCount={businessMetrics.businessMembershipCount}
        businessProfilesOnFile={businessMetrics.businessProfilesOnFile}
        businessProfilesMissing={businessMetrics.businessProfilesMissing}
        businessProfileCompletionRate={businessMetrics.businessProfileCompletionRate}
      />

      <OtwCard className="mt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Business Profile</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Period End</th>
                <th className="text-left px-4 py-3">Renews</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{membership.user.name || 'Unknown Member'}</div>
                      <div className="text-xs text-white/50">{membership.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{membership.plan?.name ?? 'No plan'}</div>
                      {membership.plan?.description ? (
                        <div className="text-xs text-white/50">{membership.plan.description}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <BusinessProfileCell membership={membership} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      membership.status === 'ACTIVE' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : membership.status === 'CANCELED'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : membership.status === 'PAST_DUE'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {membership.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceSafe(membership.currentPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceSafe(membership.renewsAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <OtwButton variant="ghost" className="text-xs px-2 py-1 h-auto bg-white/10 hover:bg-white/20">
                        View
                      </OtwButton>
                      <OtwButton variant="ghost" className="text-xs px-2 py-1 h-auto bg-otwGold/20 hover:bg-otwGold/30 text-otwGold">
                        Manage
                      </OtwButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OtwCard>
    </>
  );
}

function MembershipsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load memberships</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <OtwButton 
        as="a"
        href="/admin/memberships"
        variant="ghost"
        className="mt-4 text-xs px-3 py-2 h-auto bg-white/10 hover:bg-white/20"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export default async function AdminMembershipsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  await requireRole(['ADMIN']);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assignError = readSearchParam(resolvedSearchParams?.assignError);
  const assignSuccess = readSearchParam(resolvedSearchParams?.assignSuccess);
  const invoiceError = readSearchParam(resolvedSearchParams?.invoiceError);
  const invoiceSuccess = readSearchParam(resolvedSearchParams?.invoiceSuccess);
  
  return (
    <OtwPageShell>
      <QueryPopupAlert message={assignError} clearParam="assignError" />
      <QueryPopupAlert message={assignSuccess} clearParam="assignSuccess" />
      <QueryPopupAlert message={invoiceError} clearParam="invoiceError" />
      <QueryPopupAlert message={invoiceSuccess} clearParam="invoiceSuccess" />
      <OtwSectionHeader 
        title="Membership Management" 
        subtitle="Monitor subscription plans, member activity, and billing status." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminMembershipsLoading />}>
          <MembershipsList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
