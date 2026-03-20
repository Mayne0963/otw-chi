import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import DisputeResolutionTable from '@/components/admin/DisputeResolutionTable';
import { getSignedUrlForObjectRef } from '@/lib/storage';

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
    take: 200,
  });

  const rows = await Promise.all(
    disputes.map(async (dispute) => {
      const evidenceUrls = await Promise.all(
        dispute.evidenceUrls.map(async (value) => {
          if (!value.startsWith('s3://')) return value;
          return (await getSignedUrlForObjectRef(value, 900)) ?? value;
        })
      );

      return {
        id: dispute.id,
        deliveryRequestId: dispute.deliveryRequestId,
        createdAt: dispute.createdAt.toISOString(),
        customerConfirmed: dispute.customerConfirmed,
        confirmedAt: dispute.confirmedAt?.toISOString() ?? null,
        disputeStatus: dispute.disputeStatus,
        disputeNotes: dispute.disputeNotes,
        evidenceUrls,
        disputedItems: Array.isArray(dispute.disputedItems)
          ? (dispute.disputedItems as Array<{ itemKey?: string; name?: string; qtyDisputed?: number; reason?: string; details?: string }>)
          : [],
        resolutionNotes: dispute.resolutionNotes,
        refundAmount: dispute.refundAmount ? dispute.refundAmount.toFixed(2) : null,
      };
    })
  );

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Dispute Review"
        subtitle="Review customer disputes and resolve outcomes."
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
