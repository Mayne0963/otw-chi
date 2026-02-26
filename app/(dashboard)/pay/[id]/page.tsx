import { redirect } from 'next/navigation';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import DeliveryFeePaymentPanel from '@/components/stripe/DeliveryFeePaymentPanel';
import OveragePaymentPanel from '@/components/stripe/OveragePaymentPanel';
import PayWithServiceMilesButton from '@/components/stripe/PayWithServiceMilesButton';
import { formatCurrency } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { shouldRequireDeliveryFeePayment } from '@/lib/delivery-payment';
import { OverageBillingMode, OverageStatus } from '@prisma/client';

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
      overageStatus: true,
      overageMiles: true,
      overageCents: true,
      paymentRequired: true,
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

  const deliveryAmountCents = Number.isFinite(request.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(request.deliveryFeeCents)))
    : 0;

  const requiresDeliveryPayment = shouldRequireDeliveryFeePayment({
    deliveryFeeCents: request.deliveryFeeCents,
    deliveryFeePaid: request.deliveryFeePaid,
    billingMode: request.overageBillingMode,
  });

  const overageAmountCents = Number.isFinite(request.overageCents)
    ? Math.max(0, Math.round(Number(request.overageCents)))
    : 0;

  const requiresOveragePayment =
    request.paymentRequired &&
    request.overageBillingMode === OverageBillingMode.INSTANT &&
    request.overageStatus !== OverageStatus.PAID &&
    request.overageMiles > 0 &&
    overageAmountCents > 0;

  if (!requiresDeliveryPayment && !requiresOveragePayment) {
    redirect(`/requests/${request.id}`);
  }

  const amountCents = requiresDeliveryPayment ? deliveryAmountCents : overageAmountCents;

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Complete Payment"
        subtitle={`Pay ${formatCurrency(amountCents)} to unlock dispatch for request ${request.id.slice(-6).toUpperCase()}.`}
      />

      <div className="mx-auto mt-6 w-full max-w-2xl">
        <OtwCard className="p-6">
          {requiresDeliveryPayment ? (
            <DeliveryFeePaymentPanel deliveryRequestId={request.id} amountCents={amountCents} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-otwGold/30 bg-otwGold/10 p-4">
                <p className="text-sm text-white/85">
                  You can settle this overage with Service Miles instead of card payment.
                </p>
                <div className="mt-3">
                  <PayWithServiceMilesButton
                    deliveryRequestId={request.id}
                    requiredMiles={request.overageMiles}
                  />
                </div>
              </div>
              <OveragePaymentPanel deliveryRequestId={request.id} amountCents={amountCents} />
            </div>
          )}
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
