import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import DisputeResolutionTable from '@/components/admin/DisputeResolutionTable';

const statusOptions = ['OPEN', 'NEEDS_INFO', 'RESOLVED_APPROVED', 'RESOLVED_DENIED'] as const;

export const dynamic = 'force-dynamic';

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireRole(['ADMIN']);
  const resolvedSearchParams = await searchParams;
  const selectedStatusParam = resolvedSearchParams?.status?.toUpperCase();
  const selectedStatus = statusOptions.find((status) => status === selectedStatusParam);
  const prisma = getPrisma();

  const disputes = await prisma.orderConfirmation.findMany({
    where: {
      disputeStatus: selectedStatus ? selectedStatus : { in: [...statusOptions] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      receiptVerification: {
        select: {
          id: true,
          status: true,
          riskScore: true,
          totalAmount: true,
        },
      },
    },
    take: 200,
  });

  const rows = disputes.map((dispute) => ({
    id: dispute.id,
    deliveryRequestId: dispute.deliveryRequestId,
    createdAt: dispute.createdAt.toISOString(),
    customerConfirmed: dispute.customerConfirmed,
    confirmedAt: dispute.confirmedAt?.toISOString() ?? null,
    disputeStatus: dispute.disputeStatus,
    disputeNotes: dispute.disputeNotes,
    evidenceUrls: dispute.evidenceUrls,
    disputedItems: Array.isArray(dispute.disputedItems)
      ? (dispute.disputedItems as Array<{ itemKey?: string; name?: string; qtyDisputed?: number; reason?: string; details?: string }>)
      : [],
    resolutionNotes: dispute.resolutionNotes,
    refundAmount: dispute.refundAmount ? dispute.refundAmount.toFixed(2) : null,
    receiptVerification: dispute.receiptVerification
      ? {
          id: dispute.receiptVerification.id,
          status: dispute.receiptVerification.status,
          riskScore: dispute.receiptVerification.riskScore,
          totalAmount: dispute.receiptVerification.totalAmount
            ? dispute.receiptVerification.totalAmount.toFixed(2)
            : null,
        }
      : null,
  }));

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Dispute Review"
        subtitle="Review item-specific disputes, linked receipt proof, and resolve outcomes."
      />

      <OtwCard className="mt-4">
        <div className="flex flex-wrap gap-2">
          <OtwButton as="a" href="/admin/disputes" variant={!selectedStatus ? 'gold' : 'outline'} size="sm">
            All
          </OtwButton>
          {statusOptions.map((status) => (
            <OtwButton
              key={status}
              as="a"
              href={`/admin/disputes?status=${status}`}
              variant={selectedStatus === status ? 'gold' : 'outline'}
              size="sm"
            >
              {status}
            </OtwButton>
          ))}
        </div>
      </OtwCard>

      <OtwCard className="mt-4">
        <DisputeResolutionTable disputes={rows} />
      </OtwCard>
    </OtwPageShell>
  );
}
