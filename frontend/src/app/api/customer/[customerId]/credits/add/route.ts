import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const body = await request.json();
    const orb = getOrbClient();

    // Get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    // Create a credit ledger entry (increment)
    const ledgerEntry = await orb.customers.credits.ledger.createEntry(customer.id, {
      entry_type: "increment",
      amount: body.amount,
      description: body.description || "Credit grant",
      expiry_date: body.expiry_date || null,
      per_unit_cost_basis: body.per_unit_cost_basis || null,
    });

    return NextResponse.json(ledgerEntry);
  } catch (error) {
    console.error("Error adding credits:", error);
    return NextResponse.json(
      { error: "Failed to add credits" },
      { status: 500 }
    );
  }
}
