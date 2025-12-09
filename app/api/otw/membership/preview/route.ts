import { NextRequest, NextResponse } from "next/server";
import { getTierById } from "../../../../../lib/otw/otwMembership";
import { OtwTierId } from "../../../../../lib/otw/otwTypes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tierId } = body || {};

    if (!tierId) {
      return NextResponse.json(
        { success: false, error: "tierId is required." },
        { status: 400 }
      );
    }

    const tier = getTierById(tierId as OtwTierId);
    if (!tier) {
      return NextResponse.json(
        { success: false, error: "Invalid OTW tier." },
        { status: 400 }
      );
    }

    const fakePaymentIntentId = `pi_mock_${tier.id}_${Date.now()}`;

    return NextResponse.json(
      {
        success: true,
        tier: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          monthlyPriceCents: tier.monthlyPriceCents,
          includedMiles: tier.includedMiles,
          perks: tier.perks,
        },
        paymentIntent: {
          id: fakePaymentIntentId,
          clientSecret: `cs_mock_${fakePaymentIntentId}`,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("OTW membership preview error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to preview membership." },
      { status: 500 }
    );
  }
}

