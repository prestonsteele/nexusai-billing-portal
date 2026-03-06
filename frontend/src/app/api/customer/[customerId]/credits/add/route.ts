import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

const PER_UNIT_COST_BASIS = "1.00"; // $1 per credit unit

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const body = await request.json();
    const orb = getOrbClient();

    const customer = await orb.customers.fetchByExternalId(customerId);
    const amount: number = body.amount;
    const description: string = body.description || "Credit purchase";

    // Create ledger increment with invoice_settings — Orb generates the invoice
    // and auto-collects it (simulating a card payment) in one step
    const ledgerEntry = await orb.customers.credits.ledger.createEntry(customer.id, {
      entry_type: "increment",
      amount,
      description,
      expiry_date: body.expiry_date || null,
      per_unit_cost_basis: PER_UNIT_COST_BASIS,
      invoice_settings: {
        auto_collection: true,
        net_terms: 0,
        memo: `${amount} credits at $${PER_UNIT_COST_BASIS} each`,
      },
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
