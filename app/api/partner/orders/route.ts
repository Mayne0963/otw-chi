import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { isAuthorizedPartnerRequest, findOrCreatePartnerCustomer } from '@/lib/partner-auth';

export const runtime = 'nodejs';

const partnerOrderSchema = z.object({
  restaurant_id: z.string().min(1),
  order_id: z.string().min(1),
  customer: z.object({
    name: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    email: z.string().email(),
  }),
  delivery_address: z.object({
    street: z.string().min(1),
    apartment: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip_code: z.string().min(1),
    instructions: z.string().optional(),
  }),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        special_instructions: z.string().optional(),
      }),
    )
    .default([]),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    delivery_fee: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  estimated_prep_time: z.number().int().nonnegative().optional().default(25),
  special_instructions: z.string().optional(),
  payment_method: z.string().optional(),
  // Optional customer-chosen scheduled delivery date (YYYY-MM-DD) for orders
  // that deliver on a future day rather than ASAP.
  scheduled_delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const toCents = (dollars: number) => Math.max(0, Math.round(dollars * 100));

function trackingUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://ontheeway.com').replace(/\/$/, '');
  return `${base}/requests/${id}`;
}

export async function POST(req: Request) {
  if (!isAuthorizedPartnerRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = partnerOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid order payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const order = parsed.data;
  const prisma = getPrisma();

  try {
    const customer = await findOrCreatePartnerCustomer(prisma, {
      email: order.customer.email,
      name: order.customer.name,
    });

    // Idempotency: a retry with the same partner order id returns the existing request.
    const existing = await prisma.deliveryRequest.findFirst({
      where: { userId: customer.id, idempotencyKey: order.order_id },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          otw_order_id: existing.id,
          estimated_delivery_time: existing.scheduledFor?.toISOString(),
          tracking_url: trackingUrl(existing.id),
        },
        { status: 200 },
      );
    }

    const addr = order.delivery_address;
    const dropoffAddress = [
      [addr.street, addr.apartment].filter(Boolean).join(' '),
      addr.city,
      `${addr.state} ${addr.zip_code}`,
    ].join(', ');

    const pickupAddress =
      process.env.OTW_PARTNER_PICKUP_ADDRESS || "Broski's Kitchen, Fort Wayne, IN";

    const notes = [order.special_instructions, addr.instructions]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(' — ') || undefined;

    // Fulfillment time: a customer-chosen scheduled delivery day (noon local) when
    // provided, otherwise ASAP (prep time plus a delivery buffer).
    let scheduledFor: Date;
    let isScheduled = false;
    if (order.scheduled_delivery_date) {
      scheduledFor = new Date(`${order.scheduled_delivery_date}T12:00:00`);
      isScheduled = true;
    } else {
      const etaMinutes = order.estimated_prep_time + 30;
      scheduledFor = new Date(Date.now() + etaMinutes * 60_000);
    }

    const created = await prisma.deliveryRequest.create({
      data: {
        userId: customer.id,
        serviceType: 'FOOD',
        status: 'REQUESTED',
        pickupAddress,
        dropoffAddress,
        notes,
        restaurantName: "Broski's Kitchen",
        restaurantWebsite: 'https://broskiskitchen.com',
        receiptItems: order.items,
        receiptSubtotalCents: toCents(order.totals.subtotal),
        deliveryFeeCents: toCents(order.totals.delivery_fee),
        deliveryFeePaid: true, // Broski's collects payment; OTW runs the last mile.
        idempotencyKey: order.order_id,
        estimatedMinutes: order.estimated_prep_time,
        scheduledFor,
        isScheduled,
      },
    });

    return NextResponse.json(
      {
        success: true,
        otw_order_id: created.id,
        estimated_delivery_time: scheduledFor.toISOString(),
        tracking_url: trackingUrl(created.id),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[partner/orders] Failed to create delivery request:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
