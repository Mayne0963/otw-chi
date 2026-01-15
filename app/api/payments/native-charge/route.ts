import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getPrisma } from "@/lib/db";

const chargeSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(10).optional(),
  discountCents: z.number().int().nonnegative().optional(),
  cardBrand: z.string().min(2),
  cardLast4: z.string().regex(/^[0-9]{4}$/),
  cardholderName: z.string().min(2).max(120).optional(),
  reference: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const prisma = getPrisma();
  const anyPrisma = prisma as any;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = chargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const amountCents = parsed.data.amountCents;
    if (amountCents < 50) {
      return NextResponse.json({ success: false, error: "Amount must be at least $0.50" }, { status: 400 });
    }

    const currency = parsed.data.currency ?? "usd";
    const paymentMethodDisplay = `${parsed.data.cardBrand} •••• ${parsed.data.cardLast4}`;

    const tx = await anyPrisma.paymentTransaction.create({
      data: {
        userId: user.id,
        amountCents,
        currency,
        status: "AUTHORIZED",
        provider: "NATIVE",
        paymentMethodDisplay,
      },
    });

    return NextResponse.json({ success: true, paymentId: tx.id });
  } catch (error) {
    try {
      const { userId } = await auth();
      if (userId) {
        const prisma = getPrisma();
        const anyPrisma = prisma as any;
        await anyPrisma.paymentTransaction.create({
          data: {
            userId,
            amountCents: 0,
            currency: "usd",
            status: "FAILED",
            provider: "NATIVE",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    } catch (_) {}

    return NextResponse.json({ success: false, error: "Payment processing failed" }, { status: 500 });
  }
}
