import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

const PER_UNIT_COST_BASIS = "1.00"; // $1 per credit unit

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    // Get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    // List existing top-ups
    const topUps = await orb.customers.credits.topUps.list(customer.id);

    return NextResponse.json(topUps.data);
  } catch (error) {
    console.error("Error fetching top-ups:", error);
    return NextResponse.json(
      { error: "Failed to fetch top-ups" },
      { status: 500 }
    );
  }
}

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

    // Create a top-up configuration
    const topUp = await orb.customers.credits.topUps.create(customer.id, {
      currency: body.currency || "USD",
      threshold: body.threshold,
      amount: body.amount,
      per_unit_cost_basis: PER_UNIT_COST_BASIS,
      invoice_settings: {
        auto_collection: true,
        net_terms: 0,
        memo: `Auto top-up: ${body.amount} credits at $${PER_UNIT_COST_BASIS} each`,
      },
      expires_after: body.expires_after || null,
      expires_after_unit: body.expires_after_unit || null,
    });

    return NextResponse.json(topUp);
  } catch (error) {
    console.error("Error creating top-up:", error);
    return NextResponse.json(
      { error: "Failed to create top-up" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const topUpId = searchParams.get("id");

    if (!topUpId) {
      return NextResponse.json(
        { error: "Top-up ID is required" },
        { status: 400 }
      );
    }

    const orb = getOrbClient();

    // Get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    // Delete the top-up
    await orb.customers.credits.topUps.delete(customer.id, topUpId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting top-up:", error);
    return NextResponse.json(
      { error: "Failed to delete top-up" },
      { status: 500 }
    );
  }
}
