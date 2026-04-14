import { redirect } from 'next/navigation';
import Link from 'next/link';
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

function resolveDeliveryFeeMilesRequired(params: {
  serviceMilesFinal: number | null;
  deliveryFeeCents: number | null;
  overageRateCentsPerMile: number | null;
}) {
  const milesFromQuote = Number.isFinite(params.serviceMilesFinal)
    ? Math.max(0, Math.round(Number(params.serviceMilesFinal)))
    : 0;
  if (milesFromQuote > 0) {
    return milesFromQuote;
  }

  const deliveryFeeCents = Number.isFinite(params.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(params.deliveryFeeCents)))
    : 0;
  const rateCentsPerMile = Number.isFinite(params.overageRateCentsPerMile)
    ? Math.max(1, Math.round(Number(params.overageRateCentsPerMile)))
    : 0;

  if (deliveryFeeCents <= 0 || rateCentsPerMile <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(deliveryFeeCents / rateCentsPerMile));
}

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
      serviceMilesFinal: true,
      user: {
        select: {
          membership: {
            select: {
              plan: {
                select: {
                  overageRateCentsPerMile: true,
                },
              },
            },
          },
        },
      },
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
  const hasOutstandingDeliveryFee = deliveryAmountCents > 0 && request.deliveryFeePaid !== true;

  const requiresDeliveryPayment =
    hasOutstandingDeliveryFee &&
    (request.paymentRequired ||
      shouldRequireDeliveryFeePayment({
        deliveryFeeCents: request.deliveryFeeCents,
        deliveryFeePaid: request.deliveryFeePaid,
        billingMode: request.overageBillingMode,
      }));

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
    redirect(`/request/${request.id}`);
  }

  const amountCents = requiresDeliveryPayment ? deliveryAmountCents : overageAmountCents;
  const chargeLabel = requiresDeliveryPayment ? 'Delivery Fee' : 'Overage Balance';
  const deliveryFeeMilesRequired = resolveDeliveryFeeMilesRequired({
    serviceMilesFinal: request.serviceMilesFinal,
    deliveryFeeCents: request.deliveryFeeCents,
    overageRateCentsPerMile: request.user.membership?.plan?.overageRateCentsPerMile ?? null,
  });

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Complete Payment"
        subtitle="Secure checkout powered by Stripe."
      />

      <div className="mx-auto mt-6 w-full max-w-2xl">
        <OtwCard className="p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Complete Payment</h2>
              <p className="text-sm text-white/80">
                You’re confirming this delivery so your driver can be dispatched.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-otwGold">What you’re paying for</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                <li>Driver dispatch and route execution for this request</li>
                <li>Live tracking, coordination, and delivery support</li>
                <li>
                  {requiresDeliveryPayment
                    ? 'Delivery fee settlement required before assignment'
                    : 'Overage settlement required before assignment'}
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-otwGold">No hidden markups</h3>
              <p className="mt-2 text-sm text-white/80">
                OTW charges only the service total shown below. We do not add hidden markups to your
                restaurant or store items.
              </p>
            </div>

            <div className="rounded-lg border border-otwGold/40 bg-otwGold/10 p-4">
              <h3 className="text-sm font-semibold text-otwGold">Price Breakdown</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">{chargeLabel}</span>
                  <span className="font-medium text-white">{formatCurrency(amountCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Hidden markups</span>
                  <span className="font-medium text-white">{formatCurrency(0)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-otwGold/30 pt-3">
                <span className="text-sm font-semibold uppercase tracking-wide text-white/80">Total</span>
                <span className="text-2xl font-bold text-otwGold">{formatCurrency(amountCents)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
              <h3 className="text-sm font-semibold text-amber-200">Pickup &amp; Delivery Only</h3>
              <p className="mt-2 text-sm text-amber-100/90">
                Please order and prepay directly with the restaurant or store first. OTW handles pickup
                and delivery only.
              </p>
            </div>

            <p className="text-xs text-white/65">
              Secure checkout powered by Stripe. Your payment details are encrypted and never stored on
              OTW servers.
            </p>

            <div>
              <Link
                href={`/request/${request.id}`}
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition-all duration-300 hover:border-white/40 hover:text-white"
              >
                Back to Request
              </Link>
            </div>

            {requiresDeliveryPayment ? (
              <div className="space-y-4">
                {deliveryFeeMilesRequired > 0 ? (
                  <div className="rounded-lg border border-otwGold/30 bg-otwGold/10 p-4">
                    <p className="text-sm text-white/85">
                      You can settle this delivery fee with your membership balance instead of card payment.
                    </p>
                    <div className="mt-3">
                      <PayWithServiceMilesButton
                        deliveryRequestId={request.id}
                        requiredMiles={deliveryFeeMilesRequired}
                      />
                    </div>
                  </div>
                ) : null}
                <DeliveryFeePaymentPanel deliveryRequestId={request.id} amountCents={amountCents} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-otwGold/30 bg-otwGold/10 p-4">
                  <p className="text-sm text-white/85">
                    You can settle this balance with your membership balance instead of card payment.
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
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
