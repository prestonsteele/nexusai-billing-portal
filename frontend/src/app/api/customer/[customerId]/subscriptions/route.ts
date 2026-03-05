import { NextRequest, NextResponse } from "next/server";
import { getOrbClient, ORB_CACHE_STABLE } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const orb = getOrbClient();

    const subscriptions = await orb.subscriptions.list(
      { external_customer_id: [customerId] },
      ORB_CACHE_STABLE
    );

    // Sort so active subscriptions come first, then upcoming, then ended
    const statusOrder: Record<string, number> = { active: 0, upcoming: 1, ended: 2 };
    const sorted = [...subscriptions.data].sort(
      (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    );

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}
