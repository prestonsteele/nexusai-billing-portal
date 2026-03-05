import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_LIVE, ORB_CACHE_STABLE } from "@/lib/orb";
import { kvGet, kvSet } from "@/lib/kv-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    const kvKey = `orb:customer:${customerId}:credits`;
    const cached = await kvGet(kvKey);
    if (cached) return NextResponse.json(cached);

    const orb = getOrbClient();

    // First get the customer by external ID to get internal ID
    const customer = await orb.customers.fetchByExternalId(customerId, ORB_CACHE_STABLE);

    const credits = await orb.customers.credits.list(customer.id, ORB_CACHE_LIVE);

    await kvSet(kvKey, credits.data);
    return NextResponse.json(credits.data);
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
