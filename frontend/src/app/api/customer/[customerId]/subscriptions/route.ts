import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    // Then get their subscriptions using external_customer_id
    const subscriptions = await orb.subscriptions.list({
      external_customer_id: [customerId],
    });

    return NextResponse.json(subscriptions.data);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}
