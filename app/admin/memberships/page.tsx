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

async function getMembershipsData() {
  const prisma = getPrisma();
  
  try {
    const [memberships, stats, assignableUsers, plans] = await Promise.all([
      prisma.membershipSubscription.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, name: true, description: true } },
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
    ]);

    const totalActive = stats.find(s => s.status === 'ACTIVE')?._count || 0;
    const totalCancelled = stats.find(s => s.status === 'CANCELED')?._count || 0;
    const totalPastDue = stats.find(s => s.status === 'PAST_DUE')?._count || 0;

    return { memberships, totalActive, totalCancelled, totalPastDue, assignableUsers, plans };
  } catch (error) {
    console.error('[AdminMemberships] Failed to fetch memberships:', error);
    throw error;
  }
}

type MembershipsData = Awaited<ReturnType<typeof getMembershipsData>>;
type MembershipRow = MembershipsData['memberships'][number];
type AssignableUserRow = MembershipsData['assignableUsers'][number];
type MembershipPlanRow = MembershipsData['plans'][number];

async function MembershipsList() {
  let memberships: MembershipRow[] = [];
  let assignableUsers: AssignableUserRow[] = [];
  let plans: MembershipPlanRow[] = [];
  let totalActive = 0;
  let totalCancelled = 0;
  let totalPastDue = 0;
  let error: unknown = null;

  try {
    const data = await getMembershipsData();
    memberships = data.memberships;
    assignableUsers = data.assignableUsers;
    plans = data.plans;
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

function EmptyMembershipsState({
  totalActive,
  totalCancelled,
  totalPastDue,
  totalSubscriptions,
  assignableUsers,
  plans,
}: {
  totalActive: number;
  totalCancelled: number;
  totalPastDue: number;
  totalSubscriptions: number;
  assignableUsers: AssignableUserRow[];
  plans: MembershipPlanRow[];
}) {
  return (
    <>
      <AssignMembershipCard assignableUsers={assignableUsers} plans={plans} />

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalActive}</div>
            <div className="text-xs text-white/60">Active Members</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{totalCancelled}</div>
            <div className="text-xs text-white/60">Cancelled</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{totalPastDue}</div>
            <div className="text-xs text-white/60">Past Due</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalSubscriptions}</div>
            <div className="text-xs text-white/60">Total Subscriptions</div>
          </div>
        </div>
      </OtwCard>
      
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
}: {
  memberships: MembershipRow[];
  totalActive: number;
  totalCancelled: number;
  totalPastDue: number;
  assignableUsers: AssignableUserRow[];
  plans: MembershipPlanRow[];
}) {
  return (
    <>
      <AssignMembershipCard assignableUsers={assignableUsers} plans={plans} />

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalActive}</div>
            <div className="text-xs text-white/60">Active Members</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{totalCancelled}</div>
            <div className="text-xs text-white/60">Cancelled</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{totalPastDue}</div>
            <div className="text-xs text-white/60">Past Due</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{memberships.length}</div>
            <div className="text-xs text-white/60">Total Subscriptions</div>
          </div>
        </div>
      </OtwCard>

      <OtwCard className="mt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Plan</th>
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
  
  return (
    <OtwPageShell>
      <QueryPopupAlert message={assignError} clearParam="assignError" />
      <QueryPopupAlert message={assignSuccess} clearParam="assignSuccess" />
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
