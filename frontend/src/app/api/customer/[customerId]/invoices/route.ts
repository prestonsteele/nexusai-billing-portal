import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    // First get the internal customer ID from external ID
    const customer = await orb.customers.fetchByExternalId(customerId);

    // Fetch all invoice statuses including draft
    const [issuedInvoices, draftInvoices] = await Promise.all([
      orb.invoices.list({
        customer_id: customer.id,
      }),
      orb.invoices.list({
        customer_id: customer.id,
        status: ["draft"],
      }),
    ]);

    // Combine and deduplicate invoices
    const allInvoices = [...issuedInvoices.data];
    for (const draft of draftInvoices.data) {
      if (!allInvoices.find((inv) => inv.id === draft.id)) {
        allInvoices.push(draft);
      }
    }

    // Sort by created_at descending (newest first)
    allInvoices.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    console.log(`Found ${allInvoices.length} invoices (${draftInvoices.data.length} draft) for customer ${customerId}`);

    return NextResponse.json(allInvoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
