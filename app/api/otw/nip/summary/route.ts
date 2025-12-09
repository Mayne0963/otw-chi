import { NextRequest, NextResponse } from "next/server";
import {
  getWalletForCustomer,
  getWalletForDriver,
  listNipLedgerForCustomer,
  listNipLedgerForDriver,
} from "@/lib/otw/otwNip";
import { OtwCustomerId, OtwDriverId } from "@/lib/otw/otwIds";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const driverId = searchParams.get("driverId");

    if (!customerId && !driverId) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide either customerId or driverId to view NIP summary.",
        },
        { status: 400 }
      );
    }

    if (customerId) {
      const wallet = getWalletForCustomer(customerId as OtwCustomerId);
      const ledger = listNipLedgerForCustomer(customerId as OtwCustomerId);
      return NextResponse.json(
        {
          success: true,
          mode: "customer",
          customerId,
          wallet,
          ledger,
        },
        { status: 200 }
      );
    }

    if (driverId) {
      const wallet = getWalletForDriver(driverId as OtwDriverId);
      const ledger = listNipLedgerForDriver(driverId as OtwDriverId);
      return NextResponse.json(
        {
          success: true,
          mode: "driver",
          driverId,
          wallet,
          ledger,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 }
    );
  } catch (err) {
    console.error("Error in GET /api/otw/nip/summary:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while loading NIP summary.",
      },
      { status: 500 }
    );
  }
}

