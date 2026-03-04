import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    // First get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    const ledger = await orb.customers.credits.ledger.list(customer.id);

    // Log entry types for debugging
    const entryTypes = ledger.data.map((e: { entry_type: string }) => e.entry_type);
    const uniqueTypes = [...new Set(entryTypes)];
    console.log(`Credit ledger for ${customerId}: ${ledger.data.length} entries, types: ${uniqueTypes.join(", ")}`);

    return NextResponse.json(ledger.data);
  } catch (error) {
    console.error("Error fetching credit ledger:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit ledger" },
      { status: 500 }
    );
  }
}
