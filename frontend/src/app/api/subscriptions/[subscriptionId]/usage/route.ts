import { NextRequest, NextResponse } from "next/server";
import { getOrbClient } from "@/lib/orb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const groupBy = searchParams.get("group_by");
    const granularity = searchParams.get("granularity") || "day";

    const orb = getOrbClient();

    const usageParams: {
      granularity: "day";
      group_by?: string;
    } = {
      granularity: granularity as "day",
    };

    if (groupBy) {
      usageParams.group_by = groupBy;
    }

    const usage = await orb.subscriptions.fetchUsage(
      subscriptionId,
      usageParams
    );

    return NextResponse.json(usage);
  } catch (error) {
    console.error("Error fetching subscription usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription usage" },
      { status: 500 }
    );
  }
}
