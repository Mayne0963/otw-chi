import { redirect } from 'next/navigation';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import DeliveryFeePaymentPanel from '@/components/stripe/DeliveryFeePaymentPanel';
import { formatCurrency } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { shouldRequireDeliveryFeePayment } from '@/lib/delivery-payment';

export const dynamic = 'force-dynamic';

export default async function DeliveryFeePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/pay/${id}`)}`);
  }

  const prisma = getPrisma();
  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      deliveryFeeCents: true,
      deliveryFeePaid: true,
      overageBillingMode: true,
    },
  });

  if (!request) {
    redirect('/requests');
  }

  const isOwner = request.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    redirect('/requests');
  }

  const amountCents = Number.isFinite(request.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(request.deliveryFeeCents)))
    : 0;

  if (amountCents <= 0 || request.deliveryFeePaid) {
    redirect(`/requests/${request.id}`);
  }

  const requiresPayment = shouldRequireDeliveryFeePayment({
    deliveryFeeCents: request.deliveryFeeCents,
    deliveryFeePaid: request.deliveryFeePaid,
    billingMode: request.overageBillingMode,
  });

  if (!requiresPayment) {
    redirect(`/requests/${request.id}`);
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Complete Payment"
        subtitle={`Pay ${formatCurrency(amountCents)} to unlock dispatch for request ${request.id.slice(-6).toUpperCase()}.`}
      />

      <div className="mx-auto mt-6 w-full max-w-2xl">
        <OtwCard className="p-6">
          <DeliveryFeePaymentPanel deliveryRequestId={request.id} amountCents={amountCents} />
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
