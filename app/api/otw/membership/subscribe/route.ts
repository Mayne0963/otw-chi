import { NextRequest, NextResponse } from "next/server";
import {
  changeCustomerTier,
  createMembershipForCustomerAdmin,
  getMembershipForCustomer,
} from "../../../../../lib/otw/otwMembership";
import { OtwTierId } from "../../../../../lib/otw/otwTypes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tierId } = body || {};
    const customerId = "CUSTOMER-1";

    if (!tierId) {
      return NextResponse.json(
        { success: false, error: "tierId is required." },
        { status: 400 }
      );
    }

    let membership = getMembershipForCustomer(customerId);

    if (!membership) {
      membership = createMembershipForCustomerAdmin(customerId, tierId as OtwTierId);
    } else {
      membership = changeCustomerTier(customerId, tierId as OtwTierId);
    }

    return NextResponse.json({ success: true, membership }, { status: 200 });
  } catch (err) {
    console.error("OTW membership subscribe error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to subscribe to membership." },
      { status: 500 }
    );
  }
}

