import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ServiceMilesTransactionType } from '@prisma/client';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<ServiceMilesTransactionType, string> = {
  ADD_MONTHLY: 'Monthly Credit',
  DEDUCT_REQUEST: 'Request Deduction',
  ADJUST: 'Adjustment',
  EXPIRE: 'Expired Credit',
  ROLL_IN: 'Carried Forward',
};

function formatTransactionType(type: ServiceMilesTransactionType) {
  return TYPE_LABELS[type] ?? type;
}

function typeBadgeClass(type: ServiceMilesTransactionType) {
  if (type === ServiceMilesTransactionType.ADD_MONTHLY) {
    return 'bg-green-500/20 text-green-400 border border-green-500/30';
  }
  if (type === ServiceMilesTransactionType.DEDUCT_REQUEST) {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  }
  if (type === ServiceMilesTransactionType.EXPIRE) {
    return 'bg-red-500/20 text-red-400 border border-red-500/30';
  }
  if (type === ServiceMilesTransactionType.ROLL_IN) {
    return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
  }
  return 'bg-white/10 text-white/80 border border-white/20';
}

export default async function ServiceMilesHistoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader
          title="Membership Balance History"
          subtitle="Review your account activity."
        />
        <OtwCard className="mt-3">
          <OtwEmptyState
            title="Sign in to view membership balance history"
            subtitle="Track monthly credits, deductions, and adjustments."
            actionHref="/sign-in"
            actionLabel="Sign In"
          />
        </OtwCard>
      </OtwPageShell>
    );
  }

  const prisma = getPrisma();
  const wallet = await prisma.serviceMilesWallet.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      ledgerEntries: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          transactionType: true,
          description: true,
          createdAt: true,
          deliveryRequestId: true,
          deliveryRequest: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const entries = wallet?.ledgerEntries ?? [];
  return (
    <OtwPageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <OtwSectionHeader
          title="Membership Balance History"
          subtitle="Review your latest account activity. Showing up to 100 most recent entries."
        />
        <OtwButton href="/service-miles" variant="outline" size="sm">
          Back To Member Request
        </OtwButton>
      </div>

      <OtwCard className="mt-6">
        {entries.length === 0 ? (
          <OtwEmptyState
            title="No membership balance history yet"
            subtitle="Your monthly credits and request deductions will appear here."
            actionHref="/order"
            actionLabel="Create Request"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 text-left opacity-70">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Request</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 align-top">
                    <td className="px-4 py-3 text-xs text-white/60">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${typeBadgeClass(
                          entry.transactionType
                        )}`}
                      >
                        {formatTransactionType(entry.transactionType)}
                      </span>
                    </td>
                    <td className="max-w-xl px-4 py-3 text-white/80">
                      {entry.description || 'No description'}
                    </td>
                    <td className="px-4 py-3">
                      {entry.deliveryRequestId ? (
                        <Link
                          href={`/requests/${entry.deliveryRequestId}`}
                          className="inline-flex text-xs text-otwGold hover:text-otwGold/80"
                        >
                          {entry.deliveryRequest?.status
                            ? `View (${entry.deliveryRequest.status.replaceAll('_', ' ')})`
                            : 'View Request'}
                        </Link>
                      ) : (
                        <span className="text-xs text-white/40">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
